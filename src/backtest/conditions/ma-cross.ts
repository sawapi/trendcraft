/**
 * Moving Average Cross conditions
 */

import { sma } from "../../indicators/moving-average/sma";
import type { NormalizedCandle, PresetCondition } from "../../types";

// ============================================
// Moving Average Cross Conditions
// ============================================

/**
 * Golden Cross: Short MA crosses above Long MA
 * @param shortPeriod Short-term MA period (default: 5)
 * @param longPeriod Long-term MA period (default: 25)
 * @example
 * ```ts
 * import { runBacktest, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const result = runBacktest(candles, goldenCrossCondition(), deadCrossCondition(), {
 *   capital: 1_000_000,
 * });
 * ```
 */
export function goldenCross(shortPeriod = 5, longPeriod = 25): PresetCondition {
  const cacheKey = `gc_${shortPeriod}_${longPeriod}`;

  return {
    type: "preset",
    name: `goldenCross(${shortPeriod}, ${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      // Use cached or compute SMAs
      let shortSma = indicators[`sma${shortPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;
      let longSma = indicators[`sma${longPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!shortSma) {
        shortSma = sma(candles, { period: shortPeriod });
        indicators[`sma${shortPeriod}`] = shortSma;
      }
      if (!longSma) {
        longSma = sma(candles, { period: longPeriod });
        indicators[`sma${longPeriod}`] = longSma;
      }

      const currShort = shortSma[index]?.value;
      const currLong = longSma[index]?.value;
      const prevShort = shortSma[index - 1]?.value;
      const prevLong = longSma[index - 1]?.value;

      if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
        return false;
      }

      // Cross: prev short <= prev long AND curr short > curr long
      return prevShort <= prevLong && currShort > currLong;
    },
  };
}

/**
 * Dead Cross: Short MA crosses below Long MA
 * @param shortPeriod Short-term MA period (default: 5)
 * @param longPeriod Long-term MA period (default: 25)
 * @example
 * ```ts
 * import { runBacktest, goldenCrossCondition, deadCrossCondition } from "trendcraft";
 *
 * const result = runBacktest(candles, goldenCrossCondition(5, 25), deadCrossCondition(5, 25), {
 *   capital: 1_000_000,
 * });
 * ```
 */
export function deadCross(shortPeriod = 5, longPeriod = 25): PresetCondition {
  return {
    type: "preset",
    name: `deadCross(${shortPeriod}, ${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let shortSma = indicators[`sma${shortPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;
      let longSma = indicators[`sma${longPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!shortSma) {
        shortSma = sma(candles, { period: shortPeriod });
        indicators[`sma${shortPeriod}`] = shortSma;
      }
      if (!longSma) {
        longSma = sma(candles, { period: longPeriod });
        indicators[`sma${longPeriod}`] = longSma;
      }

      const currShort = shortSma[index]?.value;
      const currLong = longSma[index]?.value;
      const prevShort = shortSma[index - 1]?.value;
      const prevLong = longSma[index - 1]?.value;

      if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
        return false;
      }

      // Cross: prev short >= prev long AND curr short < curr long
      return prevShort >= prevLong && currShort < currLong;
    },
  };
}

// ============================================
// Validated Cross Conditions (with Damashi Detection)
// ============================================

/**
 * Options for validated cross detection
 */
export type ValidatedCrossOptions = {
  /** Short-term MA period (default: 5) */
  shortPeriod?: number;
  /** Long-term MA period (default: 25) */
  longPeriod?: number;
  /** Volume MA period for confirmation (default: 20) */
  volumeMaPeriod?: number;
  /** Trend lookback period (default: 5) */
  trendPeriod?: number;
  /** Minimum quality score to accept signal (default: 50) */
  minScore?: number;
};

/**
 * Calculate volume moving average
 */
function calculateVolumeMa(candles: NormalizedCandle[], period: number): (number | null)[] {
  const result: (number | null)[] = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += candles[j].volume;
    }
    result.push(sum / period);
  }

  return result;
}

/**
 * Golden Cross with real-time damashi (fake signal) detection
 *
 * Uses these real-time filters (no future data needed):
 * - Volume confirmation: current volume > volume MA (20 points)
 * - Trend confirmation: long SMA slope is rising (20 points)
 * - Price position: price is above long SMA (15 points)
 * - Base score for cross detection: 15 points
 *
 * @param options Validation options
 */
export function validatedGoldenCross(options: ValidatedCrossOptions = {}): PresetCondition {
  const {
    shortPeriod = 5,
    longPeriod = 25,
    volumeMaPeriod = 20,
    trendPeriod = 5,
    minScore = 50,
  } = options;

  return {
    type: "preset",
    name: `validatedGoldenCross(minScore=${minScore})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < Math.max(longPeriod, volumeMaPeriod, trendPeriod) + 1) return false;

      // Get/compute SMAs
      let shortSma = indicators[`sma${shortPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;
      let longSma = indicators[`sma${longPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!shortSma) {
        shortSma = sma(candles, { period: shortPeriod });
        indicators[`sma${shortPeriod}`] = shortSma;
      }
      if (!longSma) {
        longSma = sma(candles, { period: longPeriod });
        indicators[`sma${longPeriod}`] = longSma;
      }

      // Check for golden cross
      const currShort = shortSma[index]?.value;
      const currLong = longSma[index]?.value;
      const prevShort = shortSma[index - 1]?.value;
      const prevLong = longSma[index - 1]?.value;

      if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
        return false;
      }

      const isGoldenCross = prevShort <= prevLong && currShort > currLong;
      if (!isGoldenCross) return false;

      // Calculate quality score (real-time only)
      let score = 15; // Base score for detecting cross

      // 1. Volume confirmation (20 points)
      let volumeMa = indicators[`volumeMa${volumeMaPeriod}`] as (number | null)[] | undefined;
      if (!volumeMa) {
        volumeMa = calculateVolumeMa(candles, volumeMaPeriod);
        indicators[`volumeMa${volumeMaPeriod}`] = volumeMa;
      }
      const avgVolume = volumeMa?.[index];
      if (avgVolume !== null && avgVolume !== undefined && candle.volume > avgVolume) {
        score += 20;
      }

      // 2. Trend confirmation: long SMA slope > 0 (20 points)
      const pastLong = longSma[index - trendPeriod]?.value;
      if (pastLong !== null && currLong !== null && currLong > pastLong) {
        score += 20;
      }

      // 3. Price position: price > long SMA (15 points)
      if (currLong !== null && candle.close > currLong) {
        score += 15;
      }

      return score >= minScore;
    },
  };
}

/**
 * Dead Cross with real-time damashi (fake signal) detection
 *
 * Uses these real-time filters (no future data needed):
 * - Volume confirmation: current volume > volume MA (20 points)
 * - Trend confirmation: long SMA slope is falling (20 points)
 * - Price position: price is below long SMA (15 points)
 * - Base score for cross detection: 15 points
 *
 * @param options Validation options
 */
export function validatedDeadCross(options: ValidatedCrossOptions = {}): PresetCondition {
  const {
    shortPeriod = 5,
    longPeriod = 25,
    volumeMaPeriod = 20,
    trendPeriod = 5,
    minScore = 50,
  } = options;

  return {
    type: "preset",
    name: `validatedDeadCross(minScore=${minScore})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < Math.max(longPeriod, volumeMaPeriod, trendPeriod) + 1) return false;

      // Get/compute SMAs
      let shortSma = indicators[`sma${shortPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;
      let longSma = indicators[`sma${longPeriod}`] as
        | { time: number; value: number | null }[]
        | undefined;

      if (!shortSma) {
        shortSma = sma(candles, { period: shortPeriod });
        indicators[`sma${shortPeriod}`] = shortSma;
      }
      if (!longSma) {
        longSma = sma(candles, { period: longPeriod });
        indicators[`sma${longPeriod}`] = longSma;
      }

      // Check for dead cross
      const currShort = shortSma[index]?.value;
      const currLong = longSma[index]?.value;
      const prevShort = shortSma[index - 1]?.value;
      const prevLong = longSma[index - 1]?.value;

      if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
        return false;
      }

      const isDeadCross = prevShort >= prevLong && currShort < currLong;
      if (!isDeadCross) return false;

      // Calculate quality score (real-time only)
      let score = 15; // Base score for detecting cross

      // 1. Volume confirmation (20 points)
      let volumeMa = indicators[`volumeMa${volumeMaPeriod}`] as (number | null)[] | undefined;
      if (!volumeMa) {
        volumeMa = calculateVolumeMa(candles, volumeMaPeriod);
        indicators[`volumeMa${volumeMaPeriod}`] = volumeMa;
      }
      const avgVolume = volumeMa?.[index];
      if (avgVolume !== null && avgVolume !== undefined && candle.volume > avgVolume) {
        score += 20;
      }

      // 2. Trend confirmation: long SMA slope < 0 (20 points)
      const pastLong = longSma[index - trendPeriod]?.value;
      if (pastLong !== null && currLong !== null && currLong < pastLong) {
        score += 20;
      }

      // 3. Price position: price < long SMA (15 points)
      if (currLong !== null && candle.close < currLong) {
        score += 15;
      }

      return score >= minScore;
    },
  };
}
