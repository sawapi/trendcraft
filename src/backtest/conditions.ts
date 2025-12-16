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

import { perfectOrder, type PerfectOrderValue } from "../signals/perfect-order";

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
