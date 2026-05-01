/**
 * Pure helpers for the Replay UI's cursor / backtest-slice math. Extracted
 * from App.tsx so the invariants (no look-ahead, clamp consistency, playhead
 * == last emitted bar) can be tested without React.
 */

/** Bounds the simulator's seedRatio so at least 5% / at most 95% of the
 *  history is loaded as seed (1 seed bar minimum, 1 queue bar minimum). The
 *  Replay anchor is clamped through this same bound so the cursor display and
 *  backtest slice always agree with what the simulator is replaying. */
export const SEED_RATIO_MIN = 0.05;
export const SEED_RATIO_MAX = 0.95;

export function clampedSeedEnd(candles: readonly unknown[], cursorIndex: number): number {
  const min = Math.max(1, Math.floor(candles.length * SEED_RATIO_MIN));
  const max = Math.max(min, Math.floor(candles.length * SEED_RATIO_MAX));
  return Math.max(min, Math.min(max, cursorIndex));
}

/**
 * Map (cursorIndex anchor, simulator progress) → integer queue index. Used by
 * the cursor display and the snapshot-backtest slice; both must derive from
 * this same function so they always agree with what the simulator replays.
 */
export function resolveQueueIdx(
  candles: readonly unknown[],
  cursorIndex: number,
  progress: number,
): { seedEnd: number; queueIdx: number } {
  const seedEnd = clampedSeedEnd(candles, cursorIndex);
  const queueLen = Math.max(0, candles.length - seedEnd);
  const queueIdx = Math.min(queueLen, Math.floor(progress * queueLen));
  return { seedEnd, queueIdx };
}

/**
 * Integer index of the *last emitted* candle in candle space. The simulator's
 * `getProgress()` reports the number of queued candles already advanced, so
 * `seedEnd + queueIdx - 1` is the most recent bar the user has seen. Subtract
 * 1 is critical: without it, an idle Replay (queueIdx = 0) would point at
 * `seedEnd`, which is the *first unseen* bar — exactly the look-ahead leak
 * Replay exists to prevent.
 */
export function lastEmittedIdx(
  candles: readonly unknown[],
  cursorIndex: number,
  progress: number,
): number {
  const { seedEnd, queueIdx } = resolveQueueIdx(candles, cursorIndex, progress);
  return Math.max(0, Math.min(candles.length - 1, seedEnd + queueIdx - 1));
}
