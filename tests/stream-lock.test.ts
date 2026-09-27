import assert from "node:assert/strict";
import test from "node:test";
import { ReceiveStreamLock } from "../receive/stream-lock.ts";
import { LTDecoder, LTEncoder } from "../shared/fountain.ts";
import { fnv1a, packFile, packFrame, parseFrame, streamIdentity, unpackFile, verifyFile } from "../shared/protocol.ts";

test("a stray valid transfer frame does not discard partial recovery", async () => {
  const source = Uint8Array.from({ length: 80 }, (_, i) => i);
  const other = new Uint8Array(80).fill(77);
  const a = (await packFile("saved.bin", "application/octet-stream", source)).container;
  const b = (await packFile("other.bin", "application/octet-stream", other)).container;
  const blockLen = 16;
  const sendA = new LTEncoder(a, blockLen, 11);
  const sendB = new LTEncoder(b, blockLen, 12);
  const lock = new ReceiveStreamLock();
  let decoder: LTDecoder | undefined;
  let current = "";

  const deliver = (sender: LTEncoder, payload: Uint8Array, seq: number, now: number) => {
    const wire = packFrame({
      sessionId: sender.sessionId,
      seq,
      k: sender.k,
      blockLen,
      totalLen: payload.length,
      payloadFnv: fnv1a(payload),
      flags: 0,
    }, sender.encode(seq));
    const parsed = parseFrame(wire);
    assert.ok(parsed);
    const identity = streamIdentity(parsed.header);
    if (!lock.accept(identity, seq, now)) return;
    if (!decoder || current !== identity) {
      decoder = new LTDecoder(parsed.header.k, parsed.header.blockLen, parsed.header.sessionId, parsed.header.totalLen);
      current = identity;
    }
    decoder.addFrame(seq, parsed.block);
  };

  for (let seq = 0; seq < Math.floor(sendA.k / 2); seq++) deliver(sendA, a, seq, seq * 20);
  assert.ok(decoder && !decoder.isComplete);
  const partial = decoder;
  deliver(sendB, b, 0, sendA.k * 20);
  assert.equal(decoder, partial, "one mismatched frame must preserve the active decoder");
  for (let seq = Math.floor(sendA.k / 2); seq < sendA.k; seq++) deliver(sendA, a, seq, seq * 20 + 20);

  assert.ok(decoder?.isComplete);
  const recovered = decoder.assemble();
  assert.deepEqual(recovered, a);
  assert.equal(fnv1a(recovered!), fnv1a(a));
  const file = await unpackFile(recovered!);
  assert.deepEqual(file.bytes, source);
  assert.equal(await verifyFile(file), true);
});

test("a quiet old stream yields to two distinct frames of one replacement", () => {
  const lock = new ReceiveStreamLock();
  assert.equal(lock.accept("old", 0, 0), true);
  assert.equal(lock.accept("new", 0, 1499), false);
  assert.equal(lock.accept("new", 0, 1500), false);
  assert.equal(lock.accept("new", 0, 1501), false, "a repeated frame is one observation");
  assert.equal(lock.accept("old", 1, 1502), true, "old-stream activity cancels the candidate");
  assert.equal(lock.accept("new", 1, 3002), false);
  assert.equal(lock.accept("third", 0, 3003), false, "a different candidate starts over");
  assert.equal(lock.accept("new", 2, 3004), false);
  assert.equal(lock.accept("new", 3, 3005), true);
  assert.equal(lock.accept("old", 2, 3006), false, "late old frames cannot immediately reset the new stream");
  assert.equal(lock.accept("new", 4, 3007), true);
});

test("a one-block replacement can take over using its next sequence number", () => {
  const payload = new Uint8Array([1, 2, 3, 4]);
  const sender = new LTEncoder(payload, 16, 21);
  assert.equal(sender.k, 1);
  const lock = new ReceiveStreamLock();
  assert.equal(lock.accept("old", 0, 0), true);
  const identity = streamIdentity({
    sessionId: sender.sessionId,
    seq: 0,
    k: sender.k,
    blockLen: sender.blockLen,
    totalLen: payload.length,
    payloadFnv: fnv1a(payload),
    flags: 0,
  });
  assert.equal(lock.accept(identity, 0, 1500), false);
  assert.equal(lock.accept(identity, 1, 1600), true);
  const decoder = new LTDecoder(sender.k, sender.blockLen, sender.sessionId, payload.length);
  decoder.addFrame(1, sender.encode(1));
  assert.deepEqual(decoder.assemble(), payload);
});
