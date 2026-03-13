/**
 * Volume Weighted Average Price (VWAP) indicator
 *
 * VWAP is the ratio of the value traded to total volume traded over a period.
 * It is commonly used by institutional investors as a benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * VWAP options
 */
export type VwapOptions = {
  /**
   * Reset period for VWAP calculation
   * - 'session': Reset at the start of each day (default)
   * - 'rolling': Rolling VWAP over specified period
   * - number: Reset every N candles
   */
  resetPeriod?: "session" | "rolling" | number;
  /** Period for rolling VWAP (only used when resetPeriod is 'rolling') */
  period?: number;
  /**
   * Band multipliers for additional standard deviation bands.
   * Each value creates an upper/lower band at that multiple of σ.
   * The default ±1σ bands (upper/lower) are always included.
   *
   * @example [2, 3] — adds ±2σ and ±3σ bands
   */
  bandMultipliers?: number[];
};

/**
 * VWAP band pair
 */
export type VwapBand = {
  /** Upper band value */
  upper: number;
  /** Lower band value */
  lower: number;
};

/**
 * VWAP value
 */
export type VwapValue = {
  /** VWAP value */
  vwap: number | null;
  /** Upper band (VWAP + stdDev) */
  upper: number | null;
  /** Lower band (VWAP - stdDev) */
  lower: number | null;
  /** Additional bands at specified multipliers (indexed by bandMultipliers order) */
  bands?: VwapBand[];
};

/**
 * Calculate Volume Weighted Average Price
 *
 * VWAP = Cumulative(Typical Price × Volume) / Cumulative(Volume)
 * Typical Price = (High + Low + Close) / 3
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - VWAP options
 * @returns Series of VWAP values
 *
 * @example
 * ```ts
 * // Session VWAP (resets daily)
 * const sessionVwap = vwap(candles);
 *
 * // Rolling VWAP over 20 periods
 * const rollingVwap = vwap(candles, { resetPeriod: 'rolling', period: 20 });
 * ```
 */
/**
 * Build a VwapValue from VWAP, standard deviation, and optional band multipliers
 */
function buildVwapValue(
  vwapVal: number | null,
  stdDev: number | null,
  bandMultipliers: number[] | undefined,
): VwapValue {
  if (vwapVal === null || stdDev === null) {
    return { vwap: vwapVal, upper: null, lower: null };
  }

  const value: VwapValue = {
    vwap: vwapVal,
    upper: vwapVal + stdDev,
    lower: vwapVal - stdDev,
  };

  if (bandMultipliers && bandMultipliers.length > 0) {
    value.bands = bandMultipliers.map((m) => ({
      upper: vwapVal + m * stdDev,
      lower: vwapVal - m * stdDev,
    }));
  }

  return value;
}

/**
 * Calculate volume-weighted standard deviation from typical prices and volumes
 */
function calcVwapStdDev(
  tpvHistory: { tp: number; volume: number }[],
  vwapVal: number,
  totalVolume: number,
): number {
  let sumSquaredDiff = 0;
  for (const item of tpvHistory) {
    const diff = item.tp - vwapVal;
    sumSquaredDiff += diff * diff * item.volume;
  }
  return Math.sqrt(sumSquaredDiff / totalVolume);
}

export function vwap(
  candles: Candle[] | NormalizedCandle[],
  options: VwapOptions = {},
): Series<VwapValue> {
  const { resetPeriod = "session", period = 20, bandMultipliers } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<VwapValue> = [];

  if (resetPeriod === "rolling") {
    // Rolling VWAP
    for (let i = 0; i < normalized.length; i++) {
      if (i < period - 1) {
        result.push({
          time: normalized[i].time,
          value: { vwap: null, upper: null, lower: null },
        });
        continue;
      }

      let cumulativeTpv = 0;
      let cumulativeVolume = 0;
      const tpvHistory: { tp: number; volume: number }[] = [];

      for (let j = i - period + 1; j <= i; j++) {
        const candle = normalized[j];
        const tp = (candle.high + candle.low + candle.close) / 3;
        tpvHistory.push({ tp, volume: candle.volume });
        cumulativeTpv += tp * candle.volume;
        cumulativeVolume += candle.volume;
      }

      const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;
      const stdDev =
        vwapValue !== null && cumulativeVolume > 0
          ? calcVwapStdDev(tpvHistory, vwapValue, cumulativeVolume)
          : null;

      result.push({
        time: normalized[i].time,
        value: buildVwapValue(vwapValue, stdDev, bandMultipliers),
      });
    }
  } else {
    // Session or fixed period reset
    let cumulativeTpv = 0;
    let cumulativeVolume = 0;
    let sessionStart = 0;
    let lastDayIndex = -1;
    let tpvHistory: { tp: number; volume: number }[] = [];

    // Integer day calculation avoids Date object creation overhead
    // and correctly handles month/year boundaries unlike getDate()
    const MS_PER_DAY = 86400000;

    for (let i = 0; i < normalized.length; i++) {
      const candle = normalized[i];
      const currentDayIndex = Math.floor(candle.time / MS_PER_DAY);

      // Check if we need to reset
      const shouldReset =
        (resetPeriod === "session" && currentDayIndex !== lastDayIndex && lastDayIndex !== -1) ||
        (typeof resetPeriod === "number" && i - sessionStart >= resetPeriod);

      if (shouldReset) {
        cumulativeTpv = 0;
        cumulativeVolume = 0;
        sessionStart = i;
        tpvHistory = [];
      }

      lastDayIndex = currentDayIndex;

      const tp = (candle.high + candle.low + candle.close) / 3;
      cumulativeTpv += tp * candle.volume;
      cumulativeVolume += candle.volume;
      tpvHistory.push({ tp, volume: candle.volume });

      const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;
      const stdDev =
        vwapValue !== null && cumulativeVolume > 0
          ? calcVwapStdDev(tpvHistory, vwapValue, cumulativeVolume)
          : null;

      result.push({
        time: candle.time,
        value: buildVwapValue(vwapValue, stdDev, bandMultipliers),
      });
    }
  }

  return result;
}
