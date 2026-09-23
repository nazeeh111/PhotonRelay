import test from "node:test";
import assert from "node:assert/strict";
import { runChannelTrial } from "../shared/channel-lab";
test("seeded noisy channel recovers exact payload and is reproducible", async () => {
  const options = { seed: 42, lossPercent: 35, duplicatePercent: 20 };
  const a = await runChannelTrial(options), b = await runChannelTrial(options);
  assert.deepEqual(a, b); assert.ok(a.complete && a.exactBytes && a.hashMatch);
  assert.ok(a.dropped > 0 && a.duplicated > 0); assert.equal(a.sourceSHA256.length, 64);
});
test("total loss terminates within budget without claiming recovery", async () => {
  const result = await runChannelTrial({ seed: 0, lossPercent: 100, duplicatePercent: 100 });
  assert.equal(result.emitted, result.maxFrames); assert.equal(result.delivered, 0);
  assert.equal(result.complete, false); assert.equal(result.hashMatch, false); assert.equal(result.recoveredSHA256, null);
});
test("no-loss duplicate delivery preserves exact bytes", async () => {
  const result = await runChannelTrial({ seed: 0xffffffff, lossPercent: 0, duplicatePercent: 100 });
  assert.ok(result.complete && result.exactBytes); assert.equal(result.emitted, result.totalBlocks);
  assert.equal(result.delivered, 2 * result.emitted);
});
test("invalid bounds are rejected", async () => {
  for (const options of [{seed:-1,lossPercent:0,duplicatePercent:0},{seed:1,lossPercent:NaN,duplicatePercent:0},{seed:1,lossPercent:0,duplicatePercent:101}]) await assert.rejects(runChannelTrial(options));
});
