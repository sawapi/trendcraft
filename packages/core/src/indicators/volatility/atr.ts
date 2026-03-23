/**
 * Average True Range (ATR) indicator
 * Uses Wilder's smoothing method
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { AtrOptions, Candle, NormalizedCandle, Series } from "../../types";

/**
 * Calculate Average True Range using Wilder's method
 *
 * True Range = max(
 *   High - Low,
 *   |High - Previous Close|,
 *   |Low - Previous Close|
 * )
 *
 * ATR = Wilder's smoothed average of True Range
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ATR options (period=14)
 * @returns Series of ATR values
 *
 * @example
 * ```ts
 * const atr14 = atr(candles);
 * const atr7 = atr(candles, { period: 7 });
 * ```
 */
export function atr(
  candles: Candle[] | NormalizedCandle[],
  options: AtrOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("ATR period must be at least 1");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // Calculate True Range for each candle
  // TA-Lib skips index 0 (TR requires previous close), so TR starts at index 1
  const trueRanges: number[] = new Array(normalized.length).fill(0);

  for (let i = 1; i < normalized.length; i++) {
    const current = normalized[i];
    const prevClose = normalized[i - 1].close;
    trueRanges[i] = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose),
    );
  }

  // Calculate ATR using Wilder's smoothing
  // First ATR = SMA of TR[1..period] (period values starting from index 1)
  // Output at index = period (TA-Lib lookback = period)
  let prevAtr: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      // Not enough data (indices 0..period-1 are null)
      result.push({ time: normalized[i].time, value: null });
    } else if (i === period) {
      // First ATR: SMA of TR[1..period]
      let sum = 0;
      for (let j = 1; j <= period; j++) {
        sum += trueRanges[j];
      }
      prevAtr = sum / period;
      result.push({ time: normalized[i].time, value: prevAtr });
    } else {
      // Wilder's smoothing: ATR = ((Previous ATR * (period - 1)) + Current TR) / period
      prevAtr = (prevAtr ?? 0) * (period - 1) + trueRanges[i];
      prevAtr = prevAtr / period;
      result.push({ time: normalized[i].time, value: prevAtr });
    }
  }

  return tagSeries(result, { pane: "sub", label: "ATR" });
}
