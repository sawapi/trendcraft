/**
 * Ultimate Oscillator (UO) indicator
 *
 * Created by Larry Williams, the Ultimate Oscillator uses weighted averages
 * of three different timeframes to reduce false signals.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Ultimate Oscillator options
 */
export type UltimateOscillatorOptions = {
  /** Short period (default: 7) */
  period1?: number;
  /** Medium period (default: 14) */
  period2?: number;
  /** Long period (default: 28) */
  period3?: number;
};

/**
 * Calculate Ultimate Oscillator
 *
 * UO = 100 × (4×Avg1 + 2×Avg2 + Avg3) / (4+2+1)
 *
 * Where:
 * - Buying Pressure (BP) = Close - Min(Low, Previous Close)
 * - True Range (TR) = Max(High, Previous Close) - Min(Low, Previous Close)
 * - Avg_n = Sum(BP, n) / Sum(TR, n)
 *
 * Interpretation:
 * - Above 70: Overbought
 * - Below 30: Oversold
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Ultimate Oscillator options
 * @returns Series of UO values (0-100, null for insufficient data)
 *
 * @example
 * ```ts
 * const uo = ultimateOscillator(candles);
 * const uoCustom = ultimateOscillator(candles, { period1: 7, period2: 14, period3: 28 });
 * ```
 */
export function ultimateOscillator(
  candles: Candle[] | NormalizedCandle[],
  options: UltimateOscillatorOptions = {},
): Series<number | null> {
  const { period1 = 7, period2 = 14, period3 = 28 } = options;

  if (period1 < 1 || period2 < 1 || period3 < 1) {
    throw new Error("Ultimate Oscillator periods must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const maxPeriod = Math.max(period1, period2, period3);

  // Calculate BP and TR arrays
  const bp: number[] = [0];
  const tr: number[] = [0];

  for (let i = 1; i < normalized.length; i++) {
    const prevClose = normalized[i - 1].close;
    const low = normalized[i].low;
    const high = normalized[i].high;
    const close = normalized[i].close;

    bp.push(close - Math.min(low, prevClose));
    tr.push(Math.max(high, prevClose) - Math.min(low, prevClose));
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < maxPeriod) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    // Calculate averages for each period
    let bpSum1 = 0;
    let trSum1 = 0;
    let bpSum2 = 0;
    let trSum2 = 0;
    let bpSum3 = 0;
    let trSum3 = 0;

    for (let j = i - period1 + 1; j <= i; j++) {
      bpSum1 += bp[j];
      trSum1 += tr[j];
    }
    for (let j = i - period2 + 1; j <= i; j++) {
      bpSum2 += bp[j];
      trSum2 += tr[j];
    }
    for (let j = i - period3 + 1; j <= i; j++) {
      bpSum3 += bp[j];
      trSum3 += tr[j];
    }

    if (trSum1 === 0 || trSum2 === 0 || trSum3 === 0) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    const avg1 = bpSum1 / trSum1;
    const avg2 = bpSum2 / trSum2;
    const avg3 = bpSum3 / trSum3;

    const uo = (100 * (4 * avg1 + 2 * avg2 + avg3)) / 7;
    result.push({ time: normalized[i].time, value: uo });
  }

  return tagSeries(result, {
    overlay: false,
    label: "UO",
    yRange: [0, 100],
    referenceLines: [30, 70],
  });
}
