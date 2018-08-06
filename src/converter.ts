import { sha3_256 } from "js-sha3"
import { fromByteArray, toByteArray } from "base64-js"

enum MessageType
{
	SINGLE = "s",
	MESSAGE = "m",
	CHANNEL = "c",
	DELIVERY = "d",
}
const MessageTypes = 'smcd'.split('')

const PROTOCOL = "QRS"
const VERSION = 1

function mergeArrays(...arrays: Uint8Array[]): Uint8Array
{
	let totalLength = arrays.reduce((sum, cur) => sum + cur.byteLength, 0)
	let result = new Uint8Array(totalLength)
	let i = 0
	arrays.forEach(left => (result.set(left, i), i += left.byteLength))
	return result
}
function bhash(data: Uint8Array)
{
	let hash = sha3_256.create()
	hash.update(data)
	return new Uint8Array(hash.arrayBuffer())
}
function bhash8(data: Uint8Array)
{
	return bhash(data).slice(0, 8)
}
function numberToBytes(num: number): Uint8Array
{
	if (num < 253)
		return new Uint8Array([num])
	else
		throw `not implemented yet`
}
function protocolHeader(type: MessageType): string
{
	return `${PROTOCOL}${VERSION}${type}`
}
function constructMessage(type: MessageType, ...data: Uint8Array[])
{
	return protocolHeader(type) + fromByteArray(mergeArrays(...data))
}
export function singleMessage(payload: Uint8Array): string
{
	let hash = bhash8(payload)
	return constructMessage(MessageType.SINGLE, hash, payload)
}
export function multiMessage(chunks: Uint8Array[]): string[]
{
	let hash = bhash8(mergeArrays(...chunks))
	return chunks.map((chunk, idx) => constructMessage(MessageType.MESSAGE,
		hash,
		numberToBytes(chunks.length),
		numberToBytes(idx),
		chunk)
	)
}
export function deliveryConfirmation(mhash: Uint8Array, lastChunk: number, missed: number[]): string
{
	return constructMessage(MessageType.DELIVERY, mhash, numberToBytes(lastChunk), ...missed.map(numberToBytes))
}
export function channelOpen(channelId: Uint8Array): string
{
	return constructMessage(MessageType.CHANNEL, channelId, new Uint8Array([0, 0, 0]))
}
interface IChannel
{
	id: Uint8Array
	outidx: number
	inidx: number
	chunksQueue: Uint8Array[]
}
export function channelChunk(channel: IChannel, chunkidx: number, chunk: Uint8Array): string
{
	return constructMessage(
		MessageType.CHANNEL,
		channel.id,
		new Uint8Array([channel.outidx, channel.inidx, chunkidx]),
		chunk
	)
}
interface IAnyMessage
{
	protocol: "QRS"
	version: 1
	type: MessageType
}
interface ISingleMessage extends IAnyMessage
{
	type: MessageType.SINGLE
	hash: Uint8Array
	payload: Uint8Array
}
interface IMessageChunk extends IAnyMessage
{
	type: MessageType.MESSAGE
	hash: Uint8Array
	count: number
	idx: number
	payload: Uint8Array
}
interface IChannelChunk extends IAnyMessage
{
	type: MessageType.CHANNEL
	id: Uint8Array
	outidx: number
	inidx: number
	chunkidx: number
	payload: Uint8Array
}
interface IDeliveryConfirmation extends IAnyMessage
{
	type: MessageType.DELIVERY
	hash: Uint8Array
	lastChunk: number
	missed: number[]
}
function assertProtocol(msg: string)
{
	assertLength(msg, 4)
	let SIG = `${PROTOCOL}${VERSION}`
	if (msg.substr(0, SIG.length) != SIG)
		throw `unknown protocol! "${msg.substr(0, SIG.length)}" (expected "${SIG}")`
}
function getType(msg: string): MessageType
{
	assertLength(msg, 5)
	let t = msg[4]
	if (MessageTypes.indexOf(t) == -1)
		throw `unknown message type! "${t}"`
	
	return t as MessageType
}
function assertType(msg: string, type: MessageType)
{
	let t = getType(msg)
	if (t != type)
		throw `incorrect message type! "${t}" (expected "${type}")`
}
function assertLength(msg: string | ArrayLike<any>, len: number)
{
	if (!msg)
		throw `empty message!`
	
	if (msg.length < len)
		throw `incorrect length! got ${msg.length} expected at least ${len}`
}
function assertDataLength(msg: string | ArrayLike<any>, datalen: number)
{
	return assertLength(msg, 5 + Math.ceil(4/3*datalen))
}
function assertHash(data: Uint8Array, hash: Uint8Array)
{
	let sha = bhash8(data)
	let msg = `hashes don't match! expected "${hash}", got "${sha}"`
	if (sha.length != hash.length)
		throw msg
	
	for (let i = 0; i < sha.length; i++)
		if (sha[i] != hash[i])
			throw msg
}
function extractData(msg: string): Uint8Array
{
	assertLength(msg, 6)
	return toByteArray(msg.substr(5))
}
function readNumber(arr: Uint8Array, idx: number): [number, number]
{
	let b1 = arr[idx]
	if (b1 < 0xfc)
		return [b1, 1]
	let len = 1 << (b1 - 0xfd)
	return [readNumberBytes(arr, idx + 1, len), len + 1]
}
function readNumberBytes(arr: Uint8Array, idx: number, length: number): number
{
	assertLength(arr, idx + length)

	let sum = 0
	for (let i = 0; i < length; i++)
	{
		let b = arr[idx + i]
		sum += b << (i * 8)
	}
	return sum
}
export function decodeAnyMessage(msg: string): IAnyMessage
{
	let type = getType(msg)
	switch (type)
	{
		case MessageType.SINGLE:
			return decodeSingleMessage(msg)
		case MessageType.MESSAGE:
			return decodeMessageChunk(msg)
		case MessageType.CHANNEL:
			return decodeChannelChunk(msg)
		case MessageType.DELIVERY:
			return decodeDeliveryConfirmation(msg)
	}
}
export function decodeSingleMessage(msg: string): ISingleMessage
{
	assertType(msg, MessageType.SINGLE)
	assertDataLength(msg, 8/*hash*/ + 1/*data*/)
	let b64 = extractData(msg)
	let hash = b64.slice(0, 8)
	let payload = b64.subarray(8)
	assertHash(payload, hash)
	return {
		protocol: PROTOCOL,
		version: VERSION,
		type: MessageType.SINGLE,
		hash,
		payload
	}
}
export function decodeMessageChunk(msg: string): IMessageChunk
{
	assertType(msg, MessageType.MESSAGE)
	assertDataLength(msg, 8/*hash*/ + 2/*idxs*/ + 1/*data*/)
	let b64 = extractData(msg)
	let hash = b64.subarray(0, 8)
	let [count, tci] = readNumber(b64, 8)
	let [idx, chi] = readNumber(b64, 8 + tci)
	let payload = b64.subarray(8 + tci + chi)
	return {
		protocol: "QRS",
		version: 1,
		type: MessageType.MESSAGE,
		hash,
		count,
		idx,
		payload
	}
}
export function decodeChannelChunk(msg: string): IChannelChunk
{
	assertType(msg, MessageType.CHANNEL)
	assertDataLength(msg, 8/*id*/ + 3/*idxs*/ + 1/*data*/)
	let b64 = extractData(msg)
	let id = b64.subarray(0, 8)
	let [outidx, oi] = readNumber(b64, 8)
	let [inidx, ii] = readNumber(b64, 8 + oi)
	let [chunkidx, ci] = readNumber(b64, 8 + oi + ii)
	let payload = b64.subarray(8 + oi + ii + ci)
	return {
		protocol: "QRS",
		version: 1,
		type: MessageType.CHANNEL,
		id,
		outidx,
		inidx,
		chunkidx,
		payload
	}
}
export function decodeDeliveryConfirmation(msg: string): IDeliveryConfirmation
{
	assertType(msg, MessageType.DELIVERY)
	assertDataLength(msg, 8/*hash*/ + 1/*idx*/)
	let b64 = extractData(msg)
	let hash = b64.subarray(0, 8)
	let [lastChunk, li] = readNumber(b64, 8)
	let i = 8 + li
	let missed = []
	while (i < b64.byteLength)
	{
		let [idx, ii] = readNumber(b64, i)
		missed.push(idx)
		i += ii
	}
	return {
		protocol: "QRS",
		version: 1,
		type: MessageType.DELIVERY,
		hash,
		lastChunk,
		missed
	}
}