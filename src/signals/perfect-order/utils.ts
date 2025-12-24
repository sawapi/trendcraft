import { ema } from "../../indicators/moving-average/ema";
import { sma } from "../../indicators/moving-average/sma";
import { wma } from "../../indicators/moving-average/wma";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import type { PerfectOrderType, SlopeDirection } from "./types";

export { isNormalized } from "../../core/normalize";

/**
 * Get the appropriate MA function based on type
 */
export function getMaFunction(
  maType: "sma" | "ema" | "wma",
): (
  candles: NormalizedCandle[],
  options: { period: number; source: PriceSource },
) => Series<number | null> {
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
export function isMaOrderBullish(maValues: number[]): boolean {
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
export function isMaOrderBearish(maValues: number[]): boolean {
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
export function determinePerfectOrderTypeWithHysteresis(
  maValues: (number | null)[],
  price: number,
  prevType: PerfectOrderType,
  margin: number,
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
export function calculateStrength(
  maValues: (number | null)[],
  type: PerfectOrderType,
  price: number,
): number {
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
  const spreadVariance =
    spreads.reduce((sum, s) => sum + Math.pow(s - avgSpread, 2), 0) / spreads.length;
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
 * Calculate slope direction of a series at a given index
 *
 * @param series - Array of values (may contain nulls)
 * @param t - Current index
 * @param lookback - Number of bars to look back
 * @param flatEps - Threshold for flat detection (relative change per bar)
 * @returns Slope direction: UP, DOWN, or FLAT
 */
export function slopeSign(
  series: (number | null)[],
  t: number,
  lookback: number,
  flatEps: number,
): SlopeDirection {
  if (t < lookback) return "FLAT";

  const current = series[t];
  const past = series[t - lookback];

  if (current === null || past === null || past === 0) return "FLAT";

  // Calculate relative change per bar
  const relativeChangePerBar = (current - past) / past / lookback;

  if (relativeChangePerBar > flatEps) return "UP";
  if (relativeChangePerBar < -flatEps) return "DOWN";
  return "FLAT";
}

/**
 * Check if MAs are collapsed (converged within threshold)
 *
 * @param maValues - MA values (short to long)
 * @param collapseEps - Convergence threshold as ratio
 * @returns True if all MAs are within collapseEps of each other
 */
export function isCollapsed(maValues: (number | null)[], collapseEps: number): boolean {
  const values = maValues.filter((v): v is number => v !== null);
  if (values.length < 2) return false;

  // Use longest MA as reference (most stable)
  const reference = values[values.length - 1];
  if (reference === 0) return false;

  const max = Math.max(...values);
  const min = Math.min(...values);

  return (max - min) / reference < collapseEps;
}

/**
 * Map enhanced state to legacy type
 */
export function stateToLegacyType(state: import("./types").PerfectOrderState): PerfectOrderType {
  switch (state) {
    case "BULLISH_PO":
    case "PRE_BULLISH_PO":
      return "bullish";
    case "BEARISH_PO":
    case "PRE_BEARISH_PO":
      return "bearish";
    default:
      return "none";
  }
}
