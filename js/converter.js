"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var js_sha3_1 = require("js-sha3");
var base64_js_1 = require("base64-js");
var MessageType;
(function (MessageType) {
    MessageType["SINGLE"] = "s";
    MessageType["MESSAGE"] = "m";
    MessageType["CHANNEL"] = "c";
    MessageType["DELIVERY"] = "d";
})(MessageType = exports.MessageType || (exports.MessageType = {}));
var MessageTypes = 'smcd'.split('');
var PROTOCOL = "QRS";
var VERSION = 1;
function mergeArrays() {
    var arrays = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        arrays[_i] = arguments[_i];
    }
    var totalLength = arrays.reduce(function (sum, cur) { return sum + cur.byteLength; }, 0);
    var result = new Uint8Array(totalLength);
    var i = 0;
    arrays.forEach(function (left) { return (result.set(left, i), i += left.byteLength); });
    return result;
}
function bhash(data) {
    var hash = js_sha3_1.sha3_256.create();
    hash.update(data);
    return new Uint8Array(hash.arrayBuffer());
}
exports.bhash = bhash;
function bhash8(data) {
    return bhash(data).slice(0, 8);
}
exports.bhash8 = bhash8;
function numberToBytes(num) {
    if (num < 253)
        return new Uint8Array([num]);
    else
        throw "not implemented yet";
}
function protocolHeader(type) {
    return "" + PROTOCOL + VERSION + type;
}
function constructMessage(type) {
    var data = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        data[_i - 1] = arguments[_i];
    }
    return protocolHeader(type) + base64_js_1.fromByteArray(mergeArrays.apply(void 0, data));
}
function singleMessage(payload) {
    var hash = bhash8(payload);
    return constructMessage(MessageType.SINGLE, hash, payload);
}
exports.singleMessage = singleMessage;
function multiMessage(chunks) {
    var hash = bhash8(mergeArrays.apply(void 0, chunks));
    return chunks.map(function (chunk, idx) { return constructMessage(MessageType.MESSAGE, hash, numberToBytes(chunks.length), numberToBytes(idx), chunk); });
}
exports.multiMessage = multiMessage;
function splitPayload(payload, CHUNK_LENGTH) {
    if (CHUNK_LENGTH === void 0) { CHUNK_LENGTH = 100; }
    var payloads = [];
    for (var i = 0; i < payload.length; i++) {
        if ((i * CHUNK_LENGTH + CHUNK_LENGTH) > payload.length)
            payloads.push(payload.subarray(i * CHUNK_LENGTH));
        else
            payloads.push(payload.subarray(i * CHUNK_LENGTH, CHUNK_LENGTH));
    }
    return payloads;
}
exports.splitPayload = splitPayload;
function autoMessage(payload) {
    if (payload.length < 100)
        return [singleMessage(payload)];
    return multiMessage(splitPayload(payload, 100));
}
exports.autoMessage = autoMessage;
function deliveryConfirmation(mhash, lastChunk, missed) {
    return constructMessage.apply(void 0, [MessageType.DELIVERY, mhash, numberToBytes(lastChunk)].concat(missed.map(numberToBytes)));
}
exports.deliveryConfirmation = deliveryConfirmation;
function channelOpen(channelId) {
    return constructMessage(MessageType.CHANNEL, channelId, new Uint8Array([0, 0, 0]));
}
exports.channelOpen = channelOpen;
function channelChunk(channel, chunkidx, chunk) {
    return constructMessage(MessageType.CHANNEL, channel.id, new Uint8Array([channel.outidx, channel.inidx, chunkidx]), chunk);
}
exports.channelChunk = channelChunk;
function assertProtocol(msg) {
    assertLength(msg, 4);
    var SIG = "" + PROTOCOL + VERSION;
    if (msg.substr(0, SIG.length) != SIG)
        throw "unknown protocol! \"" + msg.substr(0, SIG.length) + "\" (expected \"" + SIG + "\")";
}
function getType(msg) {
    assertLength(msg, 5);
    var t = msg[4];
    if (MessageTypes.indexOf(t) == -1)
        throw "unknown message type! \"" + t + "\"";
    return t;
}
function assertType(msg, type) {
    var t = getType(msg);
    if (t != type)
        throw "incorrect message type! \"" + t + "\" (expected \"" + type + "\")";
}
function assertLength(msg, len) {
    if (!msg)
        throw "empty message!";
    if (msg.length < len)
        throw "incorrect length! got " + msg.length + " expected at least " + len;
}
function assertDataLength(msg, datalen) {
    return assertLength(msg, 5 + Math.ceil(4 / 3 * datalen));
}
function assertHash(data, hash) {
    var sha = bhash8(data);
    if (sha.toString() != hash.toString())
        throw "hashes don't match! expected \"" + hash + "\", got \"" + sha + "\"";
}
function extractData(msg) {
    assertLength(msg, 6);
    var str = msg.substr(5);
    while (str.length % 4)
        str += '=';
    return base64_js_1.toByteArray(str);
}
function readNumber(arr, idx) {
    var b1 = arr[idx];
    if (b1 < 0xfc)
        return [b1, 1];
    var len = 1 << (b1 - 0xfd);
    return [readNumberBytes(arr, idx + 1, len), len + 1];
}
function readNumberBytes(arr, idx, length) {
    assertLength(arr, idx + length);
    var sum = 0;
    for (var i = 0; i < length; i++) {
        var b = arr[idx + i];
        sum += b << (i * 8);
    }
    return sum;
}
function decodeAnyMessage(msg) {
    assertProtocol(msg);
    var type = getType(msg);
    switch (type) {
        case MessageType.SINGLE:
            return decodeSingleMessage(msg);
        case MessageType.MESSAGE:
            return decodeMessageChunk(msg);
        case MessageType.CHANNEL:
            return decodeChannelChunk(msg);
        case MessageType.DELIVERY:
            return decodeDeliveryConfirmation(msg);
    }
}
exports.decodeAnyMessage = decodeAnyMessage;
function decodeSingleMessage(msg) {
    assertType(msg, MessageType.SINGLE);
    assertDataLength(msg, 8 /*hash*/ + 1 /*data*/);
    var b64 = extractData(msg);
    var hash = b64.slice(0, 8);
    var payload = b64.subarray(8);
    assertHash(payload, hash);
    return {
        protocol: PROTOCOL,
        version: VERSION,
        type: MessageType.SINGLE,
        hash: hash,
        payload: payload
    };
}
exports.decodeSingleMessage = decodeSingleMessage;
function decodeMessageChunk(msg) {
    assertType(msg, MessageType.MESSAGE);
    assertDataLength(msg, 8 /*hash*/ + 2 /*idxs*/ + 1 /*data*/);
    var b64 = extractData(msg);
    var hash = b64.subarray(0, 8);
    var _a = readNumber(b64, 8), count = _a[0], tci = _a[1];
    var _b = readNumber(b64, 8 + tci), idx = _b[0], chi = _b[1];
    var payload = b64.subarray(8 + tci + chi);
    return {
        protocol: "QRS",
        version: 1,
        type: MessageType.MESSAGE,
        hash: hash,
        count: count,
        idx: idx,
        payload: payload
    };
}
exports.decodeMessageChunk = decodeMessageChunk;
function decodeChannelChunk(msg) {
    assertType(msg, MessageType.CHANNEL);
    assertDataLength(msg, 8 /*id*/ + 3 /*idxs*/ + 1 /*data*/);
    var b64 = extractData(msg);
    var id = b64.subarray(0, 8);
    var _a = readNumber(b64, 8), outidx = _a[0], oi = _a[1];
    var _b = readNumber(b64, 8 + oi), inidx = _b[0], ii = _b[1];
    var _c = readNumber(b64, 8 + oi + ii), chunkidx = _c[0], ci = _c[1];
    var payload = b64.subarray(8 + oi + ii + ci);
    return {
        protocol: "QRS",
        version: 1,
        type: MessageType.CHANNEL,
        id: id,
        outidx: outidx,
        inidx: inidx,
        chunkidx: chunkidx,
        payload: payload
    };
}
exports.decodeChannelChunk = decodeChannelChunk;
function decodeDeliveryConfirmation(msg) {
    assertType(msg, MessageType.DELIVERY);
    assertDataLength(msg, 8 /*hash*/ + 1 /*idx*/);
    var b64 = extractData(msg);
    var hash = b64.subarray(0, 8);
    var _a = readNumber(b64, 8), lastChunk = _a[0], li = _a[1];
    var i = 8 + li;
    var missed = [];
    while (i < b64.byteLength) {
        var _b = readNumber(b64, i), idx = _b[0], ii = _b[1];
        missed.push(idx);
        i += ii;
    }
    return {
        protocol: "QRS",
        version: 1,
        type: MessageType.DELIVERY,
        hash: hash,
        lastChunk: lastChunk,
        missed: missed
    };
}
exports.decodeDeliveryConfirmation = decodeDeliveryConfirmation;
