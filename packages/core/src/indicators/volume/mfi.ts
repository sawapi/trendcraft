/**
 * MFI (Money Flow Index)
 * Volume-weighted RSI that measures buying and selling pressure
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { MFI_META } from "../indicator-meta";

/**
 * Options for MFI calculation
 */
export type MfiOptions = {
  /** Period for MFI calculation (default: 14) */
  period?: number;
};

/**
 * Calculate MFI (Money Flow Index)
 *
 * MFI is essentially a volume-weighted RSI. It uses both price and volume
 * to measure buying and selling pressure.
 *
 * Calculation:
 * 1. Typical Price = (High + Low + Close) / 3
 * 2. Raw Money Flow = Typical Price × Volume
 * 3. Positive Money Flow = sum of Raw Money Flow when TP > previous TP
 * 4. Negative Money Flow = sum of Raw Money Flow when TP < previous TP
 * 5. Money Flow Ratio = Positive Money Flow / Negative Money Flow
 * 6. MFI = 100 - (100 / (1 + Money Flow Ratio))
 *
 * Trading signals:
 * - MFI > 80: Overbought
 * - MFI < 20: Oversold
 * - Divergence from price may signal reversal
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - MFI options
 * @returns Series of MFI values (0-100)
 *
 * @example
 * ```ts
 * const mfiData = mfi(candles, { period: 14 });
 * if (mfiData[i].value < 20) {
 *   // Oversold - potential buy signal
 * }
 * ```
 */
export function mfi(
  candles: Candle[] | NormalizedCandle[],
  options: MfiOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("MFI period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate Typical Price for each candle
  const typicalPrices: number[] = normalized.map((c) => (c.high + c.low + c.close) / 3);

  // Calculate Raw Money Flow for each candle
  const rawMoneyFlow: number[] = normalized.map((c, i) => typicalPrices[i] * c.volume);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    // Need at least period + 1 candles to calculate MFI
    // (period for the sum, plus 1 for the comparison)
    if (i < period) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    // Sum positive and negative money flows over the period
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positiveFlow += rawMoneyFlow[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeFlow += rawMoneyFlow[j];
      }
      // If equal, neither positive nor negative
    }

    let mfiValue: number;

    if (negativeFlow === 0) {
      // All positive flow
      mfiValue = 100;
    } else if (positiveFlow === 0) {
      // All negative flow
      mfiValue = 0;
    } else {
      const moneyFlowRatio = positiveFlow / negativeFlow;
      mfiValue = 100 - 100 / (1 + moneyFlowRatio);
    }

    result.push({ time: normalized[i].time, value: mfiValue });
  }

  return tagSeries(result, withLabelParams(MFI_META, [period]));
}
