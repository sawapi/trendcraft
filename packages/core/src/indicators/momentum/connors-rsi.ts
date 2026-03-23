/**
 * Connors RSI (CRSI) indicator
 *
 * A composite momentum oscillator combining three components:
 * 1. RSI of price
 * 2. RSI of up/down streak length
 * 3. Percent rank of ROC (Rate of Change)
 *
 * CRSI = (RSI(close, rsiPeriod) + RSI(streak, streakPeriod) + PercentRank(ROC(1), rocPeriod)) / 3
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { rsi } from "./rsi";

/**
 * Connors RSI options
 */
export type ConnorsRsiOptions = {
  /** RSI period for price (default: 3) */
  rsiPeriod?: number;
  /** RSI period for streak (default: 2) */
  streakPeriod?: number;
  /** Lookback period for ROC percent rank (default: 100) */
  rocPeriod?: number;
};

/**
 * Connors RSI value
 */
export type ConnorsRsiValue = {
  /** Composite Connors RSI (average of 3 components) */
  crsi: number | null;
  /** RSI of price */
  rsi: number | null;
  /** RSI of streak */
  streakRsi: number | null;
  /** Percent rank of 1-period ROC */
  rocPercentile: number | null;
};

/**
 * Calculate Connors RSI
 *
 * Components:
 * 1. RSI(close, rsiPeriod) — standard RSI of closing prices
 * 2. RSI(streak, streakPeriod) — RSI of consecutive up/down day streak
 * 3. PercentRank(ROC(1), rocPeriod) — percent rank of 1-day ROC over lookback
 *
 * CRSI = (Component1 + Component2 + Component3) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Connors RSI options
 * @returns Series of Connors RSI values
 *
 * @example
 * ```ts
 * const crsi = connorsRsi(candles); // Default (3, 2, 100)
 * const crsiCustom = connorsRsi(candles, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 });
 * ```
 */
export function connorsRsi(
  candles: Candle[] | NormalizedCandle[],
  options: ConnorsRsiOptions = {},
): Series<ConnorsRsiValue> {
  const { rsiPeriod = 3, streakPeriod = 2, rocPeriod = 100 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Component 1: RSI of price
  const priceRsi = rsi(normalized, { period: rsiPeriod });

  // Component 2: Calculate streak and RSI of streak
  // Streak: consecutive up days = positive count, consecutive down days = negative count
  const streaks: number[] = new Array(normalized.length).fill(0);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].close > normalized[i - 1].close) {
      streaks[i] = streaks[i - 1] > 0 ? streaks[i - 1] + 1 : 1;
    } else if (normalized[i].close < normalized[i - 1].close) {
      streaks[i] = streaks[i - 1] < 0 ? streaks[i - 1] - 1 : -1;
    } else {
      streaks[i] = 0;
    }
  }

  // Create synthetic candles from streaks to compute RSI
  const streakCandles: NormalizedCandle[] = normalized.map((c, i) => ({
    time: c.time,
    open: streaks[i],
    high: streaks[i],
    low: streaks[i],
    close: streaks[i],
    volume: 0,
  }));
  const streakRsiResult = rsi(streakCandles, { period: streakPeriod });

  // Component 3: Percent rank of 1-period ROC
  // ROC(1) = (close - prevClose) / prevClose * 100
  const roc1: (number | null)[] = new Array(normalized.length).fill(null);
  for (let i = 1; i < normalized.length; i++) {
    const prevClose = normalized[i - 1].close;
    if (prevClose !== 0) {
      roc1[i] = ((normalized[i].close - prevClose) / prevClose) * 100;
    }
  }

  // Percent rank: what percentage of values in the lookback are <= current value
  const percentRank: (number | null)[] = new Array(normalized.length).fill(null);
  for (let i = 1; i < normalized.length; i++) {
    const currentRoc = roc1[i];
    if (currentRoc === null) continue;

    // Need rocPeriod previous ROC values
    const lookbackStart = Math.max(1, i - rocPeriod);
    let count = 0;
    let lessOrEqual = 0;
    for (let j = lookbackStart; j < i; j++) {
      const rocJ = roc1[j];
      if (rocJ !== null) {
        count++;
        if (rocJ <= currentRoc) {
          lessOrEqual++;
        }
      }
    }

    if (count > 0) {
      percentRank[i] = (lessOrEqual / count) * 100;
    }
  }

  // Combine all three components
  const result: Series<ConnorsRsiValue> = [];
  for (let i = 0; i < normalized.length; i++) {
    const priceRsiVal = priceRsi[i]?.value ?? null;
    const streakRsiVal = streakRsiResult[i]?.value ?? null;
    const rocPctVal = percentRank[i];

    let crsiVal: number | null = null;
    if (priceRsiVal !== null && streakRsiVal !== null && rocPctVal !== null) {
      crsiVal = (priceRsiVal + streakRsiVal + rocPctVal) / 3;
    }

    result.push({
      time: normalized[i].time,
      value: {
        crsi: crsiVal,
        rsi: priceRsiVal,
        streakRsi: streakRsiVal,
        rocPercentile: rocPctVal,
      },
    });
  }

  return tagSeries(result, {
    overlay: false,
    label: "CRSI",
    yRange: [0, 100],
    referenceLines: [30, 70],
  });
}
