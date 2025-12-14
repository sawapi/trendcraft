/**
 * Stochastic RSI (StochRSI)
 * Applies Stochastic oscillator formula to RSI values
 * More sensitive than regular RSI
 */

import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { rsi } from "./rsi";

/**
 * StochRSI result values
 */
export type StochRsiValue = {
  /** Raw StochRSI value (0-100) */
  stochRsi: number | null;
  /** %K line - smoothed StochRSI */
  k: number | null;
  /** %D line - signal line (SMA of %K) */
  d: number | null;
};

/**
 * Options for StochRSI calculation
 */
export type StochRsiOptions = {
  /** Period for RSI calculation (default: 14) */
  rsiPeriod?: number;
  /** Period for Stochastic calculation on RSI (default: 14) */
  stochPeriod?: number;
  /** Period for %K smoothing (default: 3) */
  kPeriod?: number;
  /** Period for %D (signal line) smoothing (default: 3) */
  dPeriod?: number;
};

/**
 * Calculate Stochastic RSI
 *
 * StochRSI applies the Stochastic oscillator formula to RSI values
 * instead of price, making it more sensitive to overbought/oversold conditions.
 *
 * Calculation:
 * 1. Calculate RSI over rsiPeriod
 * 2. StochRSI = (RSI - min(RSI)) / (max(RSI) - min(RSI)) * 100
 *    where min/max are over stochPeriod
 * 3. %K = SMA(StochRSI, kPeriod)
 * 4. %D = SMA(%K, dPeriod)
 *
 * Trading signals:
 * - StochRSI > 80: Overbought
 * - StochRSI < 20: Oversold
 * - %K crossing above %D: Bullish
 * - %K crossing below %D: Bearish
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - StochRSI options
 * @returns Series of StochRSI values
 *
 * @example
 * ```ts
 * const stochRsiData = stochRsi(candles, { rsiPeriod: 14, stochPeriod: 14 });
 * const { stochRsi, k, d } = stochRsiData[i].value;
 *
 * if (k < 20 && k > d) {
 *   // Oversold with bullish crossover
 * }
 * ```
 */
export function stochRsi(
  candles: Candle[] | NormalizedCandle[],
  options: StochRsiOptions = {}
): Series<StochRsiValue> {
  const { rsiPeriod = 14, stochPeriod = 14, kPeriod = 3, dPeriod = 3 } = options;

  if (rsiPeriod < 1) throw new Error("RSI period must be at least 1");
  if (stochPeriod < 1) throw new Error("Stoch period must be at least 1");
  if (kPeriod < 1) throw new Error("K period must be at least 1");
  if (dPeriod < 1) throw new Error("D period must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Step 1: Calculate RSI
  const rsiData = rsi(normalized, { period: rsiPeriod });
  const rsiValues = rsiData.map((d) => d.value);

  // Step 2: Calculate raw StochRSI
  const rawStochRsi: (number | null)[] = [];

  for (let i = 0; i < rsiValues.length; i++) {
    const currentRsi = rsiValues[i];

    // Need stochPeriod valid RSI values
    if (currentRsi === null || i < stochPeriod - 1) {
      rawStochRsi.push(null);
      continue;
    }

    // Find min and max RSI over stochPeriod
    let minRsi = Infinity;
    let maxRsi = -Infinity;
    let hasAllValues = true;

    for (let j = i - stochPeriod + 1; j <= i; j++) {
      const val = rsiValues[j];
      if (val === null) {
        hasAllValues = false;
        break;
      }
      if (val < minRsi) minRsi = val;
      if (val > maxRsi) maxRsi = val;
    }

    if (!hasAllValues) {
      rawStochRsi.push(null);
      continue;
    }

    // StochRSI = (RSI - minRSI) / (maxRSI - minRSI) * 100
    const range = maxRsi - minRsi;
    if (range === 0) {
      rawStochRsi.push(50); // No range, return middle value
    } else {
      rawStochRsi.push(((currentRsi - minRsi) / range) * 100);
    }
  }

  // Step 3: Calculate %K (SMA of raw StochRSI)
  const kValues = calculateSma(rawStochRsi, kPeriod);

  // Step 4: Calculate %D (SMA of %K)
  const dValues = calculateSma(kValues, dPeriod);

  // Build result
  const result: Series<StochRsiValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    result.push({
      time: normalized[i].time,
      value: {
        stochRsi: rawStochRsi[i],
        k: kValues[i],
        d: dValues[i],
      },
    });
  }

  return result;
}

/**
 * Calculate Simple Moving Average for nullable values
 */
function calculateSma(values: (number | null)[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;
    let hasNull = false;

    for (let j = i - period + 1; j <= i; j++) {
      if (values[j] === null) {
        hasNull = true;
        break;
      }
      sum += values[j]!;
      count++;
    }

    if (hasNull || count < period) {
      result.push(null);
    } else {
      result.push(sum / period);
    }
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
