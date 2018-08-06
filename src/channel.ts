import EventEmitter from  "wolfy87-eventemitter"
import { splitPayload, IChannel, IChannelChunk, channelChunk, channelOpen } from "./converter"

export class Channel extends EventEmitter implements IChannel
{
	id: Uint8Array = new Uint8Array([1,2,3,4,5,6,7,8].map(x => Math.floor(Math.random() * 256)))
	outidx: number = 0
	inidx: number = 0
	lastDeliveredChunkIdx: number = 0
	lastDeliveredChunk?: Uint8Array
	chunksQueue: Uint8Array[] = []
	chunkCandidates: { [idx: number]: Uint8Array } = { }
	futureinidx: number = 0

	processMessage(m: IChannelChunk)
	{
		if (m.inidx > this.lastDeliveredChunkIdx)
		{
			this._dropChunks(m.inidx - this.lastDeliveredChunkIdx)
		}
		if (m.outidx > this.futureinidx)
		{
			this.futureinidx = m.outidx
		}
		if (m.chunkidx > this.inidx)
		{
			this.chunkCandidates[m.chunkidx] = m.payload
		}
		this._digestChunks()
	}
	_digestChunks()
	{
		let candidates = []
		let i = this.inidx
		while (this.futureinidx >= i)
		{
			let candidate = this.chunkCandidates[++i]
			if (!candidate)
				break
			
			delete this.chunkCandidates[i]
			
			candidates.push(candidate)
		}
		this.inidx = this.inidx + candidates.length
		candidates.forEach(c => this.emit("chunk", c))
		this._update()
	}
	_dropChunks(amount: number)
	{
		if (amount >= this.chunksQueue.length)
			this.chunksQueue = []
		else
			this.chunksQueue = this.chunksQueue.slice(amount)
		
		this.lastDeliveredChunkIdx += amount
	}
	send(payload: Uint8Array)
	{
		let payloads = splitPayload(payload)
		this.chunksQueue.push(...payloads)
		this.outidx += payloads.length
		
		this._update()
	}
	_getQR()
	{
		if (!this.lastDeliveredChunk)
			return channelChunk(this, 0, new Uint8Array(0))
		
		if (this.chunksQueue.length)
			return channelChunk(this, this.lastDeliveredChunkIdx + 1, this.chunksQueue[0])
		
		return channelChunk(this, this.lastDeliveredChunkIdx, this.lastDeliveredChunk)
	}
	_update()
	{
		let qr = this._getQR()
		this.emit("update", qr)
	}
}