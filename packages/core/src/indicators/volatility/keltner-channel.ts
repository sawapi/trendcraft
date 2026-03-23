/**
 * Keltner Channel
 *
 * A volatility-based envelope indicator using EMA and ATR.
 * Originally developed by Chester Keltner, modernized by Linda Bradford Raschke.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { ema } from "../moving-average/ema";
import { atr } from "./atr";

/**
 * Keltner Channel options
 */
export type KeltnerChannelOptions = {
  /** EMA period for middle band (default: 20) */
  emaPeriod?: number;
  /** ATR period for band width (default: 10) */
  atrPeriod?: number;
  /** ATR multiplier for band distance (default: 2) */
  multiplier?: number;
};

/**
 * Keltner Channel value
 */
export type KeltnerChannelValue = {
  /** Upper band (middle + multiplier × ATR) */
  upper: number | null;
  /** Middle band (EMA) */
  middle: number | null;
  /** Lower band (middle - multiplier × ATR) */
  lower: number | null;
};

/**
 * Calculate Keltner Channel
 *
 * Calculation:
 * - Middle Band = EMA(close, emaPeriod)
 * - Upper Band = Middle Band + multiplier × ATR(atrPeriod)
 * - Lower Band = Middle Band - multiplier × ATR(atrPeriod)
 *
 * Trading signals:
 * - Price above upper band: Strong bullish momentum
 * - Price below lower band: Strong bearish momentum
 * - Used with Bollinger Bands for "squeeze" detection
 * - When BB is inside KC, volatility is low (squeeze)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Keltner Channel options
 * @returns Series of Keltner Channel values
 *
 * @example
 * ```ts
 * const kc = keltnerChannel(candles);
 * const kcCustom = keltnerChannel(candles, { emaPeriod: 10, atrPeriod: 10, multiplier: 1.5 });
 *
 * // Squeeze detection with Bollinger Bands
 * const bb = bollingerBands(candles);
 * const isSqueeze = bb[i].value.lower > kc[i].value.lower &&
 *                   bb[i].value.upper < kc[i].value.upper;
 * ```
 */
export function keltnerChannel(
  candles: Candle[] | NormalizedCandle[],
  options: KeltnerChannelOptions = {},
): Series<KeltnerChannelValue> {
  const { emaPeriod = 20, atrPeriod = 10, multiplier = 2 } = options;

  if (emaPeriod < 1) {
    throw new Error("Keltner Channel EMA period must be at least 1");
  }
  if (atrPeriod < 1) {
    throw new Error("Keltner Channel ATR period must be at least 1");
  }
  if (multiplier <= 0) {
    throw new Error("Keltner Channel multiplier must be positive");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate EMA for middle band
  const emaData = ema(normalized, { period: emaPeriod, source: "close" });

  // Calculate ATR for band width
  const atrData = atr(normalized, { period: atrPeriod });

  const result: Series<KeltnerChannelValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const emaValue = emaData[i].value;
    const atrValue = atrData[i].value;

    if (emaValue === null || atrValue === null) {
      result.push({
        time: normalized[i].time,
        value: {
          upper: null,
          middle: null,
          lower: null,
        },
      });
    } else {
      const bandwidth = multiplier * atrValue;
      result.push({
        time: normalized[i].time,
        value: {
          upper: emaValue + bandwidth,
          middle: emaValue,
          lower: emaValue - bandwidth,
        },
      });
    }
  }

  return tagSeries(result, { pane: "main", label: "Keltner" });
}
