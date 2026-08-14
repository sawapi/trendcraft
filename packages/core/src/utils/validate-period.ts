/**
 * Shared validation for integer-valued "period" style indicator options.
 *
 * Window lengths, lookbacks and smoothing counts are bar counts: they index
 * candle arrays, so only positive integers are meaningful. Accepting a
 * fractional or non-finite value does not merely produce a slightly different
 * number — it silently changes the indicator. A fractional period makes the
 * `i === period` seed branch of the Wilder family unreachable and a `NaN`
 * period makes the `i < period - 1` warm-up guard false for every bar, so the
 * output keeps its expected shape while meaning something else entirely.
 *
 * This is the single owner of that rule for the batch indicators. The
 * incremental engine enforces the same rule through `requireParam` in
 * `indicators/incremental/state-contract.ts`; the two surfaces must agree on
 * which values are acceptable, even though they word their errors differently.
 */

/**
 * Assert that a period-like option is an integer no smaller than `min`.
 *
 * Checks the lower bound before integrality so that the messages match the
 * moving-average family, which has always validated in that order. Values that
 * cannot be compared (`NaN`) or that have no integer representation
 * (`Infinity`) fall through the bound check and are rejected as non-integers.
 *
 * @param label - Human-readable option name, used verbatim in the error message
 *   (e.g. `"ATR period"`, `"kPeriod"`)
 * @param value - The option value to validate
 * @param min - Smallest acceptable value (default 1)
 * @throws Error if `value` is below `min`, fractional, non-finite, or not a number
 *
 * @example
 * ```ts
 * assertPeriod("ATR period", 14); // ok
 * assertPeriod("ATR period", 14.5); // throws: ATR period must be an integer
 * assertPeriod("ATR period", 0); // throws: ATR period must be at least 1
 * assertPeriod("Choppiness Index period", 1, 2); // throws: must be at least 2
 * ```
 */
export function assertPeriod(label: string, value: number, min = 1): void {
  if (value < min) {
    throw new Error(`${label} must be at least ${min}`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}
