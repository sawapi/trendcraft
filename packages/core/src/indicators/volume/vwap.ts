/**
 * Volume Weighted Average Price (VWAP) indicator
 *
 * VWAP is the ratio of the value traded to total volume traded over a period.
 * It is commonly used by institutional investors as a benchmark.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { VWAP_META } from "../indicator-meta";
import {
  assertSessionResetCompatible,
  resolveSessionMembership,
  type SessionDefinition,
} from "../session/session-definition";

/**
 * VWAP options
 */
export type VwapOptions = {
  /**
   * Reset period for VWAP calculation
   * - 'session': Reset at the start of each day (default)
   * - 'rolling': Rolling VWAP over specified period
   * - number: Reset every N candles
   *
   * Only the default `'session'` may be combined with `session`, which brings
   * its own boundaries; `'rolling'` and bar counts throw.
   */
  resetPeriod?: "session" | "rolling" | number;
  /** Period for rolling VWAP (only used when resetPeriod is 'rolling') */
  period?: number;
  /**
   * Trading session the VWAP belongs to.
   *
   * Without it, the average restarts at UTC midnight rather than at a session
   * boundary. For a series limited to regular trading hours the two often
   * coincide — a US equity day sits inside one UTC date — but it breaks once
   * the series carries extended hours: UTC midnight is 19:00 or 20:00 in New
   * York, part-way through the post-market, so one reset period runs from
   * there through the next day's pre-market, regular session and post-market.
   * It never lines up for a session that itself crosses UTC midnight.
   *
   * With it, the average restarts when the session does, in the
   * session's own timezone, and only bars inside the session contribute: bars
   * outside the window, and bars inside one of its breaks, produce `null` and
   * leave the running totals untouched.
   *
   * Handles sessions that cross midnight and days when the clock shifts for
   * DST.
   */
  session?: SessionDefinition;
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

/**
 * Build the emitted value from a window's running totals
 */
function valueFromTotals(
  tpvHistory: { tp: number; volume: number }[],
  cumulativeTpv: number,
  cumulativeVolume: number,
  bandMultipliers: number[] | undefined,
): VwapValue {
  const vwapValue = cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : null;
  const stdDev =
    vwapValue !== null && cumulativeVolume > 0
      ? calcVwapStdDev(tpvHistory, vwapValue, cumulativeVolume)
      : null;

  return buildVwapValue(vwapValue, stdDev, bandMultipliers);
}

export function vwap(
  candles: Candle[] | NormalizedCandle[],
  options: VwapOptions = {},
): Series<VwapValue> {
  const { resetPeriod = "session", period = 20, bandMultipliers, session } = options;

  if (session) {
    assertSessionResetCompatible("vwap", "resetPeriod", resetPeriod, "session");
  }

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

      result.push({
        time: normalized[i].time,
        value: valueFromTotals(tpvHistory, cumulativeTpv, cumulativeVolume, bandMultipliers),
      });
    }
  } else if (session) {
    // Session-anchored: the average covers one session occurrence, restarting
    // when the session does rather than at UTC midnight.
    let cumulativeTpv = 0;
    let cumulativeVolume = 0;
    let tpvHistory: { tp: number; volume: number }[] = [];
    let currentOccurrence = -1;

    for (const candle of normalized) {
      const membership = resolveSessionMembership(candle.time, session);

      if (!membership.active) {
        // Outside the window, or inside a break: not part of the session's
        // average, and must not move the running totals either.
        result.push({
          time: candle.time,
          value: buildVwapValue(null, null, bandMultipliers),
        });
        continue;
      }

      if (membership.occurrenceKey !== currentOccurrence) {
        cumulativeTpv = 0;
        cumulativeVolume = 0;
        tpvHistory = [];
        currentOccurrence = membership.occurrenceKey;
      }

      const tp = (candle.high + candle.low + candle.close) / 3;
      cumulativeTpv += tp * candle.volume;
      cumulativeVolume += candle.volume;
      tpvHistory.push({ tp, volume: candle.volume });

      result.push({
        time: candle.time,
        value: valueFromTotals(tpvHistory, cumulativeTpv, cumulativeVolume, bandMultipliers),
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

      result.push({
        time: candle.time,
        value: valueFromTotals(tpvHistory, cumulativeTpv, cumulativeVolume, bandMultipliers),
      });
    }
  }

  return tagSeries(result, VWAP_META);
}
