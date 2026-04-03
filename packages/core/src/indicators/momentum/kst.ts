/**
 * Know Sure Thing (KST) indicator
 *
 * Created by Martin Pring, KST is a momentum oscillator based on
 * the smoothed rate-of-change for four different timeframes.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * KST options
 */
export type KstOptions = {
  /** ROC periods (default: [10, 15, 20, 30]) */
  rocPeriods?: [number, number, number, number];
  /** SMA smoothing periods (default: [10, 10, 10, 15]) */
  smaPeriods?: [number, number, number, number];
  /** Weights for each ROC/SMA pair (default: [1, 2, 3, 4]) */
  weights?: [number, number, number, number];
  /** Signal line SMA period (default: 9) */
  signalPeriod?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * KST value
 */
export type KstValue = {
  /** KST line value */
  kst: number;
  /** Signal line value */
  signal: number | null;
};

/**
 * Calculate Know Sure Thing
 *
 * KST = w1×SMA(ROC(r1),s1) + w2×SMA(ROC(r2),s2) + w3×SMA(ROC(r3),s3) + w4×SMA(ROC(r4),s4)
 * Signal = SMA(KST, signalPeriod)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - KST options
 * @returns Series of KST values (null for insufficient data)
 *
 * @example
 * ```ts
 * const kstData = kst(candles);
 * // Buy when KST crosses above signal
 * // Sell when KST crosses below signal
 * ```
 */
export function kst(
  candles: Candle[] | NormalizedCandle[],
  options: KstOptions = {},
): Series<KstValue | null> {
  const {
    rocPeriods = [10, 15, 20, 30],
    smaPeriods = [10, 10, 10, 15],
    weights = [1, 2, 3, 4],
    signalPeriod = 9,
    source = "close",
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<KstValue | null> = [];

  // Calculate ROC for each period
  const prices = normalized.map((c) => getPrice(c, source));
  const rocArrays: (number | null)[][] = rocPeriods.map((rocPeriod) => {
    const roc: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < rocPeriod || prices[i - rocPeriod] === 0) {
        roc.push(null);
      } else {
        roc.push(((prices[i] - prices[i - rocPeriod]) / prices[i - rocPeriod]) * 100);
      }
    }
    return roc;
  });

  // Calculate SMA of each ROC
  const smoothedRocs: (number | null)[][] = rocArrays.map((rocArr, idx) => {
    const smaPeriod = smaPeriods[idx];
    const smoothed: (number | null)[] = [];

    for (let i = 0; i < rocArr.length; i++) {
      if (rocArr[i] === null) {
        smoothed.push(null);
        continue;
      }

      // Check if we have enough valid ROC values
      let sum = 0;
      let valid = true;
      for (let j = i - smaPeriod + 1; j <= i; j++) {
        if (j < 0 || rocArr[j] === null) {
          valid = false;
          break;
        }
        sum += rocArr[j] as number;
      }

      smoothed.push(valid ? sum / smaPeriod : null);
    }

    return smoothed;
  });

  // Calculate KST values
  const kstValues: (number | null)[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const vals = smoothedRocs.map((s) => s[i]);
    if (vals.some((v) => v === null)) {
      kstValues.push(null);
    } else {
      let kstVal = 0;
      for (let j = 0; j < 4; j++) {
        kstVal += weights[j] * (vals[j] as number);
      }
      kstValues.push(kstVal);
    }
  }

  // Calculate signal line (SMA of KST)
  for (let i = 0; i < normalized.length; i++) {
    if (kstValues[i] === null) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Signal line
    let signalSum = 0;
    let signalValid = true;
    for (let j = i - signalPeriod + 1; j <= i; j++) {
      if (j < 0 || kstValues[j] === null) {
        signalValid = false;
        break;
      }
      signalSum += kstValues[j] as number;
    }

    result.push({
      time: normalized[i].time,
      value: {
        kst: kstValues[i] as number,
        signal: signalValid ? signalSum / signalPeriod : null,
      },
    });
  }

  return tagSeries(result, { overlay: false, label: "KST", referenceLines: [0] });
}
