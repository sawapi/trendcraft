/**
 * Vortex Indicator (VI)
 *
 * Identifies the start of a new trend or confirms an ongoing trend.
 * Based on the concept of positive and negative trend movements.
 *
 * Calculation:
 * - VM+ = |High(i) - Low(i-1)|
 * - VM- = |Low(i) - High(i-1)|
 * - TR = max(High-Low, |High-PrevClose|, |Low-PrevClose|)
 * - VI+ = sum(VM+, period) / sum(TR, period)
 * - VI- = sum(VM-, period) / sum(TR, period)
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { VORTEX_META } from "../indicator-meta";

/**
 * Vortex options
 */
export type VortexOptions = {
  /** Period for Vortex calculation (default: 14) */
  period?: number;
};

/**
 * Vortex value
 */
export type VortexValue = {
  /** Positive vortex indicator (VI+) */
  viPlus: number | null;
  /** Negative vortex indicator (VI-) */
  viMinus: number | null;
};

/**
 * Calculate Vortex Indicator
 *
 * Interpretation:
 * - VI+ > VI-: Uptrend
 * - VI- > VI+: Downtrend
 * - VI+ crossing above VI-: Bullish signal
 * - VI- crossing above VI+: Bearish signal
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Vortex options
 * @returns Series of Vortex values
 *
 * @example
 * ```ts
 * const vortexData = vortex(candles, { period: 14 });
 * const { viPlus, viMinus } = vortexData[i].value;
 *
 * if (viPlus > viMinus) {
 *   // Bullish signal
 * }
 * ```
 */
export function vortex(
  candles: Candle[] | NormalizedCandle[],
  options: VortexOptions = {},
): Series<VortexValue> {
  const { period = 14 } = options;

  if (period < 1) throw new Error("Vortex period must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<VortexValue> = [];

  if (normalized.length === 0) return [];

  // First bar has no previous data
  result.push({
    time: normalized[0].time,
    value: { viPlus: null, viMinus: null },
  });

  // Pre-calculate VM+, VM-, TR arrays
  const vmPlus: number[] = [0]; // index 0 is unused
  const vmMinus: number[] = [0];
  const tr: number[] = [0];

  for (let i = 1; i < normalized.length; i++) {
    vmPlus.push(Math.abs(normalized[i].high - normalized[i - 1].low));
    vmMinus.push(Math.abs(normalized[i].low - normalized[i - 1].high));
    tr.push(
      Math.max(
        normalized[i].high - normalized[i].low,
        Math.abs(normalized[i].high - normalized[i - 1].close),
        Math.abs(normalized[i].low - normalized[i - 1].close),
      ),
    );
  }

  for (let i = 1; i < normalized.length; i++) {
    if (i < period) {
      result.push({
        time: normalized[i].time,
        value: { viPlus: null, viMinus: null },
      });
      continue;
    }

    let sumVmPlus = 0;
    let sumVmMinus = 0;
    let sumTr = 0;

    for (let j = i - period + 1; j <= i; j++) {
      sumVmPlus += vmPlus[j];
      sumVmMinus += vmMinus[j];
      sumTr += tr[j];
    }

    const viPlus = sumTr !== 0 ? sumVmPlus / sumTr : 0;
    const viMinus = sumTr !== 0 ? sumVmMinus / sumTr : 0;

    result.push({
      time: normalized[i].time,
      value: { viPlus, viMinus },
    });
  }

  return tagSeries(result, withLabelParams(VORTEX_META, [period]));
}
