/**
 * Anchored VWAP indicator
 *
 * Calculates VWAP from an arbitrary anchor point (timestamp).
 * Used by institutional investors to determine cost basis from significant events
 * like earnings, breakouts, or highs/lows.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Anchored VWAP options
 */
export type AnchoredVwapOptions = {
  /** Anchor timestamp (ms since epoch) — VWAP calculation starts from this point */
  anchorTime: number;
  /** Number of standard deviation bands to include (default: 0 = no bands) */
  bands?: number;
};

/**
 * Anchored VWAP value
 */
export type AnchoredVwapValue = {
  /** VWAP value */
  vwap: number | null;
  /** Upper band at 1σ (if bands >= 1) */
  upper1?: number | null;
  /** Lower band at 1σ (if bands >= 1) */
  lower1?: number | null;
  /** Upper band at 2σ (if bands >= 2) */
  upper2?: number | null;
  /** Lower band at 2σ (if bands >= 2) */
  lower2?: number | null;
};

/**
 * Build an AnchoredVwapValue with null bands
 */
function buildNullValue(bands: number, vwapValue: number | null = null): AnchoredVwapValue {
  const value: AnchoredVwapValue = { vwap: vwapValue };
  if (bands >= 1) {
    value.upper1 = null;
    value.lower1 = null;
  }
  if (bands >= 2) {
    value.upper2 = null;
    value.lower2 = null;
  }
  return value;
}

/**
 * Calculate Anchored VWAP
 *
 * VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
 * Starting from the anchor timestamp.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Anchored VWAP options
 * @returns Series of Anchored VWAP values (null before anchor point)
 *
 * @example
 * ```ts
 * // VWAP anchored to a specific date
 * const avwap = anchoredVwap(candles, { anchorTime: Date.parse('2024-01-15') });
 *
 * // With 2 standard deviation bands
 * const avwapBands = anchoredVwap(candles, {
 *   anchorTime: Date.parse('2024-01-15'),
 *   bands: 2,
 * });
 * ```
 */
export function anchoredVwap(
  candles: Candle[] | NormalizedCandle[],
  options: AnchoredVwapOptions,
): Series<AnchoredVwapValue> {
  const { anchorTime, bands = 0 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<AnchoredVwapValue> = [];
  let cumulativeTpv = 0;
  let cumulativeVolume = 0;
  const tpvHistory: { tp: number; volume: number }[] = [];
  let isAnchored = false;

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];

    if (candle.time >= anchorTime) {
      isAnchored = true;
    }

    if (!isAnchored) {
      result.push({ time: candle.time, value: buildNullValue(bands) });
      continue;
    }

    const tp = (candle.high + candle.low + candle.close) / 3;
    cumulativeTpv += tp * candle.volume;
    cumulativeVolume += candle.volume;
    tpvHistory.push({ tp, volume: candle.volume });

    const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;

    if (bands < 1 || vwapValue === null || cumulativeVolume <= 0) {
      result.push({ time: candle.time, value: buildNullValue(bands, vwapValue) });
      continue;
    }

    let sumSquaredDiff = 0;
    for (const item of tpvHistory) {
      const diff = item.tp - vwapValue;
      sumSquaredDiff += diff * diff * item.volume;
    }
    const stdDev = Math.sqrt(sumSquaredDiff / cumulativeVolume);

    const value: AnchoredVwapValue = {
      vwap: vwapValue,
      upper1: vwapValue + stdDev,
      lower1: vwapValue - stdDev,
    };

    if (bands >= 2) {
      value.upper2 = vwapValue + 2 * stdDev;
      value.lower2 = vwapValue - 2 * stdDev;
    }

    result.push({ time: candle.time, value });
  }

  return tagSeries(result, { overlay: true, label: "AVWAP" });
}
