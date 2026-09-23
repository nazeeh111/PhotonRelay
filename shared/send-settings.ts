import { HEADER_LEN } from "./protocol";

// Start with a display-friendly stream. High-throughput settings remain
// available for device pairs that have been tested at those rates.
export const NO_SIGNAL_HINT_FRAME_BYTES = 500;
export const NO_SIGNAL_HINT_TX_FPS = 10;
export const DEFAULT_TX_FPS = 24;
export const DEFAULT_FRAME_BYTES = 1465;
export const TX_FPS_OPTIONS: readonly number[] = [10, 15, 20, 24, 30, 55, 60];
export const FRAME_BYTES_OPTIONS: readonly number[] = [500, 1000, 1465, 1850, 2331, 2953];

/** One small payload needs one small block, not a padded maximum-size QR. */
export function effectiveFrameBytes(configuredBytes: number, payloadBytes: number): number {
  if (!Number.isInteger(configuredBytes) || configuredBytes <= HEADER_LEN || configuredBytes > 2953) {
    throw new RangeError("frame bytes must be an integer between the header size and 2953");
  }
  if (!Number.isSafeInteger(payloadBytes) || payloadBytes <= 0) {
    throw new RangeError("payload bytes must be a positive safe integer");
  }
  return Math.min(configuredBytes, HEADER_LEN + payloadBytes);
}
