"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
var channel_1 = require("./channel");
var converter_1 = require("./converter");
describe('channel basic functionality', function () {
    var barr = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        return new Uint8Array(a);
    };
    var chunk = function (id, inidx, outidx, chunkidx, payload) {
        return { id: id, chunkidx: chunkidx, inidx: inidx, outidx: outidx, payload: payload, protocol: "QRS", type: converter_1.MessageType.CHANNEL, version: 1 };
    };
    it('should process single chunk', function () {
        var c = new channel_1.Channel();
        var onchunk = jest.fn();
        c.on("chunk", onchunk);
        c._dropChunks = jest.fn(c._dropChunks);
        c._digestChunks = jest.fn(c._digestChunks);
        c.processMessage(chunk(c.id.slice(), 0, 1, 1, barr(3, 14, 15, 92)));
        expect(c._dropChunks).not.toHaveBeenCalled();
        expect(c._digestChunks).toHaveBeenCalledTimes(1);
        expect(onchunk).toHaveBeenCalledTimes(1);
        expect(onchunk.mock.calls[0][0]).toEqual(barr(3, 14, 15, 92));
        expect(c.inidx).toEqual(1);
        expect(c.outidx).toEqual(0);
        expect(c.chunksQueue).toBeEmpty();
        expect(c.chunkCandidates).toBeEmpty();
        expect(c.futureinidx).toEqual(1);
        expect(c.lastDeliveredChunk).toBeUndefined();
        expect(c.lastDeliveredChunkIdx).toEqual(0);
    });
    it('should process several chunks in order (continuosly)', function () {
        var c = new channel_1.Channel();
        var onchunk = jest.fn();
        c.on("chunk", onchunk);
        c._dropChunks = jest.fn(c._dropChunks);
        c._digestChunks = jest.fn(c._digestChunks);
        c.processMessage(chunk(c.id.slice(), 0, 1, 1, barr(3, 14, 15, 92)));
        c.processMessage(chunk(c.id.slice(), 0, 2, 2, barr(42, 42, 42)));
        expect(c._dropChunks).not.toHaveBeenCalled();
        expect(c._digestChunks).toHaveBeenCalledTimes(2);
        expect(onchunk).toHaveBeenCalledTimes(2);
        expect(onchunk.mock.calls[0][0]).toEqual(barr(3, 14, 15, 92));
        expect(onchunk.mock.calls[1][0]).toEqual(barr(42, 42, 42));
        expect(c.inidx).toEqual(2);
        expect(c.outidx).toEqual(0);
        expect(c.chunksQueue).toBeEmpty();
        expect(c.chunkCandidates).toBeEmpty();
        expect(c.futureinidx).toEqual(2);
        expect(c.lastDeliveredChunk).toBeUndefined();
        expect(c.lastDeliveredChunkIdx).toEqual(0);
    });
    it('should process several chunks in order (simultaneously)', function () {
        var c = new channel_1.Channel();
        var onchunk = jest.fn();
        c.on("chunk", onchunk);
        c._dropChunks = jest.fn(c._dropChunks);
        c._digestChunks = jest.fn(c._digestChunks);
        c.processMessage(chunk(c.id.slice(), 0, 2, 1, barr(3, 14, 15, 92)));
        c.processMessage(chunk(c.id.slice(), 0, 2, 2, barr(42, 42, 42)));
        expect(c._dropChunks).not.toHaveBeenCalled();
        expect(c._digestChunks).toHaveBeenCalledTimes(2);
        expect(onchunk).toHaveBeenCalledTimes(2);
        expect(onchunk.mock.calls[0][0]).toEqual(barr(3, 14, 15, 92));
        expect(onchunk.mock.calls[1][0]).toEqual(barr(42, 42, 42));
        expect(c.inidx).toEqual(2);
        expect(c.outidx).toEqual(0);
        expect(c.chunksQueue).toBeEmpty();
        expect(c.chunkCandidates).toBeEmpty();
        expect(c.futureinidx).toEqual(2);
        expect(c.lastDeliveredChunk).toBeUndefined();
        expect(c.lastDeliveredChunkIdx).toEqual(0);
    });
    it('should process several chunks out of order', function () {
        var c = new channel_1.Channel();
        var onchunk = jest.fn();
        c.on("chunk", onchunk);
        c._dropChunks = jest.fn(c._dropChunks);
        c._digestChunks = jest.fn(c._digestChunks);
        c.processMessage(chunk(c.id.slice(), 0, 2, 2, barr(42, 42, 42)));
        expect(onchunk).not.toHaveBeenCalled();
        expect(c.chunkCandidates).not.toBeEmpty();
        expect(c.chunkCandidates[2]).toEqual(barr(42, 42, 42));
        expect(c.inidx).toEqual(0);
        c.processMessage(chunk(c.id.slice(), 0, 2, 1, barr(3, 14, 15, 92)));
        expect(c._dropChunks).not.toHaveBeenCalled();
        expect(c._digestChunks).toHaveBeenCalledTimes(2);
        expect(onchunk).toHaveBeenCalledTimes(2);
        expect(onchunk.mock.calls[0][0]).toEqual(barr(3, 14, 15, 92));
        expect(onchunk.mock.calls[1][0]).toEqual(barr(42, 42, 42));
        expect(c.inidx).toEqual(2);
        expect(c.outidx).toEqual(0);
        expect(c.chunksQueue).toBeEmpty();
        expect(c.chunkCandidates).toBeEmpty();
        expect(c.futureinidx).toEqual(2);
        expect(c.lastDeliveredChunk).toBeUndefined();
        expect(c.lastDeliveredChunkIdx).toEqual(0);
    });
});
