/**
 * General statistics utilities — percentile, median, quartiles.
 *
 * Linear-interpolation percentile is used elsewhere in core (monte-carlo
 * confidence intervals, drawdown distribution analysis) and is now also
 * needed by post-optimization analytics (`computeParameterSensitivity`,
 * `safeZoneFromResults`) and by example apps (echarts-viewer's
 * `strategyDna`). Exposing one canonical implementation keeps every
 * consumer agreed on edge-case semantics (empty / single-element
 * inputs, non-mutation, sort cost) so a "p25 of these scores" call
 * means the same thing everywhere.
 *
 * @example
 * ```ts
 * import { percentile, median, quartiles } from "trendcraft";
 *
 * percentile([10, 20, 30], 50);          // 20
 * median([3, 1, 4, 1, 5, 9, 2, 6]);      // 3.5
 * const [q1, q2, q3] = quartiles(scores);
 * ```
 */

/**
 * Return the value at the given percentile (`0..100`) using linear
 * interpolation between adjacent sorted values.
 *
 * - Empty array → `0`. Callers that need a "no data" signal should
 *   guard `values.length` first.
 * - Single-element array → that element regardless of `p`.
 * - Sorts a copy of the input. The original array is not mutated.
 *
 * Algorithm: `idx = (p / 100) * (n - 1)`, then linearly interpolate
 * between `sorted[floor(idx)]` and `sorted[ceil(idx)]`.
 */
export function percentile(values: number[], p: number): number {
  if (!Number.isFinite(p) || p < 0 || p > 100) {
    throw new Error(`percentile: p must be a finite number in [0, 100], got ${p}`);
  }
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Convenience: `percentile(values, 50)`. */
export function median(values: number[]): number {
  return percentile(values, 50);
}

/**
 * Return `[Q1, Q2, Q3]` = `[p25, p50, p75]` from the input values.
 * Sorts internally once (cheaper than three separate `percentile`
 * calls on the same array).
 */
export function quartiles(values: number[]): [number, number, number] {
  if (values.length === 0) return [0, 0, 0];
  if (values.length === 1) return [values[0], values[0], values[0]];
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return [at(25), at(50), at(75)];
}
