/**
 * Percentage Price Oscillator (PPO) indicator
 *
 * PPO is similar to MACD but expressed as a percentage, making it
 * easier to compare across different price levels.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * PPO options
 */
export type PpoOptions = {
  /** Fast EMA period (default: 12) */
  fastPeriod?: number;
  /** Slow EMA period (default: 26) */
  slowPeriod?: number;
  /** Signal line EMA period (default: 9) */
  signalPeriod?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * PPO value
 */
export type PpoValue = {
  /** PPO line value (percentage) */
  ppo: number;
  /** Signal line value */
  signal: number | null;
  /** Histogram (PPO - Signal) */
  histogram: number | null;
};

/**
 * Calculate Percentage Price Oscillator
 *
 * PPO = ((EMA_fast - EMA_slow) / EMA_slow) × 100
 * Signal = EMA(PPO, signalPeriod)
 * Histogram = PPO - Signal
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - PPO options
 * @returns Series of PPO values (null for insufficient data)
 *
 * @example
 * ```ts
 * const ppoData = ppo(candles);
 * // Buy when PPO crosses above signal
 * ```
 */
export function ppo(
  candles: Candle[] | NormalizedCandle[],
  options: PpoOptions = {},
): Series<PpoValue | null> {
  const { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9, source = "close" } = options;

  if (fastPeriod < 1 || slowPeriod < 1 || signalPeriod < 1) {
    throw new Error("PPO periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const prices = normalized.map((c) => getPrice(c, source));

  function computeEma(values: (number | null)[], period: number): (number | null)[] {
    const emaResult: (number | null)[] = [];
    const mult = 2 / (period + 1);
    let prev: number | null = null;
    let validCount = 0;
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      if (values[i] === null) {
        emaResult.push(null);
        continue;
      }

      validCount++;
      const val = values[i] as number;

      if (validCount < period) {
        sum += val;
        emaResult.push(null);
      } else if (validCount === period) {
        sum += val;
        prev = sum / period;
        emaResult.push(prev);
      } else {
        prev = val * mult + (prev ?? 0) * (1 - mult);
        emaResult.push(prev);
      }
    }

    return emaResult;
  }

  const fastEma = computeEma(prices, fastPeriod);
  const slowEma = computeEma(prices, slowPeriod);

  // Calculate PPO values
  const ppoValues: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (fastEma[i] === null || slowEma[i] === null || slowEma[i] === 0) {
      ppoValues.push(null);
    } else {
      ppoValues.push(
        (((fastEma[i] as number) - (slowEma[i] as number)) / (slowEma[i] as number)) * 100,
      );
    }
  }

  // Signal line (EMA of PPO)
  const signalValues = computeEma(ppoValues, signalPeriod);

  const result: Series<PpoValue | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (ppoValues[i] === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      const sig = signalValues[i];
      result.push({
        time: normalized[i].time,
        value: {
          ppo: ppoValues[i] as number,
          signal: sig,
          histogram: sig !== null ? (ppoValues[i] as number) - sig : null,
        },
      });
    }
  }

  return result;
}
