/**
 * Volume Spread Analysis (VSA)
 *
 * Classifies each bar based on the relationship between volume, spread (range),
 * and close position within the bar. Based on Richard Wyckoff's principles
 * of reading the market through volume and price action.
 *
 * Key concepts:
 * - Spread: High - Low relative to ATR
 * - Close position: Where the close falls within the bar's range (0 = low, 1 = high)
 * - Volume relative: Current volume vs moving average volume
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { atr } from "../volatility/atr";
import { volumeMa } from "../volume/volume-ma";

/** VSA bar classification */
export type VsaBarType =
  | "noSupply"
  | "noDemand"
  | "stoppingVolume"
  | "climacticAction"
  | "test"
  | "upthrust"
  | "spring"
  | "absorption"
  | "effortUp"
  | "effortDown"
  | "normal";

/** VSA analysis result for a single bar */
export type VsaValue = {
  /** Classified bar type */
  barType: VsaBarType;
  /** Spread relative to ATR (1.0 = average) */
  spreadRelative: number;
  /** Close position within bar range (0 = low, 1 = high) */
  closePosition: number;
  /** Volume relative to moving average (1.0 = average) */
  volumeRelative: number;
  /** True when effort (volume) diverges from result (spread) */
  isEffortDivergence: boolean;
};

/** Options for VSA analysis */
export type VsaOptions = {
  /** Volume MA period for relative volume calculation (default: 20) */
  volumeMaPeriod?: number;
  /** ATR period for spread normalization (default: 14) */
  atrPeriod?: number;
  /** Volume threshold for "high volume" classification (default: 1.5) */
  highVolumeThreshold?: number;
  /** Volume threshold for "low volume" classification (default: 0.7) */
  lowVolumeThreshold?: number;
  /** Spread threshold for "wide spread" (default: 1.2) */
  wideSpreadThreshold?: number;
  /** Spread threshold for "narrow spread" (default: 0.7) */
  narrowSpreadThreshold?: number;
};

/**
 * Volume Spread Analysis (VSA) bar classification
 *
 * Analyzes each bar's volume, spread, and close position to identify
 * supply/demand imbalances and potential reversals.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - VSA configuration options
 * @returns Series of VSA values with bar classification
 *
 * @example
 * ```ts
 * const vsaBars = vsa(candles);
 * const last = vsaBars[vsaBars.length - 1].value;
 * if (last.barType === 'spring') {
 *   console.log('Potential reversal: spring detected');
 * }
 * ```
 */
export function vsa(
  candles: Candle[] | NormalizedCandle[],
  options: VsaOptions = {},
): Series<VsaValue> {
  const {
    volumeMaPeriod = 20,
    atrPeriod = 14,
    highVolumeThreshold = 1.5,
    lowVolumeThreshold = 0.7,
    wideSpreadThreshold = 1.2,
    narrowSpreadThreshold = 0.7,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) return [];

  // Calculate ATR and volume MA
  const atrSeries = atr(normalized, { period: atrPeriod });
  const volMaSeries = volumeMa(normalized, { period: volumeMaPeriod });

  const result: Series<VsaValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    const range = c.high - c.low;

    // Spread relative to ATR
    const atrVal = atrSeries[i]?.value ?? null;
    const spreadRelative = atrVal != null && atrVal > 0 ? range / atrVal : 1;

    // Close position within range (0 = low, 1 = high)
    const closePosition = range > 0 ? (c.close - c.low) / range : 0.5;

    // Volume relative to MA
    const volMaVal = volMaSeries[i]?.value ?? null;
    const volumeRelative = volMaVal != null && volMaVal > 0 ? c.volume / volMaVal : 1;

    const highVol = volumeRelative >= highVolumeThreshold;
    const lowVol = volumeRelative <= lowVolumeThreshold;
    const veryHighVol = volumeRelative >= 2.0;
    const wideSpread = spreadRelative >= wideSpreadThreshold;
    const narrowSpread = spreadRelative <= narrowSpreadThreshold;

    // Effort divergence: volume and spread disagree
    const isEffortDivergence = (highVol && narrowSpread) || (lowVol && wideSpread);

    const barType = classifyBar(
      normalized,
      i,
      closePosition,
      highVol,
      lowVol,
      veryHighVol,
      wideSpread,
      narrowSpread,
      atrVal,
    );

    result.push({
      time: c.time,
      value: {
        barType,
        spreadRelative,
        closePosition,
        volumeRelative,
        isEffortDivergence,
      },
    });
  }

  return tagSeries(result, { kind: "vsa", overlay: false, label: "VSA" });
}

/**
 * Classify a bar into a VSA bar type based on volume, spread, and close position.
 * Priority order reflects significance: absorption > stoppingVolume > climactic > ...
 */
function classifyBar(
  candles: NormalizedCandle[],
  i: number,
  closePosition: number,
  highVol: boolean,
  lowVol: boolean,
  veryHighVol: boolean,
  wideSpread: boolean,
  narrowSpread: boolean,
  atrVal: number | null,
): VsaBarType {
  const c = candles[i];

  // Absorption: high volume squeezed into narrow spread (supply/demand absorption)
  if (highVol && narrowSpread) return "absorption";

  // Stopping volume: high volume at potential bottom (close in lower third)
  if (highVol && closePosition < 0.33) return "stoppingVolume";

  // Climactic action: extreme volume + wide spread
  if (veryHighVol && wideSpread) return "climacticAction";

  // Upthrust: close below open, high is highest of last 5 bars, close in lower half
  if (c.close < c.open && closePosition < 0.5) {
    const lookback = Math.min(5, i + 1);
    let isHighest = true;
    for (let j = i - lookback + 1; j < i; j++) {
      if (j >= 0 && candles[j].high >= c.high) {
        isHighest = false;
        break;
      }
    }
    if (isHighest && lookback > 1) return "upthrust";
  }

  // Spring: close above open, low is lowest of last 5 bars, close in upper half
  if (c.close > c.open && closePosition > 0.5) {
    const lookback = Math.min(5, i + 1);
    let isLowest = true;
    for (let j = i - lookback + 1; j < i; j++) {
      if (j >= 0 && candles[j].low <= c.low) {
        isLowest = false;
        break;
      }
    }
    if (isLowest && lookback > 1) return "spring";
  }

  // Test: low volume near recent low (within ATR of lowest low in last 10 bars)
  if (lowVol && i >= 1) {
    const lookback = Math.min(10, i);
    let lowestLow = c.low;
    for (let j = i - lookback; j < i; j++) {
      if (j >= 0 && candles[j].low < lowestLow) {
        lowestLow = candles[j].low;
      }
    }
    const tolerance = atrVal != null ? atrVal : (c.high - c.low) * 2;
    if (Math.abs(c.low - lowestLow) <= tolerance) return "test";
  }

  // Effort up: high volume + wide spread + close in upper 2/3
  if (highVol && wideSpread && closePosition > 0.67) return "effortUp";

  // Effort down: high volume + wide spread + close in lower 1/3
  if (highVol && wideSpread && closePosition < 0.33) return "effortDown";

  // No supply: narrow spread + low volume + close in upper half
  if (narrowSpread && lowVol && closePosition > 0.5) return "noSupply";

  // No demand: narrow spread + low volume + close in lower half
  if (narrowSpread && lowVol && closePosition <= 0.5) return "noDemand";

  return "normal";
}
