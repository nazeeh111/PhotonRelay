import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TX_FPS, DEFAULT_FRAME_BYTES, TX_FPS_OPTIONS, FRAME_BYTES_OPTIONS, effectiveFrameBytes } from '../shared/send-settings.ts';
import { HEADER_LEN } from '../shared/protocol.ts';
import { fitsInOneStream } from '../shared/frame-capacity.ts';

test('default stream allows multiple display refreshes and avoids maximum QR density', () => {
  assert.ok(DEFAULT_TX_FPS <= 24);
  assert.ok(DEFAULT_FRAME_BYTES <= 1465);
  assert.ok(TX_FPS_OPTIONS.includes(60));
  assert.ok(FRAME_BYTES_OPTIONS.includes(2953));
  assert.equal(fitsInOneStream(64 * 1024 * 1024 + 1024, DEFAULT_FRAME_BYTES), true);
});
test('small payloads are not padded into needlessly dense QR symbols', () => {
  assert.equal(effectiveFrameBytes(1465, 100), HEADER_LEN + 100);
  assert.equal(effectiveFrameBytes(1465, 10000), 1465);
  assert.equal(effectiveFrameBytes(2953, 400), HEADER_LEN + 400);
});
test('invalid frame dimensions are rejected before streaming', () => {
  for (const [frame, payload] of [[22, 10], [NaN, 10], [500, 0], [500, -1], [500.5, 4], [500, Infinity]]) {
    assert.throws(() => effectiveFrameBytes(frame!, payload!), /positive|frame/i);
  }
});
