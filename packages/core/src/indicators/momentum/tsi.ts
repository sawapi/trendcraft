/**
 * True Strength Index (TSI) indicator
 *
 * TSI is a momentum oscillator that uses double smoothing of price changes
 * to filter out market noise and show underlying strength.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * TSI options
 */
export type TsiOptions = {
  /** Long smoothing period (default: 25) */
  longPeriod?: number;
  /** Short smoothing period (default: 13) */
  shortPeriod?: number;
  /** Signal line period (default: 7) */
  signalPeriod?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * TSI value
 */
export type TsiValue = {
  /** TSI line value */
  tsi: number;
  /** Signal line value */
  signal: number | null;
};

/**
 * Calculate True Strength Index
 *
 * TSI = 100 × EMA(EMA(momentum, long), short) / EMA(EMA(|momentum|, long), short)
 * Signal = EMA(TSI, signalPeriod)
 *
 * Where momentum = close - previous close
 *
 * Interpretation:
 * - Positive TSI: Bullish momentum
 * - Negative TSI: Bearish momentum
 * - Signal crossovers for entry/exit
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - TSI options
 * @returns Series of TSI values (null for insufficient data)
 *
 * @example
 * ```ts
 * const tsiData = tsi(candles);
 * // Buy when TSI crosses above signal
 * // Sell when TSI crosses below signal
 * ```
 */
export function tsi(
  candles: Candle[] | NormalizedCandle[],
  options: TsiOptions = {},
): Series<TsiValue | null> {
  const { longPeriod = 25, shortPeriod = 13, signalPeriod = 7, source = "close" } = options;

  if (longPeriod < 1 || shortPeriod < 1 || signalPeriod < 1) {
    throw new Error("TSI periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<TsiValue | null> = [];

  // Helper to compute EMA of an array
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

  // Calculate momentum and absolute momentum
  const prices = normalized.map((c) => getPrice(c, source));
  const momentum: (number | null)[] = [null];
  const absMomentum: (number | null)[] = [null];

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    momentum.push(diff);
    absMomentum.push(Math.abs(diff));
  }

  // Double smooth momentum: EMA(EMA(momentum, long), short)
  const ema1Momentum = computeEma(momentum, longPeriod);
  const doubleMomentum = computeEma(ema1Momentum, shortPeriod);

  // Double smooth absolute momentum
  const ema1AbsMomentum = computeEma(absMomentum, longPeriod);
  const doubleAbsMomentum = computeEma(ema1AbsMomentum, shortPeriod);

  // Calculate TSI values
  const tsiValues: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    if (doubleMomentum[i] === null || doubleAbsMomentum[i] === null || doubleAbsMomentum[i] === 0) {
      tsiValues.push(null);
    } else {
      tsiValues.push(100 * ((doubleMomentum[i] as number) / (doubleAbsMomentum[i] as number)));
    }
  }

  // Calculate signal line (EMA of TSI)
  const signalLine = computeEma(tsiValues, signalPeriod);

  for (let i = 0; i < normalized.length; i++) {
    if (tsiValues[i] === null) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      result.push({
        time: normalized[i].time,
        value: {
          tsi: tsiValues[i] as number,
          signal: signalLine[i],
        },
      });
    }
  }

  return tagSeries(result, { pane: "sub", label: "TSI", referenceLines: [0] });
}
