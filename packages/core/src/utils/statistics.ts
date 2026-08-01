/**
 * Shared statistical primitives
 *
 * Small helpers used by multiple modules (alpha-decay, correlation, etc.).
 */

/**
 * Log return of one step, with a defined answer for prices a logarithm is not
 * defined on.
 *
 * A price that is zero, negative, or not finite makes `Math.log` return
 * `-Infinity` or `NaN`. Feeding that into a recursive estimator poisons it for
 * the rest of the run, so such a step counts as a zero return instead: a bad
 * tick dampens the estimate rather than destroying it.
 *
 * Single owner for that rule — batch (`ewmaVolatilityFromCandles`) and
 * streaming (`createEwmaVolatility`) must agree bar for bar, and they only do
 * so while they share this decision.
 *
 * Two prices can each be usable and still produce a ratio that is not: the
 * quotient overflows to `Infinity` (or flushes to 0) once the two are ~1e308
 * apart, so the result is checked rather than the inputs alone. The ratio is
 * kept — computing `ln(current) - ln(previous)` instead would avoid the
 * overflow but lose precision on every ordinary bar, where the two logarithms
 * are nearly equal and cancel: on 12345.6789 → 12345.679 that form is about
 * 55x further from the true value than this one.
 *
 * @param previous - previous price
 * @param current - current price
 * @returns `ln(current / previous)`, or 0 if that is not a finite number
 *
 * @example
 * ```ts
 * logReturnOrZero(100, 101); // 0.00995...
 * logReturnOrZero(0, 101); // 0 — no return is defined from a zero price
 * logReturnOrZero(100, Number.POSITIVE_INFINITY); // 0
 * logReturnOrZero(Number.MIN_VALUE, Number.MAX_VALUE); // 0 — ratio overflows
 * ```
 */
export function logReturnOrZero(previous: number, current: number): number {
  if (!Number.isFinite(previous) || previous <= 0) return 0;
  if (!Number.isFinite(current) || current <= 0) return 0;
  const logReturn = Math.log(current / previous);
  return Number.isFinite(logReturn) ? logReturn : 0;
}

/**
 * Compute ranks for a numeric array, handling ties with average rank
 *
 * @param values - Array of numeric values
 * @returns Array of ranks (1-based, ties averaged)
 *
 * @example
 * ```ts
 * computeRanks([10, 30, 20]); // [1, 3, 2]
 * computeRanks([10, 10, 20]); // [1.5, 1.5, 3]
 * ```
 */
export function computeRanks(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}
