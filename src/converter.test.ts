import "jest-extended"
import { singleMessage, decodeSingleMessage, multiMessage, decodeMessageChunk, IMessageChunk, bhash8 } from "./converter"

describe("ecnoding/decoding", () =>
{
	let barr = (...a: number[]) => new Uint8Array(a)
	let wrapmc = (c: IMessageChunk): IMessageChunk => ({ protocol: "QRS", version: 1, type: "m", ...c })
	it('single message sanity check', () =>
	{
		let payload = barr(3,14,15,92,6)
		let msg = singleMessage(payload)
		expect(decodeSingleMessage(msg).payload).toEqual(payload)
	})
	it('multi message sanity check', () =>
	{
		let mmsgs = multiMessage([barr(3, 14, 15, 92, 6), barr(42, 42, 42), barr(1, 2, 3)])
		let hash = bhash8(barr(3,14,15,92,6,42,42,42,1,2,3))
		let chunks = mmsgs.map(decodeMessageChunk)
		expect(chunks[0]).toEqual(wrapmc({ count: 3, idx: 0, hash, payload: barr(3, 14, 15, 92, 6) } as IMessageChunk))
		expect(chunks[1]).toEqual(wrapmc({ count: 3, idx: 1, hash, payload: barr(42, 42, 42) } as IMessageChunk))
		expect(chunks[2]).toEqual(wrapmc({ count: 3, idx: 2, hash, payload: barr(1, 2, 3) } as IMessageChunk))
	})
})