"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
require("jest-extended");
var converter_1 = require("./converter");
describe("ecnoding/decoding", function () {
    var barr = function () {
        var a = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            a[_i] = arguments[_i];
        }
        return new Uint8Array(a);
    };
    var wrapmc = function (c) { return (__assign({ protocol: "QRS", version: 1, type: "m" }, c)); };
    it('single message sanity check', function () {
        var payload = barr(3, 14, 15, 92, 6);
        var msg = converter_1.singleMessage(payload);
        expect(converter_1.decodeSingleMessage(msg).payload).toEqual(payload);
    });
    it('multi message sanity check', function () {
        var mmsgs = converter_1.multiMessage([barr(3, 14, 15, 92, 6), barr(42, 42, 42), barr(1, 2, 3)]);
        var hash = converter_1.bhash8(barr(3, 14, 15, 92, 6, 42, 42, 42, 1, 2, 3));
        var chunks = mmsgs.map(converter_1.decodeMessageChunk);
        expect(chunks[0]).toEqual(wrapmc({ count: 3, idx: 0, hash: hash, payload: barr(3, 14, 15, 92, 6) }));
        expect(chunks[1]).toEqual(wrapmc({ count: 3, idx: 1, hash: hash, payload: barr(42, 42, 42) }));
        expect(chunks[2]).toEqual(wrapmc({ count: 3, idx: 2, hash: hash, payload: barr(1, 2, 3) }));
    });
});
