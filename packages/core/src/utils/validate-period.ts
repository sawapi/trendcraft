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

/**
 * Assert that a reset option is one of its keywords or a valid bar count.
 *
 * Session-anchored indicators take either a keyword (`"session"`, `"day"`,
 * `"rolling"`) or a fixed number of bars. An unknown keyword matched neither
 * branch, so the indicator never reset and silently averaged across every
 * session in the input.
 *
 * @param label - Human-readable option name, used verbatim in the error message
 * @param value - The option value to validate
 * @param keywords - The keywords this option accepts
 * @throws Error if `value` is neither one of `keywords` nor a valid period
 *
 * @example
 * ```ts
 * assertResetPeriod("VWAP resetPeriod", "session", ["session", "rolling"]); // ok
 * assertResetPeriod("VWAP resetPeriod", 78, ["session", "rolling"]); // ok
 * assertResetPeriod("VWAP resetPeriod", "week", ["session", "rolling"]); // throws
 * ```
 */
export function assertResetPeriod(
  label: string,
  value: unknown,
  keywords: readonly string[],
): void {
  if (typeof value === "number") {
    assertPeriod(label, value);
    return;
  }
  if (typeof value === "string" && keywords.includes(value)) return;
  const allowed = keywords.map((k) => JSON.stringify(k)).join(", ");
  throw new Error(`${label} must be one of ${allowed} or a bar count, got ${showValue(value)}`);
}

/**
 * Render a rejected option value for an error message without throwing.
 * JSON.stringify throws on a BigInt, prints a Symbol as `undefined` and a
 * boxed `new Number(5)` as a valid-looking `5`.
 */
function showValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "bigint") return `${value}n`;
  if (typeof value === "object" && value !== null) {
    // A Proxy or a throwing Symbol.toStringTag getter can throw here.
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "an object";
    }
  }
  // String() of a function would print its whole source.
  if (typeof value === "function") return "a function";
  return String(value);
}
