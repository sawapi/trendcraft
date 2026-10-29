/**
 * Timeframe resampling utilities
 * Converts candles from one timeframe to another (e.g., daily to weekly)
 */

import type { NormalizedCandle, Timeframe, TimeframeShorthand, TimeframeUnit } from "../types";
import { assertOneOf, keywordError, keywords } from "../utils/validate-keyword";
import { assertFiniteCandles } from "./normalize";

/** Every value `TimeframeUnit` allows. */
const TIMEFRAME_UNITS = keywords<TimeframeUnit>()(["minute", "hour", "day", "week", "month"]);

/** Every value `TimeframeShorthand` allows, in the order the error lists them. */
const TIMEFRAME_SHORTHANDS = keywords<TimeframeShorthand>()([
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
  "1w",
  "1M",
  "daily",
  "weekly",
  "monthly",
]);

/** 1970-01-05T00:00Z — the first Monday of the epoch, the reference for multi-week buckets. */
const MONDAY_EPOCH = 345_600_000;

/**
 * Parse shorthand timeframe string to Timeframe object
 */
export function parseTimeframe(input: TimeframeShorthand | Timeframe): Timeframe {
  if (typeof input === "object") {
    // An unknown unit used to leave every candle in its own period, so the
    // "resampled" series came back unchanged.
    assertOneOf("timeframe unit", input.unit, TIMEFRAME_UNITS);
    return input;
  }

  const shorthandMap: Record<TimeframeShorthand, Timeframe> = {
    "1m": { value: 1, unit: "minute" },
    "5m": { value: 5, unit: "minute" },
    "15m": { value: 15, unit: "minute" },
    "30m": { value: 30, unit: "minute" },
    "1h": { value: 1, unit: "hour" },
    "4h": { value: 4, unit: "hour" },
    "1d": { value: 1, unit: "day" },
    "1w": { value: 1, unit: "week" },
    "1M": { value: 1, unit: "month" },
    daily: { value: 1, unit: "day" },
    weekly: { value: 1, unit: "week" },
    monthly: { value: 1, unit: "month" },
  };

  // Own keys only: an inherited name such as "toString" used to return a
  // function as the timeframe.
  if (!(typeof input === "string" && Object.hasOwn(shorthandMap, input))) {
    throw keywordError("timeframe", input, TIMEFRAME_SHORTHANDS);
  }
  return shorthandMap[input];
}

/**
 * Get the start of the period for grouping candles
 *
 * @param time - Epoch milliseconds timestamp
 * @param timeframe - Target timeframe for period alignment
 * @returns Period start timestamp in epoch milliseconds
 */
export function getPeriodStart(time: number, timeframe: Timeframe): number {
  const date = new Date(time);

  switch (timeframe.unit) {
    case "minute": {
      const minutes = date.getUTCMinutes();
      const periodStart = Math.floor(minutes / timeframe.value) * timeframe.value;
      date.setUTCMinutes(periodStart, 0, 0);
      return date.getTime();
    }
    case "hour": {
      const hours = date.getUTCHours();
      const periodStart = Math.floor(hours / timeframe.value) * timeframe.value;
      date.setUTCHours(periodStart, 0, 0, 0);
      return date.getTime();
    }
    case "day": {
      date.setUTCHours(0, 0, 0, 0);
      if (timeframe.value > 1) {
        // For multi-day periods, align to epoch
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.floor(date.getTime() / dayMs);
        const periodStart = Math.floor(days / timeframe.value) * timeframe.value;
        return periodStart * dayMs;
      }
      return date.getTime();
    }
    case "week": {
      // Week starts on Monday (ISO standard)
      const day = date.getUTCDay();
      const diff = day === 0 ? 6 : day - 1; // Adjust so Monday = 0
      date.setUTCDate(date.getUTCDate() - diff);
      date.setUTCHours(0, 0, 0, 0);
      if (timeframe.value > 1) {
        // Multi-week periods count from a fixed Monday so that adjacent weeks
        // land in the same bucket. Without this, `value` was ignored outright
        // and a 2-week resample returned ordinary weekly candles.
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        const weeksSinceRef = Math.floor((date.getTime() - MONDAY_EPOCH) / weekMs);
        const periodStart = Math.floor(weeksSinceRef / timeframe.value) * timeframe.value;
        return MONDAY_EPOCH + periodStart * weekMs;
      }
      return date.getTime();
    }
    case "month": {
      date.setUTCDate(1);
      date.setUTCHours(0, 0, 0, 0);
      if (timeframe.value > 1) {
        // For multi-month periods
        const month = date.getUTCMonth();
        const periodStart = Math.floor(month / timeframe.value) * timeframe.value;
        date.setUTCMonth(periodStart);
      }
      return date.getTime();
    }
    default:
      throw keywordError("timeframe unit", timeframe.unit, TIMEFRAME_UNITS);
  }
}

/**
 * Aggregate multiple candles into a single candle
 */
function aggregateCandles(candles: NormalizedCandle[]): NormalizedCandle {
  if (candles.length === 0) {
    throw new Error("Cannot aggregate empty candle array");
  }

  const first = candles[0];
  const last = candles[candles.length - 1];

  return {
    time: first.time,
    open: first.open,
    high: Math.max(...candles.map((c) => c.high)),
    low: Math.min(...candles.map((c) => c.low)),
    close: last.close,
    volume: candles.reduce((sum, c) => sum + c.volume, 0),
  };
}

/**
 * Resample candles to a different timeframe
 *
 * @param candles - Source candles (must be normalized and sorted)
 * @param timeframe - Target timeframe
 * @returns Resampled candles
 *
 * @example
 * ```ts
 * // Convert daily candles to weekly
 * const weekly = resample(dailyCandles, 'weekly');
 *
 * // Convert 1-hour candles to 4-hour
 * const fourHour = resample(hourlyCandles, '4h');
 * ```
 */
export function resample(
  candles: NormalizedCandle[],
  timeframe: TimeframeShorthand | Timeframe,
): NormalizedCandle[] {
  assertFiniteCandles(candles);
  // Parsed first so an unknown timeframe is rejected even with no candles.
  const tf = parseTimeframe(timeframe);
  if (candles.length === 0) {
    return [];
  }

  // Group candles by period
  const groups = new Map<number, NormalizedCandle[]>();

  for (const candle of candles) {
    const periodStart = getPeriodStart(candle.time, tf);

    if (!groups.has(periodStart)) {
      groups.set(periodStart, []);
    }
    groups.get(periodStart)?.push(candle);
  }

  // Aggregate each group and sort by time
  const result: NormalizedCandle[] = [];
  for (const [, groupCandles] of groups) {
    result.push(aggregateCandles(groupCandles));
  }

  return result.sort((a, b) => a.time - b.time);
}
