/**
 * Moving Average Convergence Divergence (MACD) indicator
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, MacdOptions, MacdValue, NormalizedCandle, Series } from "../../types";
import { MACD_META } from "../indicator-meta";
import { ema } from "../moving-average/ema";

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 *
 * MACD Line = Fast EMA - Slow EMA
 * Signal Line = EMA of MACD Line
 * Histogram = MACD Line - Signal Line
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - MACD options (fastPeriod=12, slowPeriod=26, signalPeriod=9)
 * @returns Series of MACD values (macd, signal, histogram)
 *
 * @example
 * ```ts
 * const macdResult = macd(candles);
 * const macdCustom = macd(candles, { fastPeriod: 8, slowPeriod: 17, signalPeriod: 9 });
 * ```
 */
export function macd(
  candles: Candle[] | NormalizedCandle[],
  options: MacdOptions = {},
): Series<MacdValue> {
  const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9, source = "close" } = options;

  if (fastPeriod < 1 || slowPeriod < 1 || signalPeriod < 1) {
    throw new Error("MACD periods must be at least 1");
  }

  if (fastPeriod >= slowPeriod) {
    throw new Error("Fast period must be less than slow period");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate fast and slow EMAs
  const fastEma = ema(normalized, { period: fastPeriod, source });
  const slowEma = ema(normalized, { period: slowPeriod, source });

  // Calculate MACD line
  const macdLine: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const fast = fastEma[i].value;
    const slow = slowEma[i].value;
    if (fast === null || slow === null) {
      macdLine.push(null);
    } else {
      macdLine.push(fast - slow);
    }
  }

  // Calculate Signal line (EMA of MACD line)
  const signalLine = calculateSignalLine(macdLine, signalPeriod);

  // Build result
  const result: Series<MacdValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    const macdValue = macdLine[i];
    const signalValue = signalLine[i];
    const histogram = macdValue !== null && signalValue !== null ? macdValue - signalValue : null;

    result.push({
      time: normalized[i].time,
      value: {
        macd: macdValue,
        signal: signalValue,
        histogram,
      },
    });
  }

  return tagSeries(result, withLabelParams(MACD_META, [fastPeriod, slowPeriod, signalPeriod]));
}

/**
 * Calculate signal line (EMA of MACD values)
 */
function calculateSignalLine(macdLine: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);

  // Find first valid MACD value
  let firstValidIndex = -1;
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] !== null) {
      firstValidIndex = i;
      break;
    }
  }

  if (firstValidIndex === -1) {
    return macdLine.map(() => null);
  }

  let prevEma: number | null = null;
  let validCount = 0;

  for (let i = 0; i < macdLine.length; i++) {
    const value = macdLine[i];

    if (value === null) {
      result.push(null);
      continue;
    }

    validCount++;

    if (validCount < period) {
      result.push(null);
    } else if (validCount === period) {
      // First signal value is SMA of first `period` valid MACD values
      let sum = 0;
      let count = 0;
      for (let j = firstValidIndex; j <= i && count < period; j++) {
        const macdVal = macdLine[j];
        if (macdVal !== null) {
          sum += macdVal;
          count++;
        }
      }
      prevEma = sum / period;
      result.push(prevEma);
    } else {
      // EMA calculation
      prevEma = value * multiplier + (prevEma ?? 0) * (1 - multiplier);
      result.push(prevEma);
    }
  }

  return result;
}
