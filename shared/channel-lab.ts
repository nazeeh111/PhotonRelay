/** PhotonRelay diagnostic simulation. No QR rendering/camera timing is measured. */
import { LTEncoder, LTDecoder } from "./fountain";
import { splitmix32 } from "./protocol";

export interface ChannelOptions { seed: number; lossPercent: number; duplicatePercent: number }
export async function runChannelTrial(options: ChannelOptions) {
  const { seed, lossPercent, duplicatePercent } = options;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error("Seed must be an unsigned 32-bit integer.");
  for (const value of [lossPercent, duplicatePercent]) {
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Rates must be between 0 and 100.");
  }
  const bytes = 65536, blockBytes = 512, window = 16, maxFrames = 1536;
  const dataRandom = splitmix32(seed), channelRandom = splitmix32(seed ^ 0x7f4a7c15);
  const payload = Uint8Array.from({ length: bytes }, () => dataRandom() & 255);
  const encoder = new LTEncoder(payload, blockBytes, seed);
  const decoder = new LTDecoder(encoder.k, blockBytes, seed, bytes);
  let emitted = 0, dropped = 0, delivered = 0, duplicated = 0;
  while (!decoder.isComplete && emitted < maxFrames) {
    const pending: number[] = [];
    for (let n = 0; n < window && emitted < maxFrames; n++) {
      const seq = emitted++;
      if (channelRandom() / 2 ** 32 < lossPercent / 100) { dropped++; continue; }
      pending.push(seq);
      if (channelRandom() / 2 ** 32 < duplicatePercent / 100) { pending.push(seq); duplicated++; }
    }
    for (let i = pending.length - 1; i > 0; i--) {
      const j = channelRandom() % (i + 1);
      [pending[i], pending[j]] = [pending[j]!, pending[i]!];
    }
    for (const seq of pending) { decoder.addFrame(seq, encoder.encode(seq)); delivered++; }
    // Yield between windows so the interface remains responsive at severe loss.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  const restored = decoder.assemble();
  const hash = async (data: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(data).buffer)), b => b.toString(16).padStart(2, "0")).join("");
  const sourceSHA256 = await hash(payload), recoveredSHA256 = restored ? await hash(restored) : null;
  return {
    schema: "photonrelay-channel-trial-v1", kind: "software simulation; not camera throughput",
    options: { ...options }, bytes, blockBytes, reorderWindow: window, maxFrames,
    emitted, dropped, delivered, duplicated, solvedBlocks: decoder.solvedCount, totalBlocks: encoder.k,
    complete: decoder.isComplete, exactBytes: restored !== null && restored.length === payload.length && payload.every((b, i) => b === restored[i]),
    sourceSHA256, recoveredSHA256, hashMatch: recoveredSHA256 === sourceSHA256,
  };
}
