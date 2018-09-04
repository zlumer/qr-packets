export enum MessageType
{
	SINGLE = "s",
	MESSAGE = "m",
	CHANNEL = "c",
	DELIVERY = "d",
}

interface IAnyMessage<T extends MessageType>
{
	protocol: "QRS"
	version: 1
	type: T
}
export interface ISingleMessage extends IAnyMessage<MessageType.SINGLE>
{
	hash: Uint8Array
	payload: Uint8Array
}
export interface IMessageChunk extends IAnyMessage<MessageType.MESSAGE>
{
	hash: Uint8Array
	count: number
	idx: number
	payload: Uint8Array
}
export interface IChannelChunk extends IAnyMessage<MessageType.CHANNEL>
{
	id: Uint8Array
	outidx: number
	inidx: number
	chunkidx: number
	payload: Uint8Array
}
export interface IDeliveryConfirmation extends IAnyMessage<MessageType.DELIVERY>
{
	hash: Uint8Array
	lastChunk: number
	missed: number[]
}
export interface IChannel
{
	id: Uint8Array
	outidx: number
	inidx: number
}