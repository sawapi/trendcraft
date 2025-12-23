/**
 * Preset conditions for backtest entry/exit
 */

import type { Condition, ConditionFn, PresetCondition, CombinedCondition, NormalizedCandle } from "../types";
import { sma } from "../indicators/moving-average/sma";
import { rsi } from "../indicators/momentum/rsi";
import { macd } from "../indicators/momentum/macd";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import { slowStochastics } from "../indicators/momentum/stochastics";
import { dmi } from "../indicators/momentum/dmi";
import { volumeMa } from "../indicators/volume/volume-ma";
import { rangeBound, type RangeBoundValue, type RangeBoundOptions } from "../signals/range-bound";

// ============================================
// Condition Evaluation Helper
// ============================================

/**
 * Evaluate a condition (preset, combined, or custom function)
 */
export function evaluateCondition(
  condition: Condition,
  indicators: Record<string, unknown>,
  candle: NormalizedCandle,
  index: number,
  candles: NormalizedCandle[]
): boolean {
  // Custom function
  if (typeof condition === "function") {
    return condition(indicators, candle, index, candles);
  }

  // Preset condition
  if (condition.type === "preset") {
    return condition.evaluate(indicators, candle, index, candles);
  }

  // Combined conditions
  const combined = condition as CombinedCondition;
  switch (combined.type) {
    case "and":
      return combined.conditions.every((c) => evaluateCondition(c, indicators, candle, index, candles));
    case "or":
      return combined.conditions.some((c) => evaluateCondition(c, indicators, candle, index, candles));
    case "not":
      return !evaluateCondition(combined.conditions[0], indicators, candle, index, candles);
    default:
      return false;
  }
}

// ============================================
// Combination Functions
// ============================================

/**
 * Combine conditions with AND logic
 */
export function and(...conditions: Condition[]): CombinedCondition {
  return { type: "and", conditions };
}

/**
 * Combine conditions with OR logic
 */
export function or(...conditions: Condition[]): CombinedCondition {
  return { type: "or", conditions };
}

/**
 * Negate a condition
 */
export function not(condition: Condition): CombinedCondition {
  return { type: "not", conditions: [condition] };
}

// ============================================
// Moving Average Cross Conditions
// ============================================

/**
 * Golden Cross: Short MA crosses above Long MA
 * @param shortPeriod Short-term MA period (default: 5)
 * @param longPeriod Long-term MA period (default: 25)
 */
export function goldenCross(shortPeriod = 5, longPeriod = 25): PresetCondition {
  const cacheKey = `gc_${shortPeriod}_${longPeriod}`;

  return {
    type: "preset",
    name: `goldenCross(${shortPeriod}, ${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      // Use cached or compute SMAs
      let shortSma = indicators[`sma${shortPeriod}`] as { time: number; value: number | null }[] | undefined;
      let longSma = indicators[`sma${longPeriod}`] as { time: number; value: number | null }[] | undefined;

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
 */
export function deadCross(shortPeriod = 5, longPeriod = 25): PresetCondition {
  return {
    type: "preset",
    name: `deadCross(${shortPeriod}, ${longPeriod})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let shortSma = indicators[`sma${shortPeriod}`] as { time: number; value: number | null }[] | undefined;
      let longSma = indicators[`sma${longPeriod}`] as { time: number; value: number | null }[] | undefined;

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
// RSI Conditions
// ============================================

/**
 * RSI below threshold (oversold)
 * @param threshold RSI threshold (default: 30)
 * @param period RSI period (default: 14)
 */
export function rsiBelow(threshold = 30, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as { time: number; value: number | null }[] | undefined;

      if (!rsiData) {
        rsiData = rsi(candles, { period });
        indicators[`rsi${period}`] = rsiData;
      }

      const value = rsiData[index]?.value;
      return value !== null && value < threshold;
    },
  };
}

/**
 * RSI above threshold (overbought)
 * @param threshold RSI threshold (default: 70)
 * @param period RSI period (default: 14)
 */
export function rsiAbove(threshold = 70, period = 14): PresetCondition {
  return {
    type: "preset",
    name: `rsiAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let rsiData = indicators[`rsi${period}`] as { time: number; value: number | null }[] | undefined;

      if (!rsiData) {
        rsiData = rsi(candles, { period });
        indicators[`rsi${period}`] = rsiData;
      }

      const value = rsiData[index]?.value;
      return value !== null && value > threshold;
    },
  };
}

// ============================================
// MACD Conditions
// ============================================

/**
 * MACD line crosses above signal line
 */
export function macdCrossUp(fast = 12, slow = 26, signal = 9): PresetCondition {
  const key = `macd_${fast}_${slow}_${signal}`;

  return {
    type: "preset",
    name: "macdCrossUp()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let macdData = indicators[key] as { time: number; value: { macd: number | null; signal: number | null } }[] | undefined;

      if (!macdData) {
        macdData = macd(candles, { fastPeriod: fast, slowPeriod: slow, signalPeriod: signal });
        indicators[key] = macdData;
      }

      const curr = macdData[index]?.value;
      const prev = macdData[index - 1]?.value;

      if (!curr || !prev || curr.macd === null || curr.signal === null || prev.macd === null || prev.signal === null) {
        return false;
      }

      return prev.macd <= prev.signal && curr.macd > curr.signal;
    },
  };
}

/**
 * MACD line crosses below signal line
 */
export function macdCrossDown(fast = 12, slow = 26, signal = 9): PresetCondition {
  const key = `macd_${fast}_${slow}_${signal}`;

  return {
    type: "preset",
    name: "macdCrossDown()",
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let macdData = indicators[key] as { time: number; value: { macd: number | null; signal: number | null } }[] | undefined;

      if (!macdData) {
        macdData = macd(candles, { fastPeriod: fast, slowPeriod: slow, signalPeriod: signal });
        indicators[key] = macdData;
      }

      const curr = macdData[index]?.value;
      const prev = macdData[index - 1]?.value;

      if (!curr || !prev || curr.macd === null || curr.signal === null || prev.macd === null || prev.signal === null) {
        return false;
      }

      return prev.macd >= prev.signal && curr.macd < curr.signal;
    },
  };
}

// ============================================
// Bollinger Bands Conditions
// ============================================

/**
 * Price breaks out of Bollinger Band
 * @param band 'upper' or 'lower'
 */
export function bollingerBreakout(band: "upper" | "lower", period = 20, stdDev = 2): PresetCondition {
  const key = `bb${period}`;

  return {
    type: "preset",
    name: `bollingerBreakout('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      let bbData = indicators[key] as { time: number; value: { upper: number | null; lower: number | null } }[] | undefined;

      if (!bbData) {
        bbData = bollingerBands(candles, { period, stdDev });
        indicators[key] = bbData;
      }

      const bb = bbData[index]?.value;
      if (!bb) return false;

      if (band === "upper") {
        return bb.upper !== null && candle.close > bb.upper;
      } else {
        return bb.lower !== null && candle.close < bb.lower;
      }
    },
  };
}

/**
 * Price touches Bollinger Band (within band, touching edge)
 * @param band 'upper' or 'lower'
 */
export function bollingerTouch(band: "upper" | "lower", period = 20, stdDev = 2): PresetCondition {
  const key = `bb${period}`;

  return {
    type: "preset",
    name: `bollingerTouch('${band}')`,
    evaluate: (indicators, candle, index, candles) => {
      let bbData = indicators[key] as { time: number; value: { upper: number | null; lower: number | null; middle: number | null } }[] | undefined;

      if (!bbData) {
        bbData = bollingerBands(candles, { period, stdDev });
        indicators[key] = bbData;
      }

      const bb = bbData[index]?.value;
      if (!bb || bb.upper === null || bb.lower === null || bb.middle === null) return false;

      const bandWidth = bb.upper - bb.lower;
      const tolerance = bandWidth * 0.02; // 2% tolerance

      if (band === "upper") {
        return candle.high >= bb.upper - tolerance && candle.close <= bb.upper;
      } else {
        return candle.low <= bb.lower + tolerance && candle.close >= bb.lower;
      }
    },
  };
}

// ============================================
// Price Conditions
// ============================================

/**
 * Price is above a specific moving average
 */
export function priceAboveSma(period: number): PresetCondition {
  return {
    type: "preset",
    name: `priceAboveSma(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      let smaData = indicators[`sma${period}`] as { time: number; value: number | null }[] | undefined;

      if (!smaData) {
        smaData = sma(candles, { period });
        indicators[`sma${period}`] = smaData;
      }

      const value = smaData[index]?.value;
      return value !== null && candle.close > value;
    },
  };
}

/**
 * Price is below a specific moving average
 */
export function priceBelowSma(period: number): PresetCondition {
  return {
    type: "preset",
    name: `priceBelowSma(${period})`,
    evaluate: (indicators, candle, index, candles) => {
      let smaData = indicators[`sma${period}`] as { time: number; value: number | null }[] | undefined;

      if (!smaData) {
        smaData = sma(candles, { period });
        indicators[`sma${period}`] = smaData;
      }

      const value = smaData[index]?.value;
      return value !== null && candle.close < value;
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
      let shortSma = indicators[`sma${shortPeriod}`] as { time: number; value: number | null }[] | undefined;
      let longSma = indicators[`sma${longPeriod}`] as { time: number; value: number | null }[] | undefined;

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
      let shortSma = indicators[`sma${shortPeriod}`] as { time: number; value: number | null }[] | undefined;
      let longSma = indicators[`sma${longPeriod}`] as { time: number; value: number | null }[] | undefined;

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

// ============================================
// Perfect Order Conditions
// ============================================

import { perfectOrder, perfectOrderEnhanced, type PerfectOrderValue, type PerfectOrderValueEnhanced } from "../signals/perfect-order";

/**
 * Options for perfect order conditions
 */
export type PerfectOrderConditionOptions = {
  /** MA periods (default: [5, 25, 75]) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Minimum strength score to trigger (default: 0) */
  minStrength?: number;
};

/**
 * Perfect Order formed (bullish)
 * Triggers when bullish perfect order is formed (short > medium > long MA)
 *
 * @example
 * ```ts
 * // Entry when bullish perfect order forms
 * const entry = perfectOrderBullish();
 *
 * // With minimum strength requirement
 * const strongEntry = perfectOrderBullish({ minStrength: 30 });
 *
 * // Custom periods
 * const customEntry = perfectOrderBullish({ periods: [10, 20, 50, 200] });
 * ```
 */
export function perfectOrderBullish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order formed (bearish)
 * Triggers when bearish perfect order is formed (short < medium < long MA)
 *
 * @example
 * ```ts
 * // Entry when bearish perfect order forms (for short selling)
 * const entry = perfectOrderBearish();
 * ```
 */
export function perfectOrderBearish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bearish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order collapsed
 * Triggers when a perfect order collapses (MAs no longer in order)
 *
 * Useful as an exit condition - exit when the trend structure breaks down.
 *
 * @example
 * ```ts
 * // Exit when perfect order collapses
 * const exit = perfectOrderCollapsed();
 * ```
 */
export function perfectOrderCollapsed(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma" } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderCollapsed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.collapsed;
    },
  };
}

/**
 * Perfect Order active (bullish)
 * Returns true while bullish perfect order is active (not just when it forms)
 *
 * @example
 * ```ts
 * // Hold position while perfect order is active
 * const holdCondition = perfectOrderActiveBullish();
 * ```
 */
export function perfectOrderActiveBullish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order active (bearish)
 * Returns true while bearish perfect order is active
 */
export function perfectOrderActiveBearish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bearish" && po.strength >= minStrength;
    },
  };
}

// ============================================
// Enhanced Perfect Order Conditions
// ============================================

/**
 * Options for enhanced perfect order conditions
 */
export type PerfectOrderEnhancedConditionOptions = PerfectOrderConditionOptions & {
  /** Lookback period for slope calculation (default: 3) */
  slopeLookback?: number;
  /** Number of consecutive bars required for confirmation (default: 3) */
  persistBars?: number;
  /** Threshold for MA convergence detection as ratio (default: 0.003 = 0.3%) */
  collapseEps?: number;
  /** Minimum confidence score (default: 0) */
  minConfidence?: number;
};

/**
 * Enhanced Perfect Order confirmed (bullish)
 * Triggers when bullish perfect order is confirmed (all slopes UP + persistence)
 *
 * @example
 * ```ts
 * // Entry when confirmed bullish perfect order
 * const entry = perfectOrderBullishConfirmed();
 *
 * // With minimum confidence
 * const highConfEntry = perfectOrderBullishConfirmed({ minConfidence: 0.9 });
 * ```
 */
export function perfectOrderBullishConfirmed(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    minStrength = 0,
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minConfidence = 0,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBullishConfirmed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return (
        po.state === "BULLISH_PO" &&
        po.isConfirmed &&
        po.strength >= minStrength &&
        po.confidence >= minConfidence
      );
    },
  };
}

/**
 * Enhanced Perfect Order confirmed (bearish)
 * Triggers when bearish perfect order is confirmed (all slopes DOWN + persistence)
 */
export function perfectOrderBearishConfirmed(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    minStrength = 0,
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minConfidence = 0,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBearishConfirmed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return (
        po.state === "BEARISH_PO" &&
        po.isConfirmed &&
        po.strength >= minStrength &&
        po.confidence >= minConfidence
      );
    },
  };
}

/**
 * Enhanced Perfect Order confirmation formed
 * Triggers at the moment when a perfect order becomes confirmed
 *
 * This is useful as an entry signal - fires exactly once when PO becomes confirmed
 */
export function perfectOrderConfirmationFormed(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderConfirmationFormed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.confirmationFormed;
    },
  };
}

/**
 * Enhanced Perfect Order breakdown detected
 * Triggers when perfect order starts breaking down
 *
 * This is useful as an early exit signal - fires when PO structure degrades
 */
export function perfectOrderBreakdown(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBreakdown(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.breakdownDetected;
    },
  };
}

/**
 * Enhanced Perfect Order MA convergence (squeeze) detected
 * Triggers when all MAs converge (COLLAPSED state)
 *
 * This indicates energy accumulation before next move - useful for anticipating breakouts
 */
export function perfectOrderMaCollapsed(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderMaCollapsed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.collapseDetected;
    },
  };
}

/**
 * Enhanced Perfect Order in pre-bullish state
 * Triggers when conditions are forming for bullish PO (not yet confirmed)
 *
 * Useful for early entries with tighter stops
 */
export function perfectOrderPreBullish(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderPreBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.state === "PRE_BULLISH_PO";
    },
  };
}

/**
 * Enhanced Perfect Order in pre-bearish state
 * Triggers when conditions are forming for bearish PO (not yet confirmed)
 */
export function perfectOrderPreBearish(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderPreBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.state === "PRE_BEARISH_PO";
    },
  };
}

// ============================================
// Perfect Order Pullback Entry
// ============================================

/**
 * Perfect Order pullback buy entry
 * Triggers when 5-day MA slope changes from DOWN to UP while maintaining bullish order
 * (i.e., pullback recovery without touching 25-day MA)
 *
 * @example
 * ```ts
 * // Entry on pullback recovery during bullish perfect order
 * const entry = perfectOrderPullbackEntry();
 *
 * // With stricter gap requirement
 * const strictEntry = perfectOrderPullbackEntry({ minGapPercent: 1.0 });
 * ```
 */
export function perfectOrderPullbackEntry(
  options: PerfectOrderEnhancedConditionOptions & {
    /** Minimum gap between short MA and mid MA as percentage (default: 0.5%) */
    minGapPercent?: number;
    /** Maximum bars to look back for DOWN slope (default: 5) */
    lookbackBars?: number;
  } = {}
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minGapPercent = 0.5,
    lookbackBars = 5,
  } = options;
  const cacheKey = `poe_pullback_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;
  const stateKey = `poe_pullback_state_${periods.join("_")}`;

  return {
    type: "preset",
    name: `perfectOrderPullbackEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      // Need at least 2 bars to detect slope change
      if (index < 1) return false;

      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      // Track state: has PO+ been confirmed since last breakdown?
      let state = indicators[stateKey] as { hasConfirmedSinceBreakdown: boolean; lastProcessedIndex: number } | undefined;
      if (!state) {
        state = { hasConfirmedSinceBreakdown: false, lastProcessedIndex: -1 };
        indicators[stateKey] = state;
      }

      // Update state for all indices from last processed to current
      for (let i = state.lastProcessedIndex + 1; i <= index; i++) {
        const val = poData[i]?.value;
        if (!val) continue;

        // Reset on breakdown
        if (val.breakdownDetected) {
          state.hasConfirmedSinceBreakdown = false;
        }
        // Mark confirmed on PO+ (confirmationFormed)
        if (val.confirmationFormed && val.state === "BULLISH_PO") {
          state.hasConfirmedSinceBreakdown = true;
        }
      }
      state.lastProcessedIndex = index;

      const current = poData[index]?.value;
      const prev = poData[index - 1]?.value;

      if (!current || !prev) return false;

      // 1. Must have had a PO+ confirmation since the last breakdown
      if (!state.hasConfirmedSinceBreakdown) return false;

      // 2. Must be in bullish state (BULLISH_PO or PRE_BULLISH_PO)
      if (current.type !== "bullish") return false;

      // 3. Check if slope just changed to UP (from DOWN or FLAT)
      const shortSlope = current.slopes[0];
      const prevShortSlope = prev.slopes[0];

      // Trigger when slope becomes UP (from non-UP state)
      if (shortSlope !== "UP" || prevShortSlope === "UP") return false;

      // 4. Look back to find if there was a recent DOWN slope (within lookbackBars)
      // This allows for DOWN -> FLAT -> UP pattern
      let hadDownSlope = false;
      for (let i = 1; i <= lookbackBars && index - i >= 0; i++) {
        const pastValue = poData[index - i]?.value;
        if (!pastValue) break;

        // Must have been in bullish state throughout
        if (pastValue.type !== "bullish") break;

        if (pastValue.slopes[0] === "DOWN") {
          hadDownSlope = true;
          break;
        }
        // If we hit UP before DOWN, this is not a pullback recovery
        if (pastValue.slopes[0] === "UP") break;
      }

      if (!hadDownSlope) return false;

      // 5. Short MA must not have touched mid MA (maintain gap)
      const shortMa = current.maValues[0];
      const midMa = current.maValues[1];
      if (shortMa === null || midMa === null) return false;

      const gapPercent = ((shortMa - midMa) / midMa) * 100;
      if (gapPercent < minGapPercent) return false;

      return true;
    },
  };
}

/**
 * Perfect Order pullback sell entry (bearish version)
 * Triggers when 5-day MA slope changes from UP to DOWN while maintaining bearish order
 */
export function perfectOrderPullbackSellEntry(
  options: PerfectOrderEnhancedConditionOptions & {
    /** Minimum gap between short MA and mid MA as percentage (default: 0.5%) */
    minGapPercent?: number;
    /** Maximum bars to look back for UP slope (default: 5) */
    lookbackBars?: number;
  } = {}
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minGapPercent = 0.5,
    lookbackBars = 5,
  } = options;
  const cacheKey = `poe_pullback_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;
  const stateKey = `poe_pullback_sell_state_${periods.join("_")}`;

  return {
    type: "preset",
    name: `perfectOrderPullbackSellEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      // Track state: has PO+ (bearish) been confirmed since last breakdown?
      let state = indicators[stateKey] as { hasConfirmedSinceBreakdown: boolean; lastProcessedIndex: number } | undefined;
      if (!state) {
        state = { hasConfirmedSinceBreakdown: false, lastProcessedIndex: -1 };
        indicators[stateKey] = state;
      }

      // Update state for all indices from last processed to current
      for (let i = state.lastProcessedIndex + 1; i <= index; i++) {
        const val = poData[i]?.value;
        if (!val) continue;

        // Reset on breakdown
        if (val.breakdownDetected) {
          state.hasConfirmedSinceBreakdown = false;
        }
        // Mark confirmed on PO+ (confirmationFormed for bearish)
        if (val.confirmationFormed && val.state === "BEARISH_PO") {
          state.hasConfirmedSinceBreakdown = true;
        }
      }
      state.lastProcessedIndex = index;

      const current = poData[index]?.value;
      const prev = poData[index - 1]?.value;

      if (!current || !prev) return false;

      // 1. Must have had a PO+ (bearish) confirmation since the last breakdown
      if (!state.hasConfirmedSinceBreakdown) return false;

      // 2. Must be in bearish state
      if (current.type !== "bearish") return false;

      // 3. Check if slope just changed to DOWN (from UP or FLAT)
      const shortSlope = current.slopes[0];
      const prevShortSlope = prev.slopes[0];

      // Trigger when slope becomes DOWN (from non-DOWN state)
      if (shortSlope !== "DOWN" || prevShortSlope === "DOWN") return false;

      // 4. Look back to find if there was a recent UP slope (within lookbackBars)
      // This allows for UP -> FLAT -> DOWN pattern
      let hadUpSlope = false;
      for (let i = 1; i <= lookbackBars && index - i >= 0; i++) {
        const pastValue = poData[index - i]?.value;
        if (!pastValue) break;

        // Must have been in bearish state throughout
        if (pastValue.type !== "bearish") break;

        if (pastValue.slopes[0] === "UP") {
          hadUpSlope = true;
          break;
        }
        // If we hit DOWN before UP, this is not a pullback recovery
        if (pastValue.slopes[0] === "DOWN") break;
      }

      if (!hadUpSlope) return false;

      // 5. Short MA must not have touched mid MA (maintain gap below)
      const shortMa = current.maValues[0];
      const midMa = current.maValues[1];
      if (shortMa === null || midMa === null) return false;

      const gapPercent = ((midMa - shortMa) / midMa) * 100;
      if (gapPercent < minGapPercent) return false;

      return true;
    },
  };
}

// ============================================
// PO+ and PB Signal Entry Conditions
// ============================================

/**
 * Entry on PO+ signal (bullish perfect order confirmation)
 * Uses the pre-computed confirmationFormed flag from perfectOrderEnhanced
 *
 * @example
 * ```ts
 * // Simple PO+ entry
 * const entry = poPlusEntry();
 *
 * // Combined with PB for pyramid entries
 * const entry = or(poPlusEntry(), pbEntry());
 * ```
 */
export function poPlusEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `poPlusEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      // Fire on bullish PO confirmation
      return po.confirmationFormed && po.state === "BULLISH_PO";
    },
  };
}

/**
 * Entry on PB signal (pullback buy during perfect order)
 * Uses the pre-computed pullbackBuySignal flag from perfectOrderEnhanced
 *
 * This fires when 5-day MA slope changes from DOWN to UP while maintaining
 * bullish order and sufficient gap from 25-day MA.
 *
 * @example
 * ```ts
 * // Simple PB entry
 * const entry = pbEntry();
 *
 * // Combined with PO+ for initial + pyramid entries
 * const entry = or(poPlusEntry(), pbEntry());
 * ```
 */
export function pbEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `pbEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      // Fire on pullback buy signal
      return po.pullbackBuySignal;
    },
  };
}

/**
 * Entry on PO+ or PB signal (combined entry)
 * Combines both initial PO+ confirmation and pullback buy signals
 *
 * @example
 * ```ts
 * // Single condition for both initial entry and pyramid
 * const entry = poPlusPbEntry();
 * ```
 */
export function poPlusPbEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `poPlusPbEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValueEnhanced }[] | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      // Fire on PO+ (bullish confirmation) or PB signal
      const isPOPlus = po.confirmationFormed && po.state === "BULLISH_PO";
      return isPOPlus || po.pullbackBuySignal;
    },
  };
}

// ============================================
// Stochastics Conditions
// ============================================

/**
 * Stochastics %K below threshold (oversold)
 * @param threshold %K threshold (default: 20)
 */
export function stochBelow(threshold = 20, kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochBelow(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const stoch = stochData[index]?.value;
      return stoch?.k !== null && stoch?.k !== undefined && stoch.k < threshold;
    },
  };
}

/**
 * Stochastics %K above threshold (overbought)
 * @param threshold %K threshold (default: 80)
 */
export function stochAbove(threshold = 80, kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const stoch = stochData[index]?.value;
      return stoch?.k !== null && stoch?.k !== undefined && stoch.k > threshold;
    },
  };
}

/**
 * Stochastics Golden Cross: %K crosses above %D
 */
export function stochCrossUp(kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochCrossUp()`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!curr || !prev || curr.k === null || curr.d === null || prev.k === null || prev.d === null) {
        return false;
      }

      return prev.k <= prev.d && curr.k > curr.d;
    },
  };
}

/**
 * Stochastics Dead Cross: %K crosses below %D
 */
export function stochCrossDown(kPeriod = 14, dPeriod = 3): PresetCondition {
  const cacheKey = `stoch_${kPeriod}_${dPeriod}`;

  return {
    type: "preset",
    name: `stochCrossDown()`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

      let stochData = indicators[cacheKey] as { time: number; value: { k: number | null; d: number | null } }[] | undefined;

      if (!stochData) {
        stochData = slowStochastics(candles, { kPeriod, dPeriod });
        indicators[cacheKey] = stochData;
      }

      const curr = stochData[index]?.value;
      const prev = stochData[index - 1]?.value;

      if (!curr || !prev || curr.k === null || curr.d === null || prev.k === null || prev.d === null) {
        return false;
      }

      return prev.k >= prev.d && curr.k < curr.d;
    },
  };
}

// ============================================
// DMI/ADX Conditions
// ============================================

/**
 * DMI Bullish: +DI > -DI with optional ADX filter
 * @param minAdx Minimum ADX for trend strength (default: 20)
 */
export function dmiBullish(minAdx = 20, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `dmiBullish(ADX>${minAdx})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as { time: number; value: { plusDi: number | null; minusDi: number | null; adx: number | null } }[] | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      if (!d || d.plusDi === null || d.minusDi === null || d.adx === null) return false;

      return d.plusDi > d.minusDi && d.adx >= minAdx;
    },
  };
}

/**
 * DMI Bearish: -DI > +DI with optional ADX filter
 * @param minAdx Minimum ADX for trend strength (default: 20)
 */
export function dmiBearish(minAdx = 20, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `dmiBearish(ADX>${minAdx})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as { time: number; value: { plusDi: number | null; minusDi: number | null; adx: number | null } }[] | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      if (!d || d.plusDi === null || d.minusDi === null || d.adx === null) return false;

      return d.minusDi > d.plusDi && d.adx >= minAdx;
    },
  };
}

/**
 * ADX Strong Trend: ADX above threshold
 * @param threshold ADX threshold (default: 25)
 */
export function adxStrong(threshold = 25, period = 14): PresetCondition {
  const cacheKey = `dmi_${period}`;

  return {
    type: "preset",
    name: `adxStrong(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      let dmiData = indicators[cacheKey] as { time: number; value: { plusDi: number | null; minusDi: number | null; adx: number | null } }[] | undefined;

      if (!dmiData) {
        dmiData = dmi(candles, { period });
        indicators[cacheKey] = dmiData;
      }

      const d = dmiData[index]?.value;
      return d?.adx !== null && d?.adx !== undefined && d.adx >= threshold;
    },
  };
}

// ============================================
// Volume Conditions
// ============================================

/**
 * Volume above average (strong volume)
 * @param multiplier How many times the average (default: 1.5)
 */
export function volumeAboveAvg(multiplier = 1.5, period = 20): PresetCondition {
  const cacheKey = `volMa_${period}`;

  return {
    type: "preset",
    name: `volumeAboveAvg(${multiplier}x)`,
    evaluate: (indicators, candle, index, candles) => {
      let volMaData = indicators[cacheKey] as { time: number; value: number | null }[] | undefined;

      if (!volMaData) {
        volMaData = volumeMa(candles, { period });
        indicators[cacheKey] = volMaData;
      }

      const avgVol = volMaData[index]?.value;
      if (avgVol === null || avgVol === undefined) return false;

      return candle.volume > avgVol * multiplier;
    },
  };
}

// ============================================
// Range-Bound (Box Range) Conditions
// ============================================

/**
 * Options for range-bound conditions
 */
export type RangeBoundConditionOptions = RangeBoundOptions;

/**
 * Get cached range-bound data
 */
function getRangeBoundData(
  indicators: Record<string, unknown>,
  candles: NormalizedCandle[],
  options: RangeBoundConditionOptions
): { time: number; value: RangeBoundValue }[] {
  const cacheKey = `rangeBound_${JSON.stringify(options)}`;
  let rbData = indicators[cacheKey] as { time: number; value: RangeBoundValue }[] | undefined;

  if (!rbData) {
    rbData = rangeBound(candles, options);
    indicators[cacheKey] = rbData;
  }

  return rbData;
}

/**
 * In range-bound market (RANGE_CONFIRMED or RANGE_TIGHT state)
 * Use this to filter out trend-following signals during consolidation
 */
export function inRangeBound(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "inRangeBound()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      const rb = rbData[index]?.value;
      if (!rb) return false;

      return rb.state === "RANGE_CONFIRMED" || rb.state === "RANGE_TIGHT";
    },
  };
}

/**
 * Range forming detected (event flag - fires once when range starts forming)
 */
export function rangeForming(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeForming()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeDetected ?? false;
    },
  };
}

/**
 * Range confirmed (event flag - fires once when range is confirmed after persist bars)
 */
export function rangeConfirmed(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeConfirmed()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeConfirmed ?? false;
    },
  };
}

/**
 * Breakout risk to upside (price near upper range boundary)
 */
export function breakoutRiskUp(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "breakoutRiskUp()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "BREAKOUT_RISK_UP";
    },
  };
}

/**
 * Breakout risk to downside (price near lower range boundary)
 */
export function breakoutRiskDown(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "breakoutRiskDown()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "BREAKOUT_RISK_DOWN";
    },
  };
}

/**
 * Range breakout (event flag - fires when transitioning from range to trending)
 */
export function rangeBreakout(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "rangeBreakout()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.rangeBroken ?? false;
    },
  };
}

/**
 * Tight range (very low volatility, often precedes breakout)
 */
export function tightRange(options: RangeBoundConditionOptions = {}): PresetCondition {
  return {
    type: "preset",
    name: "tightRange()",
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      return rbData[index]?.value.state === "RANGE_TIGHT";
    },
  };
}

/**
 * Range score above threshold
 * @param threshold Score threshold (0-100, default: 60)
 */
export function rangeScoreAbove(
  threshold = 60,
  options: RangeBoundConditionOptions = {}
): PresetCondition {
  return {
    type: "preset",
    name: `rangeScoreAbove(${threshold})`,
    evaluate: (indicators, candle, index, candles) => {
      const rbData = getRangeBoundData(indicators, candles, options);
      const rb = rbData[index]?.value;
      return rb?.rangeScore !== undefined && rb.rangeScore >= threshold;
    },
  };
}
