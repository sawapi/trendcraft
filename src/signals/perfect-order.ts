/**
 * Perfect Order detection for trading signals
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 */

import { normalizeCandles } from "../core/normalize";
import { sma } from "../indicators/moving-average/sma";
import { ema } from "../indicators/moving-average/ema";
import { wma } from "../indicators/moving-average/wma";
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
};

/**
 * Detect Perfect Order alignment of multiple moving averages
 *
 * Perfect Order occurs when MAs are aligned in order:
 * - Bullish: Short MA > Medium MA > Long MA (uptrend)
 * - Bearish: Short MA < Medium MA < Long MA (downtrend)
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
 * // Find formation signals
 * const formations = po.filter(p => p.value.formed);
 * ```
 */
export function perfectOrder(
  candles: Candle[] | NormalizedCandle[],
  options: PerfectOrderOptions = {}
): Series<PerfectOrderValue> {
  const { periods = [5, 25, 75], maType = "sma", source = "close" } = options;

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
    const maValues = maSeries.map((series) => series[i].value);

    // Determine perfect order type
    const type = determinePerfectOrderType(maValues);

    // Detect formation and collapse
    const formed = prevType === "none" && type !== "none";
    const collapsed = prevType !== "none" && type === "none";

    // Calculate strength
    const strength = type !== "none" ? calculateStrength(maValues, type) : 0;

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
 * Determine perfect order type from MA values
 * Returns 'bullish' if all MAs are in descending order (short > long)
 * Returns 'bearish' if all MAs are in ascending order (short < long)
 * Returns 'none' if MAs are not in perfect order
 */
function determinePerfectOrderType(maValues: (number | null)[]): PerfectOrderType {
  // Check for null values
  if (maValues.some((v) => v === null)) {
    return "none";
  }

  const values = maValues as number[];

  // Check bullish: each value should be greater than the next (short > medium > long)
  let isBullish = true;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] <= values[i + 1]) {
      isBullish = false;
      break;
    }
  }

  if (isBullish) {
    return "bullish";
  }

  // Check bearish: each value should be less than the next (short < medium < long)
  let isBearish = true;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] >= values[i + 1]) {
      isBearish = false;
      break;
    }
  }

  if (isBearish) {
    return "bearish";
  }

  return "none";
}

/**
 * Calculate strength score (0-100) based on MA spread
 *
 * Factors considered:
 * 1. Total spread between shortest and longest MA (as % of price)
 * 2. Uniformity of spacing between MAs
 */
function calculateStrength(maValues: (number | null)[], type: PerfectOrderType): number {
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

  // Spread score: 0-50 points based on total spread
  // 2% spread = 50 points, scales linearly, capped at 50
  const spreadScore = Math.min(50, totalSpreadPercent * 25);

  // Uniformity score: 0-50 points
  const uniformityPoints = uniformityScore * 50;

  // Total score
  const totalScore = Math.round(spreadScore + uniformityPoints);

  return Math.min(100, Math.max(0, totalScore));
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
