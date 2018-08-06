"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var wolfy87_eventemitter_1 = __importDefault(require("wolfy87-eventemitter"));
var converter_1 = require("./converter");
var Channel = /** @class */ (function (_super) {
    __extends(Channel, _super);
    function Channel() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.id = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8].map(function (x) { return Math.floor(Math.random() * 256); }));
        _this.outidx = 0;
        _this.inidx = 0;
        _this.lastDeliveredChunkIdx = 0;
        _this.chunksQueue = [];
        _this.chunkCandidates = {};
        _this.futureinidx = 0;
        return _this;
    }
    Channel.prototype.processMessage = function (m) {
        if (m.inidx > this.lastDeliveredChunkIdx) {
            this._dropChunks(m.inidx - this.lastDeliveredChunkIdx);
        }
        if (m.outidx > this.futureinidx) {
            this.futureinidx = m.outidx;
        }
        if (m.chunkidx > this.inidx) {
            this.chunkCandidates[m.chunkidx] = m.payload;
        }
        this._digestChunks();
    };
    Channel.prototype._digestChunks = function () {
        var _this = this;
        var candidates = [];
        var i = this.inidx;
        while (this.futureinidx >= i) {
            var candidate = this.chunkCandidates[++i];
            if (!candidate)
                break;
            delete this.chunkCandidates[i];
            candidates.push(candidate);
        }
        this.inidx = this.inidx + candidates.length;
        candidates.forEach(function (c) { return _this.emit("chunk", c); });
        this._update();
    };
    Channel.prototype._dropChunks = function (amount) {
        if (amount >= this.chunksQueue.length)
            this.chunksQueue = [];
        else
            this.chunksQueue = this.chunksQueue.slice(amount);
        this.lastDeliveredChunkIdx += amount;
    };
    Channel.prototype.send = function (payload) {
        var _a;
        var payloads = converter_1.splitPayload(payload);
        (_a = this.chunksQueue).push.apply(_a, payloads);
        this.outidx += payloads.length;
        this._update();
    };
    Channel.prototype._getQR = function () {
        if (!this.lastDeliveredChunk)
            return converter_1.channelChunk(this, 0, new Uint8Array(0));
        if (this.chunksQueue.length)
            return converter_1.channelChunk(this, this.lastDeliveredChunkIdx + 1, this.chunksQueue[0]);
        return converter_1.channelChunk(this, this.lastDeliveredChunkIdx, this.lastDeliveredChunk);
    };
    Channel.prototype._update = function () {
        var qr = this._getQR();
        this.emit("update", qr);
    };
    return Channel;
}(wolfy87_eventemitter_1.default));
exports.Channel = Channel;
