/**
 * Data normalization utilities
 */

import type { Candle, NormalizedCandle, PriceSource } from "../types";
import { priceSourceError } from "../utils/validate-price-source";
import type { ValidationOptions, ValidationResult } from "../validation/types";
import { validateCandles } from "../validation/validate";
import { compareTimeNonFiniteLast } from "./compare-time";

/**
 * Convert time value to epoch milliseconds
 *
 * Heuristic for numeric timestamps:
 * - Values < 1e10 are treated as Unix seconds (covers up to ~2286)
 * - Values >= 1e10 and < 1e13 are treated as Unix milliseconds
 * - Values >= 1e13 are treated as microseconds and converted to ms
 */
export function normalizeTime(time: number | string): number {
  if (typeof time === "number") {
    // Unix seconds: < 1e10 (covers dates up to ~2286-11-20)
    if (time < 1e10) {
      return time * 1000;
    }
    // Microseconds: >= 1e13 (e.g., 1703500800000000)
    if (time >= 1e13) {
      return Math.floor(time / 1000);
    }
    // Milliseconds: 1e10 <= time < 1e13
    return time;
  }

  // Parse ISO string
  const parsed = Date.parse(time);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid time format: ${time}`);
  }
  return parsed;
}

/**
 * Normalize a single candle
 */
export function normalizeCandle(candle: Candle): NormalizedCandle {
  return {
    time: normalizeTime(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

const CANDLE_FIELDS = ["time", "open", "high", "low", "close", "volume"] as const;

/**
 * What {@link assertFiniteCandles} last checked in an array: its length and
 * its first and last candle objects. Indicators call one another and
 * conditions run once per bar on the same array, so without this every
 * nested or per-bar call would scan the whole input again.
 *
 * The next call scans only appended bars when the first and last checked
 * candles are still in place, and the whole array otherwise. That covers
 * the usual live patterns: appending a bar, a fixed-size rolling window
 * (shift and push), and replacing the forming bar with a new object. A
 * candle modified in place, or replaced anywhere but the first or last
 * position, is not re-checked.
 */
type CheckedSpan = {
  length: number;
  first: NormalizedCandle | undefined;
  last: NormalizedCandle | undefined;
};
const checkedSpans = new WeakMap<readonly NormalizedCandle[], CheckedSpan>();

function rememberChecked(candles: readonly NormalizedCandle[]): void {
  checkedSpans.set(candles, {
    length: candles.length,
    first: candles[0],
    last: candles[candles.length - 1],
  });
}

/** How many leading candles are known to be checked already. */
function checkedPrefixLength(candles: readonly NormalizedCandle[]): number {
  const span = checkedSpans.get(candles);
  if (span === undefined || candles.length < span.length) return 0;
  if (span.length === 0) return 0;
  if (candles[0] !== span.first || candles[span.length - 1] !== span.last) return 0;
  return span.length;
}

/** The field that makes a candle non-finite, or null if it is finite. */
function nonFiniteField(candle: NormalizedCandle): (typeof CANDLE_FIELDS)[number] | null {
  // One expression on the common path; the loop below only names the field.
  if (
    Number.isFinite(candle.time) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    Number.isFinite(candle.volume)
  ) {
    return null;
  }
  for (const field of CANDLE_FIELDS) {
    if (!Number.isFinite(candle[field])) return field;
  }
  return null;
}

/**
 * Reject a candle whose time, prices or volume are not finite numbers.
 *
 * One `NaN` close used to poison every running-sum and recursive indicator
 * from that bar on (SMA, EMA, ATR), while RSI counted the bar as unchanged
 * and kept printing plausible values. A non-finite time left the series
 * unsorted. TA-Lib leaves the check to its callers, on the grounds that
 * replacing a `NaN` "feels like hiding a problem": a `NaN` should make you
 * ask why it is there. Rejecting it at the boundary is that question asked
 * up front.
 *
 * @param candle - The candle to check
 * @param index - Its position in the input, for the message
 * @throws Error naming the bar and the field
 */
export function assertFiniteCandle(candle: NormalizedCandle, index?: number): void {
  const field = nonFiniteField(candle);
  if (field !== null) {
    const where = index === undefined ? "candle" : `candle ${index}`;
    throw new Error(`${where} has a non-finite ${field} (${String(candle[field])})`);
  }
}

/**
 * Reject an array containing a candle with a non-finite time, price or
 * volume. See {@link assertFiniteCandle}. A call on an array checked
 * before scans only appended bars, or the whole array if its first or last
 * checked candle was replaced.
 */
export function assertFiniteCandles(candles: readonly NormalizedCandle[]): void {
  const from = checkedPrefixLength(candles);
  if (from === candles.length && from > 0) return;
  for (let i = from; i < candles.length; i++) {
    assertFiniteCandle(candles[i], i);
  }
  rememberChecked(candles);
}

/**
 * `candles.slice(0, end)` for a caller that evaluates a prefix every bar.
 * A prefix of a checked array is checked too, so it is not scanned again.
 */
export function checkedPrefix(
  candles: readonly NormalizedCandle[],
  end: number,
): NormalizedCandle[] {
  const prefix = candles.slice(0, end);
  if (prefix.length > 0 && checkedPrefixLength(candles) >= prefix.length) {
    rememberChecked(prefix);
  }
  return prefix;
}

/**
 * Normalize times and sort, without checking that values are finite. For the
 * data validator, which must report bad rows rather than throw on them. Rows
 * whose time is not finite go last ({@link compareTimeNonFiniteLast}).
 */
export function normalizeCandlesUnchecked(candles: Candle[]): NormalizedCandle[] {
  return candles
    .map((c) => {
      // A time that cannot be parsed (a bad string, a missing field) becomes
      // NaN, which the validator reports, rather than throwing here.
      try {
        return normalizeCandle(c);
      } catch {
        return { ...normalizeCandle({ ...c, time: 0 }), time: Number.NaN };
      }
    })
    .sort(compareTimeNonFiniteLast);
}

/**
 * Normalize an array of candles and sort by time ascending.
 *
 * @throws Error if a candle has a non-finite time, price or volume
 */
export function normalizeCandles(candles: Candle[]): NormalizedCandle[] {
  const normalized = candles.map(normalizeCandle);
  // Before sorting: a NaN time would leave the sort order undefined.
  assertFiniteCandles(normalized);
  return normalized.sort((a, b) => a.time - b.time);
}

/**
 * Return candles in normalized form, checking that every value is finite.
 *
 * The entry point every batch function uses: it normalizes when the times
 * are not epoch milliseconds yet, and checks the values either way, since
 * already-normalized input skips {@link normalizeCandles}.
 *
 * @throws Error if a candle has a non-finite time, price or volume
 */
export function ensureNormalized(candles: Candle[] | NormalizedCandle[]): NormalizedCandle[] {
  if (isNormalized(candles)) {
    assertFiniteCandles(candles);
    return candles;
  }
  return normalizeCandles(candles);
}

/**
 * Extract price value from candle based on source type
 */
export function getPrice(candle: NormalizedCandle, source: PriceSource): number {
  switch (source) {
    case "open":
      return candle.open;
    case "high":
      return candle.high;
    case "low":
      return candle.low;
    case "close":
      return candle.close;
    case "volume":
      return candle.volume;
    case "hl2":
      return (candle.high + candle.low) / 2;
    case "hlc3":
      return (candle.high + candle.low + candle.close) / 3;
    case "ohlc4":
      return (candle.open + candle.high + candle.low + candle.close) / 4;
    default:
      // Unreachable for a typed caller; a bad runtime value used to read the close.
      throw priceSourceError("getPrice source", source);
  }
}

/**
 * Extract price series from candles
 */
export function getPriceSeries(candles: NormalizedCandle[], source: PriceSource): number[] {
  return candles.map((c) => getPrice(c, source));
}

/**
 * Check if candles are already normalized (time is a number)
 *
 * Use this to avoid redundant normalization when candles may have already been normalized.
 *
 * "Numeric" is not enough on its own: {@link normalizeTime} treats a number
 * below 1e10 as Unix *seconds* and one at or above 1e13 as microseconds, so
 * accepting any number here declared second-stamped candles — the shape most
 * exchange REST APIs return — already normalized and skipped the conversion.
 * Every downstream `Math.floor(time / 86_400_000)` day bucket then advanced
 * only once every 2.7 years, so session VWAP/TWAP/opening ranges never reset
 * and `detectSessions` found nothing, with no error anywhere. The check is
 * therefore magnitude-aware, matching the range `normalizeTime` leaves
 * untouched; normalizing an already-normalized array is a no-op regardless.
 *
 * @param candles - Array of candles to check
 * @returns true if candles already carry epoch-millisecond times
 *
 * @example
 * ```ts
 * const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
 * ```
 */
export function isNormalized(
  candles: Candle[] | NormalizedCandle[],
): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  const time = candles[0].time;
  return typeof time === "number" && time >= 1e10 && time < 1e13;
}

/**
 * Normalize candles and optionally validate data quality
 *
 * Combines normalization with validation in a single call.
 * When validation options are provided, runs all enabled checks
 * and returns cleaned candles if autoClean is enabled.
 *
 * @param candles - Raw candle array to normalize
 * @param validation - Optional validation options
 * @returns Normalized candles and optional validation result
 *
 * @example
 * ```ts
 * const { candles, validation } = normalizeAndValidate(rawCandles, {
 *   gaps: true,
 *   duplicates: true,
 *   autoClean: true,
 * });
 * if (validation && !validation.valid) {
 *   console.warn("Data quality issues found:", validation.errors);
 * }
 * ```
 */
export function normalizeAndValidate(
  candles: Candle[],
  validation?: ValidationOptions,
): { candles: NormalizedCandle[]; validation?: ValidationResult } {
  // Without validation options this is plain normalization, which rejects
  // non-finite values. With them, the validator reports those values as
  // findings instead, so it gets the candles unchecked.
  if (!validation) return { candles: normalizeCandles(candles) };
  const normalized = normalizeCandlesUnchecked(candles);
  const result = validateCandles(normalized, validation);
  return {
    candles: result.cleanedCandles ?? normalized,
    validation: result,
  };
}
