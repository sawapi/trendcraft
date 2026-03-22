/**
 * Trendline fitting utilities for chart pattern detection
 *
 * Provides OLS-based trendline fitting for swing point groups,
 * convergence analysis, trendline pair classification, and shared
 * helpers used by triangle/wedge/channel/flag pattern detectors.
 */

import { olsRegression } from "../../pairs/regression";
import type { NormalizedCandle, Series } from "../../types";
import { validateBreakoutVolume } from "./double-pattern-utils";
import type { SwingPoint } from "./double-pattern-utils";
import type { PatternKeyPoint } from "./types";

/**
 * Result of fitting a trendline to swing points
 */
export interface TrendlineFit {
  /** Slope in price/bar units */
  slope: number;
  /** Y-intercept (price at index 0) */
  intercept: number;
  /** Goodness of fit (0-1, higher = better) */
  rSquared: number;
  /** Swing points used for fitting */
  points: SwingPoint[];
  /** Get the trendline price at any bar index */
  valueAt(index: number): number;
}

/**
 * Classification of a trendline pair relationship
 */
export type TrendlinePairType =
  | "converging"
  | "diverging"
  | "parallel"
  | "ascending"
  | "descending";

/**
 * Fit a trendline (OLS regression) to a set of swing points
 *
 * @param points - Swing points (must have at least 2)
 * @returns Fitted trendline, or null if insufficient points
 *
 * @example
 * ```ts
 * const highs = getSwingHighs(candles, { leftBars: 3, rightBars: 3 });
 * const swings = highs.map(h => ({ index: h.index, price: h.price }));
 * const line = fitTrendline(swings);
 * if (line) console.log(`slope=${line.slope}, R²=${line.rSquared}`);
 * ```
 */
export function fitTrendline(points: SwingPoint[]): TrendlineFit | null {
  if (points.length < 2) return null;

  const x = points.map((p) => p.index);
  const y = points.map((p) => p.price);
  const { beta, intercept, rSquared } = olsRegression(x, y);

  return {
    slope: beta,
    intercept,
    rSquared,
    points: [...points],
    valueAt(index: number): number {
      return beta * index + intercept;
    },
  };
}

/**
 * Fit upper and lower trendlines from swing highs and lows
 *
 * @param highs - Swing high points (at least 2)
 * @param lows - Swing low points (at least 2)
 * @returns Trendline pair with convergence bar estimate, or null if fitting fails
 *
 * @example
 * ```ts
 * const pair = fitTrendlinePair(swingHighs, swingLows);
 * if (pair?.convergenceBar) {
 *   console.log(`Lines converge at bar ${pair.convergenceBar}`);
 * }
 * ```
 */
export function fitTrendlinePair(
  highs: SwingPoint[],
  lows: SwingPoint[],
): { upper: TrendlineFit; lower: TrendlineFit; convergenceBar: number | null } | null {
  const upper = fitTrendline(highs);
  const lower = fitTrendline(lows);

  if (!upper || !lower) return null;

  // Calculate convergence point (where upper and lower lines meet)
  let convergenceBar: number | null = null;
  const slopeDiff = upper.slope - lower.slope;

  if (Math.abs(slopeDiff) > 1e-10) {
    const bar = (lower.intercept - upper.intercept) / slopeDiff;
    // Only report convergence if it's in the future relative to the last point
    const lastIndex = Math.max(...highs.map((p) => p.index), ...lows.map((p) => p.index));
    if (bar > lastIndex) {
      convergenceBar = Math.round(bar);
    }
  }

  return { upper, lower, convergenceBar };
}

/**
 * Classify the relationship between upper and lower trendlines
 *
 * - `converging`: Lines approach each other (triangle/wedge shapes)
 * - `diverging`: Lines spread apart (broadening formations)
 * - `parallel`: Lines move at similar slopes (channels)
 * - `ascending`: Both lines slope upward (ascending wedge/channel)
 * - `descending`: Both lines slope downward (descending wedge/channel)
 *
 * @param upper - Upper trendline fit
 * @param lower - Lower trendline fit
 * @param slopeTolerance - Threshold for "flat" slope (default: 0.001)
 * @param parallelTolerance - Max slope difference ratio for "parallel" (default: 0.3)
 * @returns Classification string
 *
 * @example
 * ```ts
 * const type = classifyTrendlinePair(pair.upper, pair.lower);
 * // 'converging' for triangle, 'parallel' for channel
 * ```
 */
export function classifyTrendlinePair(
  upper: TrendlineFit,
  lower: TrendlineFit,
  slopeTolerance = 0.001,
  parallelTolerance = 0.3,
): TrendlinePairType {
  const slopeDiff = upper.slope - lower.slope;

  // Normalize slope difference by average price range for scale-independent comparison
  const avgPrice =
    (upper.points.reduce((s, p) => s + p.price, 0) / upper.points.length +
      lower.points.reduce((s, p) => s + p.price, 0) / lower.points.length) /
    2;

  const normalizedSlopeDiff = avgPrice > 0 ? Math.abs(slopeDiff) / avgPrice : Math.abs(slopeDiff);

  // Check if slopes are similar enough to be parallel
  if (normalizedSlopeDiff < parallelTolerance * slopeTolerance) {
    // Further classify parallel lines by direction
    const normalizedUpper = avgPrice > 0 ? upper.slope / avgPrice : upper.slope;
    const normalizedLower = avgPrice > 0 ? lower.slope / avgPrice : lower.slope;
    const isUpperFlat = Math.abs(normalizedUpper) < slopeTolerance;
    const isLowerFlat = Math.abs(normalizedLower) < slopeTolerance;

    if (!isUpperFlat && !isLowerFlat) {
      if (upper.slope > 0 && lower.slope > 0) return "ascending";
      if (upper.slope < 0 && lower.slope < 0) return "descending";
    }

    return "parallel";
  }

  // Converging: upper slope < lower slope (gap narrows)
  if (slopeDiff < 0) return "converging";

  // Diverging: upper slope > lower slope (gap widens)
  return "diverging";
}

/**
 * Check if a slope is approximately flat (horizontal)
 *
 * @param slope - Trendline slope
 * @param avgPrice - Average price level for normalization
 * @param tolerance - Flatness threshold (default: 0.0002 = 0.02% per bar)
 */
export function isSlopeFlat(slope: number, avgPrice: number, tolerance = 0.0002): boolean {
  if (avgPrice <= 0) return Math.abs(slope) < tolerance;
  return Math.abs(slope / avgPrice) < tolerance;
}

/**
 * Calculate how well a set of points touches a trendline
 *
 * @param line - Fitted trendline
 * @param atrValue - ATR value for tolerance calculation
 * @param touchTolerance - Touch tolerance as ATR multiplier (default: 0.5)
 * @returns Number of points within touch tolerance
 */
export function countTouchPoints(
  line: TrendlineFit,
  atrValue: number,
  touchTolerance = 0.5,
): number {
  const tolerance = atrValue * touchTolerance;
  let touches = 0;

  for (const point of line.points) {
    const linePrice = line.valueAt(point.index);
    if (Math.abs(point.price - linePrice) <= tolerance) {
      touches++;
    }
  }

  return touches;
}

// ============================================
// Shared helpers for trendline-based pattern detectors
// ============================================

/**
 * Look up the ATR value at a specific candle index
 *
 * @param atrData - Pre-computed ATR series
 * @param candles - Candle array (used for time lookup)
 * @param index - Candle index to look up
 * @returns ATR value, or 0 if not found
 */
export function lookupAtr(
  atrData: Series<number | null>,
  candles: NormalizedCandle[],
  index: number,
): number {
  const time = candles[index].time;
  const entry = atrData.find((a) => a.time === time);
  return entry?.value != null ? entry.value : 0;
}

/**
 * Calculate pattern bounds (start/end indices) from swing point arrays
 *
 * @param highs - Swing high points
 * @param lows - Swing low points
 * @returns Object with startIndex and endIndex
 */
export function getPatternBounds(
  highs: SwingPoint[],
  lows: SwingPoint[],
): { startIndex: number; endIndex: number } {
  const allIndices = [...highs.map((p) => p.index), ...lows.map((p) => p.index)];
  return {
    startIndex: Math.min(...allIndices),
    endIndex: Math.max(...allIndices),
  };
}

/**
 * Calculate average closing price over a range of candles
 *
 * @param candles - Candle array
 * @param startIndex - Range start (inclusive)
 * @param endIndex - Range end (inclusive)
 * @returns Average close price
 */
export function avgClosePrice(
  candles: NormalizedCandle[],
  startIndex: number,
  endIndex: number,
): number {
  const slice = candles.slice(startIndex, endIndex + 1);
  return slice.reduce((s, c) => s + c.close, 0) / slice.length;
}

/**
 * Find a trendline breakout (close above upper or below lower)
 *
 * @param candles - Candle array
 * @param upper - Upper trendline
 * @param lower - Lower trendline
 * @param fromIndex - Start searching from this index
 * @param maxBars - Maximum bars to search
 * @returns Breakout index and direction, or null
 *
 * @example
 * ```ts
 * const breakout = findTrendlineBreakout(candles, upper, lower, endIndex + 1, 20);
 * if (breakout) console.log(`Broke ${breakout.direction} at bar ${breakout.index}`);
 * ```
 */
export function findTrendlineBreakout(
  candles: NormalizedCandle[],
  upper: TrendlineFit,
  lower: TrendlineFit,
  fromIndex: number,
  maxBars: number,
): { index: number; direction: "up" | "down" } | null {
  const endIndex = Math.min(fromIndex + maxBars, candles.length);

  for (let i = fromIndex; i < endIndex; i++) {
    if (candles[i].close > upper.valueAt(i)) return { index: i, direction: "up" };
    if (candles[i].close < lower.valueAt(i)) return { index: i, direction: "down" };
  }

  return null;
}

/**
 * Build key points from upper and lower swing point arrays
 *
 * @param candles - Candle array (for time lookup)
 * @param highs - Swing high points
 * @param lows - Swing low points
 * @returns Sorted array of PatternKeyPoint
 */
export function buildTouchKeyPoints(
  candles: NormalizedCandle[],
  highs: SwingPoint[],
  lows: SwingPoint[],
): PatternKeyPoint[] {
  const keyPoints: PatternKeyPoint[] = [];

  for (const p of highs) {
    keyPoints.push({
      time: candles[p.index].time,
      index: p.index,
      price: p.price,
      label: "upper_touch",
    });
  }
  for (const p of lows) {
    keyPoints.push({
      time: candles[p.index].time,
      index: p.index,
      price: p.price,
      label: "lower_touch",
    });
  }

  keyPoints.sort((a, b) => a.index - b.index);
  return keyPoints;
}

/**
 * Calculate measured-move target and stop-loss from a breakout
 *
 * @param candles - Candle array
 * @param breakout - Breakout info (index + direction)
 * @param upper - Upper trendline
 * @param lower - Lower trendline
 * @param moveSize - Size of the measured move (pattern height or pole magnitude)
 * @returns Target and stop-loss prices
 */
export function calculateBreakoutLevels(
  candles: NormalizedCandle[],
  breakout: { index: number; direction: "up" | "down" },
  upper: TrendlineFit,
  lower: TrendlineFit,
  moveSize: number,
): { target: number; stopLoss: number } {
  const breakoutPrice = candles[breakout.index].close;

  if (breakout.direction === "up") {
    return {
      target: breakoutPrice + moveSize,
      stopLoss: lower.valueAt(breakout.index),
    };
  }

  return {
    target: breakoutPrice - moveSize,
    stopLoss: upper.valueAt(breakout.index),
  };
}

/**
 * Validate breakout volume and apply confidence penalty if invalid
 *
 * @param candles - Candle array
 * @param breakoutIndex - Index of the breakout candle
 * @param validateVolume - Whether to validate volume
 * @param volumeLookback - Lookback period for average volume
 * @param minVolumeIncrease - Minimum volume increase ratio
 * @returns Whether volume is valid
 */
export function checkBreakoutVolume(
  candles: NormalizedCandle[],
  breakoutIndex: number,
  validateVolume: boolean,
  volumeLookback: number,
  minVolumeIncrease: number,
): boolean {
  if (!validateVolume) return true;
  return validateBreakoutVolume(candles, breakoutIndex, volumeLookback, minVolumeIncrease);
}

/**
 * Calculate base confidence score from trendline quality metrics
 *
 * Common scoring used by triangle, wedge, and channel detectors.
 * Each pattern adds its own specific bonuses on top.
 *
 * @param upper - Upper trendline
 * @param lower - Lower trendline
 * @param atrValue - Current ATR value
 * @param baseScore - Starting confidence score
 * @returns Partial confidence score (not yet clamped)
 */
export function calculateBaseConfidence(
  upper: TrendlineFit,
  lower: TrendlineFit,
  atrValue: number,
  baseScore: number,
): number {
  let confidence = baseScore;

  // R-squared quality bonus (average of both lines, up to +20)
  const avgR2 = (upper.rSquared + lower.rSquared) / 2;
  confidence += avgR2 * 20;

  // Touch points bonus
  const totalTouches = countTouchPoints(upper, atrValue) + countTouchPoints(lower, atrValue);
  if (totalTouches >= 5) confidence += 10;
  if (totalTouches >= 7) confidence += 5;

  return confidence;
}

/**
 * Clamp a confidence value to the 0-100 range
 */
export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
