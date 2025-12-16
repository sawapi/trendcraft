/**
 * Perfect Order detection for trading signals
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 *
 * Uses hysteresis to prevent noise from price crossing the short MA:
 * - Formation requires: price > shortMA AND MA order OK
 * - Continuation requires: price > shortMA × (1 - margin) AND MA order OK
 * - Collapse when: price < shortMA × (1 - margin) OR MA order broken
 */

import { normalizeCandles } from "../core/normalize";
import { sma } from "../indicators/moving-average/sma";
import { ema } from "../indicators/moving-average/ema";
import { wma } from "../indicators/moving-average/wma";
import { getPrice } from "../core/normalize";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../types";

/**
 * Perfect order type
 */
export type PerfectOrderType = "bullish" | "bearish" | "none";

/**
 * Perfect order result for each candle
 */
export type PerfectOrderValue = {
  /** Current perfect order state */
  type: PerfectOrderType;
  /** True when perfect order just formed on this candle */
  formed: boolean;
  /** True when perfect order just collapsed on this candle */
  collapsed: boolean;
  /** Trend strength score (0-100, 0 when type is 'none') */
  strength: number;
  /** MA values in order (short to long) */
  maValues: (number | null)[];
};

/** Default hysteresis margin (1%) */
const DEFAULT_HYSTERESIS_MARGIN = 0.01;

/**
 * Options for perfect order detection
 */
export type PerfectOrderOptions = {
  /** MA periods (default: [5, 25, 75] - Japanese stock standard) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Price source (default: 'close') */
  source?: PriceSource;
  /** Hysteresis margin for price position check (default: 0.01 = 1%) */
  hysteresisMargin?: number;
};

/**
 * Detect Perfect Order alignment of multiple moving averages
 *
 * Perfect Order occurs when MAs are aligned in order AND price is positioned correctly:
 * - Bullish: Price > Short MA > Medium MA > Long MA (uptrend)
 * - Bearish: Price < Short MA < Medium MA < Long MA (downtrend)
 *
 * Uses hysteresis (1% default margin) to prevent noise from price crossing the short MA:
 * - Formation: price must be above/below shortMA (strict)
 * - Continuation: price can be within margin of shortMA (relaxed)
 * - Collapse: price falls below/above margin OR MA order breaks
 *
 * The strength score (0-100) reflects how "ideal" the perfect order is:
 * - MA spread: wider spread = stronger trend
 * - MA uniformity: evenly spaced MAs = healthier trend
 * - Price position: price deviation from short MA adds bonus points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Perfect order options
 * @returns Series of perfect order values with formation/collapse signals
 *
 * @example
 * ```ts
 * // Default: 5, 25, 75 SMA (Japanese stock standard)
 * const po = perfectOrder(candles);
 *
 * // Custom periods with EMA
 * const po4 = perfectOrder(candles, {
 *   periods: [10, 20, 50, 200],
 *   maType: 'ema'
 * });
 *
 * // Find strong formation signals
 * const strongFormations = po.filter(p => p.value.formed && p.value.strength >= 50);
 * ```
 */
export function perfectOrder(
  candles: Candle[] | NormalizedCandle[],
  options: PerfectOrderOptions = {}
): Series<PerfectOrderValue> {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    source = "close",
    hysteresisMargin = DEFAULT_HYSTERESIS_MARGIN,
  } = options;

  // Sort and dedupe periods
  const sortedPeriods = [...new Set(periods)].sort((a, b) => a - b);

  if (sortedPeriods.length < 2) {
    throw new Error("At least 2 different periods are required");
  }

  if (sortedPeriods.some((p) => p < 1)) {
    throw new Error("All periods must be positive integers");
  }

  if (candles.length === 0) {
    return [];
  }

  // Normalize candles
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate all MAs
  const maFn = getMaFunction(maType);
  const maSeries = sortedPeriods.map((period) => maFn(normalized, { period, source }));

  // Build result
  const result: Series<PerfectOrderValue> = [];
  let prevType: PerfectOrderType = "none";

  for (let i = 0; i < normalized.length; i++) {
    const time = normalized[i].time;
    const price = getPrice(normalized[i], source);
    const maValues = maSeries.map((series) => series[i].value);

    // Determine perfect order type with hysteresis
    // - Formation: strict price check (price > shortMA for bullish)
    // - Continuation: relaxed price check (price > shortMA × (1 - margin))
    const type = determinePerfectOrderTypeWithHysteresis(
      maValues,
      price,
      prevType,
      hysteresisMargin
    );

    // Detect formation and collapse
    const formed = prevType === "none" && type !== "none";
    const collapsed = prevType !== "none" && type === "none";

    // Calculate strength (includes price deviation)
    const strength = type !== "none" ? calculateStrength(maValues, type, price) : 0;

    result.push({
      time,
      value: {
        type,
        formed,
        collapsed,
        strength,
        maValues,
      },
    });

    prevType = type;
  }

  return result;
}

/**
 * Get the appropriate MA function based on type
 */
function getMaFunction(
  maType: "sma" | "ema" | "wma"
): (candles: NormalizedCandle[], options: { period: number; source: PriceSource }) => Series<number | null> {
  switch (maType) {
    case "ema":
      return ema;
    case "wma":
      return wma;
    default:
      return sma;
  }
}

/**
 * Check if MAs are in bullish order (short > medium > long)
 */
function isMaOrderBullish(maValues: number[]): boolean {
  for (let i = 0; i < maValues.length - 1; i++) {
    if (maValues[i] <= maValues[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if MAs are in bearish order (short < medium < long)
 */
function isMaOrderBearish(maValues: number[]): boolean {
  for (let i = 0; i < maValues.length - 1; i++) {
    if (maValues[i] >= maValues[i + 1]) {
      return false;
    }
  }
  return true;
}

/**
 * Determine perfect order type with hysteresis
 *
 * Standard Perfect Order definition (Japanese stock trading):
 * - Bullish: Price > Short MA > Medium MA > Long MA
 * - Bearish: Price < Short MA < Medium MA < Long MA
 *
 * Hysteresis prevents noise from price crossing the short MA:
 * - Formation (from none): price must strictly cross the threshold
 * - Continuation (already in state): price can be within margin
 *
 * @param maValues - MA values in order (short to long)
 * @param price - Current price
 * @param prevType - Previous perfect order type
 * @param margin - Hysteresis margin (default 1%)
 */
function determinePerfectOrderTypeWithHysteresis(
  maValues: (number | null)[],
  price: number,
  prevType: PerfectOrderType,
  margin: number
): PerfectOrderType {
  // Check for null values
  if (maValues.some((v) => v === null)) {
    return "none";
  }

  const values = maValues as number[];
  const shortestMa = values[0];

  // Check MA order first
  const bullishMaOrder = isMaOrderBullish(values);
  const bearishMaOrder = isMaOrderBearish(values);

  // If MA order is not valid, return none
  if (!bullishMaOrder && !bearishMaOrder) {
    return "none";
  }

  // Price thresholds with hysteresis
  // For bullish: price > shortMA (formation), price > shortMA × (1 - margin) (continuation)
  // For bearish: price < shortMA (formation), price < shortMA × (1 + margin) (continuation)
  const bullishFormationThreshold = shortestMa;
  const bullishContinuationThreshold = shortestMa * (1 - margin);
  const bearishFormationThreshold = shortestMa;
  const bearishContinuationThreshold = shortestMa * (1 + margin);

  // Check bullish perfect order
  if (bullishMaOrder) {
    if (prevType === "bullish") {
      // Continuation: relaxed threshold
      if (price > bullishContinuationThreshold) {
        return "bullish";
      }
    } else {
      // Formation: strict threshold
      if (price > bullishFormationThreshold) {
        return "bullish";
      }
    }
  }

  // Check bearish perfect order
  if (bearishMaOrder) {
    if (prevType === "bearish") {
      // Continuation: relaxed threshold
      if (price < bearishContinuationThreshold) {
        return "bearish";
      }
    } else {
      // Formation: strict threshold
      if (price < bearishFormationThreshold) {
        return "bearish";
      }
    }
  }

  return "none";
}

/**
 * Calculate strength score (0-100) based on MA spread and price deviation
 *
 * Factors considered:
 * 1. Total spread between shortest and longest MA (as % of price) - 0-35 points
 * 2. Uniformity of spacing between MAs - 0-35 points
 * 3. Price deviation from shortest MA - 0-30 points (only if price is on correct side)
 *
 * For bullish: price > shortMA gives bonus points
 * For bearish: price < shortMA gives bonus points
 * If price is on wrong side, deviation score is 0 (weaker signal)
 */
function calculateStrength(maValues: (number | null)[], type: PerfectOrderType, price: number): number {
  const values = maValues as number[];

  if (values.length < 2) {
    return 0;
  }

  // Calculate total spread as percentage of the longest MA (most stable reference)
  const longestMa = values[values.length - 1];
  const shortestMa = values[0];
  const totalSpreadPercent = Math.abs((shortestMa - longestMa) / longestMa) * 100;

  // Calculate individual spreads between adjacent MAs
  const spreads: number[] = [];
  for (let i = 0; i < values.length - 1; i++) {
    const spread = Math.abs(values[i] - values[i + 1]);
    spreads.push(spread);
  }

  // Calculate uniformity: how evenly spaced are the MAs?
  // Perfect uniformity = 1.0, poor uniformity approaches 0
  const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
  const spreadVariance = spreads.reduce((sum, s) => sum + Math.pow(s - avgSpread, 2), 0) / spreads.length;
  const spreadStdDev = Math.sqrt(spreadVariance);
  const uniformityScore = avgSpread > 0 ? Math.max(0, 1 - spreadStdDev / avgSpread) : 0;

  // Calculate price deviation score (conditional on price being on correct side)
  // Bullish: price > shortMA gives bonus, otherwise 0
  // Bearish: price < shortMA gives bonus, otherwise 0
  let deviationScore = 0;
  if (type === "bullish" && price > shortestMa) {
    const deviationPercent = ((price - shortestMa) / shortestMa) * 100;
    deviationScore = Math.min(30, deviationPercent * 15);
  } else if (type === "bearish" && price < shortestMa) {
    const deviationPercent = ((shortestMa - price) / shortestMa) * 100;
    deviationScore = Math.min(30, deviationPercent * 15);
  }
  // If price is on wrong side (e.g., bullish but price < shortMA), deviationScore stays 0

  // Spread score: 0-35 points based on total spread
  // 2% spread = 35 points, scales linearly, capped at 35
  const spreadScore = Math.min(35, totalSpreadPercent * 17.5);

  // Uniformity score: 0-35 points
  const uniformityPoints = uniformityScore * 35;

  // Total score
  const totalScore = Math.round(spreadScore + uniformityPoints + deviationScore);

  return Math.min(100, Math.max(0, totalScore));
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
