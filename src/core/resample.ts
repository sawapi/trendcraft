/**
 * Timeframe resampling utilities
 * Converts candles from one timeframe to another (e.g., daily to weekly)
 */

import type { NormalizedCandle, Timeframe, TimeframeShorthand } from "../types";

/**
 * Parse shorthand timeframe string to Timeframe object
 */
export function parseTimeframe(input: TimeframeShorthand | Timeframe): Timeframe {
  if (typeof input === "object") {
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

  const result = shorthandMap[input];
  if (!result) {
    throw new Error(`Unknown timeframe shorthand: ${input}`);
  }
  return result;
}

/**
 * Get the start of the period for grouping candles
 */
function getPeriodStart(time: number, timeframe: Timeframe): number {
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
      return time;
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
  timeframe: TimeframeShorthand | Timeframe
): NormalizedCandle[] {
  if (candles.length === 0) {
    return [];
  }

  const tf = parseTimeframe(timeframe);

  // Group candles by period
  const groups = new Map<number, NormalizedCandle[]>();

  for (const candle of candles) {
    const periodStart = getPeriodStart(candle.time, tf);

    if (!groups.has(periodStart)) {
      groups.set(periodStart, []);
    }
    groups.get(periodStart)!.push(candle);
  }

  // Aggregate each group and sort by time
  const result: NormalizedCandle[] = [];
  for (const [, groupCandles] of groups) {
    result.push(aggregateCandles(groupCandles));
  }

  return result.sort((a, b) => a.time - b.time);
}
