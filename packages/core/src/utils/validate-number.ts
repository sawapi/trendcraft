/**
 * Shared validation for real-valued indicator options: multipliers, factors,
 * thresholds and percentages.
 *
 * A comparison with `NaN` is always false, so a guard such as
 * `if (multiplier <= 0) throw ...` lets `NaN` through, and `Infinity` passes
 * any lower bound. Either value then runs on and turns the output into `NaN`
 * or an unbounded band rather than failing. Every helper here therefore
 * rejects non-finite values first, as TA-Lib's range checks do, and then
 * applies the option's own domain.
 *
 * Bar counts and other integer options use `assertPeriod` instead.
 */

/**
 * Assert that a real-valued option is a finite number.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is `NaN`, `±Infinity` or not a number
 *
 * @example
 * ```ts
 * assertFinite("S/R zones seed", 42); // ok
 * assertFinite("S/R zones seed", Number.NaN); // throws: must be a finite number
 * ```
 */
export function assertFinite(label: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

/**
 * Assert that an option is an integer of any sign, such as a random seed.
 *
 * A seed is truncated to 32 bits before use, so `42` and `42.9` would give the
 * same stream; rejecting the fraction keeps that from passing unnoticed.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is not an integer
 *
 * @example
 * ```ts
 * assertInteger("HMM seed", 42); // ok
 * assertInteger("HMM seed", 42.5); // throws: must be an integer
 * ```
 */
export function assertInteger(label: string, value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
}

/**
 * Assert that a decay factor lies strictly between 0 and 1.
 *
 * An exponentially weighted estimate `v = λ·v + (1 − λ)·x` stops updating at
 * λ = 1 and forgets everything but the last value at λ = 0, so neither end is
 * a usable decay. RiskMetrics uses 0.94 for daily data.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is not finite or not in (0, 1)
 *
 * @example
 * ```ts
 * assertDecayFactor("EWMA lambda", 0.94); // ok
 * assertDecayFactor("EWMA lambda", 1); // throws: must be between 0 and 1 (exclusive)
 * ```
 */
export function assertDecayFactor(label: string, value: number): void {
  assertFinite(label, value);
  if (value <= 0 || value >= 1) {
    throw new Error(`${label} must be between 0 and 1 (exclusive)`);
  }
}

/**
 * Assert that a real-valued option is a finite number greater than zero.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is not finite, or is zero or negative
 *
 * @example
 * ```ts
 * assertPositive("Keltner Channel multiplier", 2); // ok
 * assertPositive("Keltner Channel multiplier", 0); // throws: must be positive
 * ```
 */
export function assertPositive(label: string, value: number): void {
  assertFinite(label, value);
  if (value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

/**
 * Assert that a real-valued option is a finite number no smaller than zero.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is not finite, or is negative
 *
 * @example
 * ```ts
 * assertNonNegative("minGapPercent", 0); // ok
 * assertNonNegative("minGapPercent", -1); // throws: must be non-negative
 * ```
 */
export function assertNonNegative(label: string, value: number): void {
  assertFinite(label, value);
  if (value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

/**
 * Assert that a rate of return is a finite number greater than -1 (-100%).
 *
 * A return of -100% or less has no meaning, and an annual rate at or below it
 * cannot be de-annualised: `(1 + r) ** (1 / n)` is `NaN` for `r < -1`.
 * Negative rates above -1 stay valid.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @throws Error if `value` is not finite, or is -1 or less
 *
 * @example
 * ```ts
 * assertRate("sharpeFromReturns riskFree", -0.005); // ok
 * assertRate("sharpeFromReturns riskFree", -1); // throws: must be greater than -1
 * ```
 */
export function assertRate(label: string, value: number): void {
  assertFinite(label, value);
  if (value <= -1) {
    throw new Error(`${label} must be greater than -1`);
  }
}

/**
 * Assert that a real-valued option is a finite number in `[min, max]`.
 *
 * @param label - Human-readable option name, used verbatim in the message
 * @param value - The option value to validate
 * @param min - Smallest acceptable value (inclusive)
 * @param max - Largest acceptable value (inclusive)
 * @throws Error if `value` is not finite or falls outside the range
 *
 * @example
 * ```ts
 * assertInRange("T3 vFactor", 0.7, 0, 1); // ok
 * assertInRange("T3 vFactor", 1.5, 0, 1); // throws: must be between 0 and 1
 * ```
 */
export function assertInRange(label: string, value: number, min: number, max: number): void {
  assertFinite(label, value);
  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}
