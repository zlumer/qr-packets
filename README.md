# (draft) QR Packets v1

<!--`QRS1mHASH4hash1DATAf86d81d1850c1b710800825208948147537b1d1587b585e3bc106d24f38b4ad49662887e6d38bbafcf00008025a0ba8a345b260ff843d63bce2920135861dd91d8fcc69376dc6fe03d4fa87445b3a0271598d8e27ec63e15f18e6d480a851f25fb4d8d108bc194f703cc40cadb13ab`-->
## Abstract
QR Packets is designed to provide a way to exchange messages between offline devices in physical proximity.

Advantages:
- **Offline**: no network connection needed, works on air-gapped devices
- **Cheap**: works on any cheap device with at least SD screen and/or camera (phones, laptops, embedded devices)
- **Clear**: human-readable transport protocol (using any free QR code scanner app)
- **Fast**: faster, easier and less error-prone than manual data entry
- **Secure**: fully protects receiving device from hardware/OS vulnerabilities, gives user full physical control over connection

<!--:::info
For the sake of simplicity this whitepaper will focus on use of QR Packets in offline (cold) cryptocurrency wallets.
:::-->

## High-level transport protocol
This section describes protocol operation on a higher level:
- hashing messages
- breaking messages into chunks
- hashing chunks

:::info
QR code format provides error correction techniques and handles message length.
Because of this QR Packets does not introduce any extra checks for message consistency except message hashing mainly for identification purposes.
:::

### Protocol header
- protocol signature and version (e.g. `QRS1`).
- message type: `s`/`m`/`c`/`d` for `single`, `message` (`multi`), `channel` and `delivery` respectively.

### Message header
- message hash: first 64 bits (8 bytes) of `sha3(message)`

### Chunk header
- total chunk count (number)
- chunk index (number)

### Channel header
- channel id: random 64 bits (8 bytes)
- index of the last outgoing chunk in the queue (number)
- index of the last received chunk in the queue (number)
- index of the current chunk (number)

### One-way single-chunk message transport
Single-chunk message is a plain QR code containing:
- protocol header
    - signature and version
    - message type `s`
- message header
    - message hash
- message payload
    - any data

### One-way multi-chunk message transport
Multi-chunk message is a set of QR codes containing:
- protocol header
    - signature and version
    - message type `m`
- message header
    - message hash
- chunk header
    - total chunk count
    - chunk index
- chunk payload
    - any data

#### Without delivery confirmation
Multi-chunk messages can be sent without delivery confirmation (UDP-style).
This method should be used when the message is too long to fit into a single chunk.
This method handles situations when receiving device doesn't have front-facing camera, or does not have screen at all. It will also work if sending device does not have camera (e.g. an old PC monitor). Or any other case where feedback from the reader is not accessible.

Since no delivery confirmation is available, all we have left to do is just send QR codes in a succession and hope for the receiver to get them.

This can be as simple as an animated GIF with enough delay between frames for the receiver to scan the code. Animation must be looped to give the receiving device a chance to re-scan missed QR codes.
In some cases manual input mode can be used: like a photo gallery with QR codes. User scans one image with receiving device and manually switches to the next.

#### With delivery confirmation
If we have both sending and receiving devices with screens and cameras working, we can use full duplex mode for multi-chunk message sending.

In this case the sender shows QR codes one-by-one, waiting for the receiver to confirm message delivery.

A variation of this method can be used where sender shows QR codes in a quick succession and then waits for the receiver to request missed chunks.

Delivery confirmation format:
- protocol header
    - signature and version
    - message type `d`
- message header
    - message hash
- message payload
    - index of the last received chunk
    All preceding chunks will be automatically marked as received.
    - list of missed chunks

### Duplex channel transport layer
QR Packets can be used to establish a message exchange protocol between two air-gapped devices.

To open a channel we need two devices, each with a working screen and camera.
Front-facing cameras make transfer much faster and easier, but are not necessary.

Channel lifecycle consists of three main steps:
1. Open message channel.
2. Exchange messages.
3. _(optional)_ Close message channel.

:::info
We will call the device that opens the channel _Sender_ and the other device will be called _Receiver_.
However, data sending and receiving is performed by both parties.
:::

#### Channel opening
To open a channel, we need to send one packet from sender to receiver:
- protocol header
    - signature and version
    - message type `c`
- channel header
    - channel id (random number)
    - outidx = `0`
    - inidx = `0`
    - chunkidx = `0`

Here we use zeroes for `outidx`, `inidx` and `chunkidx` to declare that the channel is just opening.

Receiver should confirm channel opening with the mirror packet:
- protocol header
    - signature and version
    - message type `c`
- channel header
    - channel id (as received from sender)
    - outidx = `0`
    - inidx = `0`
    - chunkidx = `0`

After channel open confirmation both sides can start exchanging messages.

Chunk exchange is performed in the same way as in multi-chunk messages, but with channel chunk indexes.

When one side decides to send a message, it should increase outgoing message index and send the chunks as QR codes in a quick succession or after confirmation.

When any side receives a chunk, it should increase incoming index by one.

:::warning
**Important!**
Incoming/outgoing chunk indexes are ordered differently on sides: outgoing count goes first, incoming count goes second.
`25/5/22` on _Sender_ side means that _Sender_ is going to send `25` chunks, received `5` chunks, and currently displays chunk `#22`.
`10/22/5` on _Receiver_ side means that _Receiver_ received `22` chunks, is going to send `10` chunks and currently displays chunk `#5`
:::

If any side receives a chunk that is too far away in the future, it should store it for later use without changing indexes.
E.g. if receiver is in state `25/12/10` (`25` messages received, `12` in sending queue, `#10` current chunk) and recieves a chunk `#28`, it should store it in a local cache and wait for chunks `#26` and `#27` to arrive.
When chunks `#26` and `#27` finally arrive, receiver will increase incoming index to `#28` instantly, since it has all the chunks `#26`-`#28`.

#### Message sending in channels

Messages are sent in chunks.

:::info
QR format provides enough data consistency and error correction. Chunk or message hashes are only needed for identification purposes.
However, channel provides a unique ID and chunk number, so no extra hashing is needed.
:::

In-channel message exchange format:
- protocol header
    - signature and version
    - message type `c`
- channel header
    - channel id
    - outidx (see above more info about indexes)
    - inidx (see above more info about indexes)
    - chunkidx (see above more info about indexes)
- chunk payload
    - any data

#### Message separation in channels
Due to hard constraints on data size (100-120 bytes per QR code) messages are not separated or hashed in channels.
Message separation is performed on application-level, like in an ordinary TCP socket.
Recommended message separation is first sending the expected byte length of a message, and then send the payload itself in multiple chunks.

### Encryption
This protocol does not cover message encryption techinques. Message encryption/decryption is performed on application level.
Messages can easily be encrypted using any public key encryption algorithm (e.g. RSA or ECC) and key exchange algorithm (DH, RSA, ECDH etc.).
Encrypted messages can be passed as binary data encoded in any binary-to-text encoding (e.g. Base64 or Ascii85).
Message and chunk hashing as well as QR code-specific error correction techniques ensure data consistency.
:::info
Despite technical possibility to send encrypted messages, ecnryption is not recommended, because it eliminates data readability — one of the main advantages of QR Packets.
:::

## Low-level transport protocol & examples
### 
### Single-chunk and multi-chunk messages
Single-chunk example: **`QRS1sHASHDATAf86d81...`**
Multi-chunk example: **`QRS1mHASH41DATAf86d81...`**

signature|version|type|message hash|chunk count|chunk index|payload
-|-|-|-|-|-|-
`3`|`1`|`1`|`8`|`1`..`∞`|`1`..`∞`|`1`..`∞`
||||||
**`QRS`**|**`1`**|**`s`**|**`HASH`**||||**`DATAf86d81...`**
**`QRS`**|**`1`**|**`m`**|**`HASH`**|**`4`**|**`1`**|**`DATAf86d81...`**

`chunk count` is encoded in Bitcoin `varint` (little endian).

Protocol header is always 5 chars long.
All data after that is encoded in `base64`.
QR code version 6 provides maximum 190 chars of data.
190 - 5 = 185 chars of `base64` or **138 raw bytes**.
Of these 138 bytes, message hash (8), chunk count (1-9) and chunk index (1-9) take 10-26 bytes extra.

:::info
Maximum payload size can be **130 bytes** in a single message and **112-128 bytes** in a multi-chunk message chunk.
:::

<details>
<summary>Integer table (Bitcoin <code>compactSize</code>)</summary>

  Integer|Hex
  -|-
  1|`01`
  2|`02`
  3|`03`
  ...|...
  126|`7e`
  127|`7f`
  128|`80`
  129|`81`
  ...|...
  251|`fb`
  252|`fc`
  253|`fd fd 00`
  254|`fd fe 00`
  255|`fd ff 00`
  256|`fd 00 01`
  257|`fd 00 02`
  ...|...

Source: http://learnmeabitcoin.com/glossary/varint
Source: https://bitcoin.org/en/developer-reference#compactsize-unsigned-integers
</details>

### Channel message example

Channel example: **`QRS1cHASH25122263DATAf86d81...`**

signature|version|type|channel id|outidx|inidx|chunkidx|payload
-|-|-|-|-|-|-|-
**`QRS`**|**`1`**|**`c`**|**`HASH`**|**`25`**|**`12`**|**`22`**|**`DATAf86d81...`**

Protocol header is always 5 chars long.
All data after that is encoded in `base64`.
QR code version 6 provides maximum 190 chars of data.
190 - 5 = 185 chars of `base64` or **138 raw bytes**.
Of these 138 bytes, channel id (8) and indexes 3x(1-9) take 11-35 bytes extra.

:::info
Maximum payload size can be **103-127 bytes** in a channel chunk (depending on channel state).
:::

## Author
©2018 Dmitry Radkovskiy, sponsored by Ducatur Research
