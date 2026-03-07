/**
 * Helper types and utility functions for Double Top/Bottom pattern detection
 */

import type { NormalizedCandle } from "../../types";

// Helper types
export interface SwingPoint {
  index: number;
  price: number;
}

/**
 * Interpolate time between two points to find where price crosses a target level
 * Used in strict mode to find neckline intersection points
 */
export function interpolateTime(
  t1: number,
  p1: number,
  t2: number,
  p2: number,
  targetPrice: number,
): number {
  if (p2 === p1) return t1; // Horizontal line case
  return t1 + ((targetPrice - p1) * (t2 - t1)) / (p2 - p1);
}

/**
 * Find a swing point between two indices based on a comparator
 */
export function findSwingPointBetween(
  swings: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
  comparator: (a: number, b: number) => boolean,
): SwingPoint | null {
  let result: SwingPoint | null = null;

  for (const swing of swings) {
    if (swing.index > startIndex && swing.index < endIndex) {
      if (!result || comparator(swing.price, result.price)) {
        result = { index: swing.index, price: swing.price };
      }
    }
  }

  return result;
}

/**
 * Find the lowest swing low between two indices
 */
export function findMiddleTrough(
  swingLows: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null {
  return findSwingPointBetween(swingLows, startIndex, endIndex, (a, b) => a < b);
}

/**
 * Find the highest swing high between two indices
 */
export function findMiddlePeak(
  swingHighs: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null {
  return findSwingPointBetween(swingHighs, startIndex, endIndex, (a, b) => a > b);
}

/**
 * Find the candle where price broke through neckline
 * Returns the index and price of the breakout candle
 * @param candles - Candle data
 * @param fromIndex - Index to start searching from
 * @param necklinePrice - Neckline price level
 * @param direction - Direction of breakout ("up" or "down")
 * @param maxDistance - Maximum bars to search from fromIndex (default: unlimited)
 */
export function findNecklineBreakPoint(
  candles: NormalizedCandle[],
  fromIndex: number,
  necklinePrice: number,
  direction: "up" | "down",
  maxDistance?: number,
): { index: number; price: number } | null {
  const endIndex =
    maxDistance !== undefined
      ? Math.min(fromIndex + 1 + maxDistance, candles.length)
      : candles.length;

  for (let i = fromIndex + 1; i < endIndex; i++) {
    if (direction === "down" && candles[i].close < necklinePrice) {
      return { index: i, price: candles[i].close };
    }
    if (direction === "up" && candles[i].close > necklinePrice) {
      return { index: i, price: candles[i].close };
    }
  }
  return null;
}

/**
 * Find the closest swing point before the given index
 */
export function findPrecedingSwing(
  swings: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  let closest: SwingPoint | null = null;

  for (const swing of swings) {
    if (swing.index < beforeIndex) {
      if (!closest || swing.index > closest.index) {
        closest = { index: swing.index, price: swing.price };
      }
    }
  }

  return closest;
}

/**
 * Find the closest swing high before the given index
 */
export function findPrecedingSwingHigh(
  swingHighs: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  return findPrecedingSwing(swingHighs, beforeIndex);
}

/**
 * Find the closest swing low before the given index
 */
export function findPrecedingSwingLow(
  swingLows: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  return findPrecedingSwing(swingLows, beforeIndex);
}

/**
 * Check if there's a swing point between two indices that crosses a threshold
 */
export function hasSwingBeyondThreshold(
  swings: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
  threshold: number,
  comparator: (price: number, threshold: number) => boolean,
): boolean {
  for (const swing of swings) {
    if (swing.index > startIndex && swing.index < endIndex) {
      if (comparator(swing.price, threshold)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Check if there's a swing low between two indices that is lower than the given price
 */
export function hasLowerSwingLow(
  swingLows: { time: number; index: number; price: number }[],
  firstTroughIndex: number,
  secondTroughIndex: number,
  lowestTroughPrice: number,
): boolean {
  return hasSwingBeyondThreshold(
    swingLows,
    firstTroughIndex,
    secondTroughIndex,
    lowestTroughPrice,
    (price, threshold) => price < threshold,
  );
}

/**
 * Check if there's a swing high between two indices that is higher than the given price
 */
export function hasHigherSwingHigh(
  swingHighs: { time: number; index: number; price: number }[],
  firstPeakIndex: number,
  secondPeakIndex: number,
  highestPeakPrice: number,
): boolean {
  return hasSwingBeyondThreshold(
    swingHighs,
    firstPeakIndex,
    secondPeakIndex,
    highestPeakPrice,
    (price, threshold) => price > threshold,
  );
}

/**
 * Validate breakout volume - check if volume increased on breakout
 * @returns true if volume validation passes or is skipped
 */
export function validateBreakoutVolume(
  candles: NormalizedCandle[],
  breakoutIndex: number,
  lookbackPeriod: number,
  minIncrease: number,
): boolean {
  // Skip validation if not enough data
  if (breakoutIndex < lookbackPeriod || breakoutIndex >= candles.length) {
    return true;
  }

  const breakoutVolume = candles[breakoutIndex].volume;
  const avgVolume =
    candles
      .slice(breakoutIndex - lookbackPeriod, breakoutIndex)
      .reduce((sum, c) => sum + c.volume, 0) / lookbackPeriod;

  // If average volume is 0, skip validation
  if (avgVolume === 0) return true;

  return breakoutVolume >= avgVolume * minIncrease;
}

/**
 * Count how many times price crosses the neckline between two indices
 * High crosses indicate a "messy" neckline that doesn't act as clear support/resistance
 */
export function countNecklineCrosses(
  candles: NormalizedCandle[],
  startIndex: number,
  endIndex: number,
  necklinePrice: number,
): number {
  if (startIndex >= endIndex || startIndex < 0 || endIndex >= candles.length) {
    return 0;
  }

  let crosses = 0;
  let wasAbove = candles[startIndex].close > necklinePrice;

  for (let i = startIndex + 1; i <= endIndex; i++) {
    const isAbove = candles[i].close > necklinePrice;
    if (isAbove !== wasAbove) {
      crosses++;
      wasAbove = isAbove;
    }
  }

  return crosses;
}

/**
 * Check if any candle violates the neckline during pattern formation
 * For double bottom: checks if any high exceeds neckline (middlePeak price)
 * For double top: checks if any low goes below neckline (middleTrough price)
 *
 * @param candles - Candle data
 * @param startIndex - Start of range to check
 * @param endIndex - End of range to check
 * @param necklinePrice - Neckline price level
 * @param direction - "above" for double bottom (check highs), "below" for double top (check lows)
 * @param tolerancePercent - Tolerance for small violations (default: 0.005 = 0.5%)
 * @returns true if a violation exists, false otherwise
 */
export function hasNecklineViolation(
  candles: NormalizedCandle[],
  startIndex: number,
  endIndex: number,
  necklinePrice: number,
  direction: "above" | "below",
  tolerancePercent = 0,
  middleIndex?: number,
): boolean {
  // Need at least one candle between start and end (exclusive range)
  if (startIndex + 1 >= endIndex || startIndex < 0 || endIndex > candles.length) {
    return false;
  }

  const tolerance = necklinePrice * tolerancePercent;
  const threshold = direction === "above" ? necklinePrice + tolerance : necklinePrice - tolerance;

  // Check candles BETWEEN start and end (exclusive - don't check the peaks/troughs themselves)
  for (let i = startIndex + 1; i < endIndex; i++) {
    // Skip the middle peak/trough itself (it defines the neckline)
    if (middleIndex !== undefined && i === middleIndex) {
      continue;
    }

    if (direction === "above") {
      // For double bottom: check if high exceeds neckline
      if (candles[i].high > threshold) {
        return true;
      }
    } else {
      // For double top: check if low goes below neckline
      if (candles[i].low < threshold) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate prominence (how much a peak/trough stands out from its surroundings)
 * Prominence measures how "independent" a peak/trough is - higher values mean more prominent
 *
 * For a peak: prominence = (peakPrice - max(leftValley, rightValley)) / peakPrice
 * For a trough: prominence = (min(leftPeak, rightPeak) - troughPrice) / troughPrice
 *
 * @returns Prominence as a percentage (0-1)
 */
export function calculateProminence(
  candles: NormalizedCandle[],
  index: number,
  type: "peak" | "trough",
  lookback = 10,
): number {
  const start = Math.max(0, index - lookback);
  const end = Math.min(candles.length - 1, index + lookback);

  if (type === "peak") {
    const peakPrice = candles[index].high;
    // Find lowest points on left and right sides
    let leftMin = peakPrice;
    let rightMin = peakPrice;

    for (let i = start; i < index; i++) {
      leftMin = Math.min(leftMin, candles[i].low);
    }
    for (let i = index + 1; i <= end; i++) {
      rightMin = Math.min(rightMin, candles[i].low);
    }

    // Prominence = drop from peak to the higher of the two valleys (key level)
    const keyLevel = Math.max(leftMin, rightMin);
    return (peakPrice - keyLevel) / peakPrice;
  }
  const troughPrice = candles[index].low;
  // Find highest points on left and right sides
  let leftMax = troughPrice;
  let rightMax = troughPrice;

  for (let i = start; i < index; i++) {
    leftMax = Math.max(leftMax, candles[i].high);
  }
  for (let i = index + 1; i <= end; i++) {
    rightMax = Math.max(rightMax, candles[i].high);
  }

  // Prominence = rise from trough to the lower of the two peaks (key level)
  const keyLevel = Math.min(leftMax, rightMax);
  return (keyLevel - troughPrice) / troughPrice;
}

/**
 * Calculate confidence score for double patterns
 */
export function calculateDoublePatternConfidence(
  price1: number,
  price2: number,
  depth: number,
  toleranceUsed: number,
  confirmed: boolean,
  volumeValid: boolean,
  necklineCrosses: number,
  prominence1: number,
  prominence2: number,
): number {
  let confidence = 50; // Base confidence

  // Better price match = higher confidence
  const priceDiff = Math.abs(price1 - price2) / price1;
  const matchQuality = 1 - priceDiff / toleranceUsed;
  confidence += matchQuality * 20;

  // Deeper middle = more reliable pattern
  if (depth > 0.15) confidence += 10;
  if (depth > 0.2) confidence += 10;

  // Confirmation is key
  if (confirmed) confidence += 15;

  // Volume validation penalty
  if (!volumeValid) {
    confidence -= 15;
  }

  // Neckline quality penalty (messy neckline = lower confidence)
  if (necklineCrosses > 2) confidence -= 10;
  if (necklineCrosses > 4) confidence -= 10;

  // Prominence bonus - more prominent peaks/troughs = more reliable pattern
  const avgProminence = (prominence1 + prominence2) / 2;
  if (avgProminence > 0.03) confidence += 10;
  if (avgProminence > 0.05) confidence += 5;

  return Math.max(0, Math.min(100, Math.round(confidence)));
}
