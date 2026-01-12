/**
 * Double Top and Double Bottom Pattern Detection
 *
 * Double Top: Bearish reversal pattern with two peaks at similar levels
 * Double Bottom: Bullish reversal pattern with two troughs at similar levels
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import type { Candle, NormalizedCandle } from "../../types";
import type { DoublePatternOptions, PatternKeyPoint, PatternSignal } from "./types";

/**
 * Detect Double Top patterns
 *
 * A Double Top is a bearish reversal pattern consisting of:
 * 1. First peak (swing high)
 * 2. Middle trough (pullback)
 * 3. Second peak at similar level to first
 * 4. Confirmed when price breaks below the middle trough (neckline)
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected Double Top patterns
 *
 * @example
 * ```ts
 * const patterns = doubleTop(candles, { tolerance: 0.02 });
 * patterns.forEach(p => {
 *   console.log(`Double Top at ${p.time}, target: ${p.pattern.target}`);
 * });
 * ```
 */
export function doubleTop(
  candles: Candle[] | NormalizedCandle[],
  options: DoublePatternOptions = {},
): PatternSignal[] {
  const {
    tolerance = 0.02,
    minDistance = 10,
    maxDistance = 60,
    minMiddleDepth = 0.1,
    swingLookback = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < minDistance * 2) {
    return [];
  }

  // Get all swing highs and lows
  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const swingHighs = getSwingHighs(normalized, swingOpts);
  const swingLows = getSwingLows(normalized, swingOpts);

  const patterns: PatternSignal[] = [];
  // Track used swing points to prevent overlapping patterns
  const usedSwingIndexes = new Set<number>();

  // Look for pairs of swing highs at similar levels
  for (let i = 0; i < swingHighs.length - 1; i++) {
    const firstPeak = swingHighs[i];

    // Skip if this swing point is already used in another pattern
    if (usedSwingIndexes.has(firstPeak.index)) continue;

    for (let j = i + 1; j < swingHighs.length; j++) {
      const secondPeak = swingHighs[j];

      // Skip if this swing point is already used
      if (usedSwingIndexes.has(secondPeak.index)) continue;

      // Check distance constraints
      const distance = secondPeak.index - firstPeak.index;
      if (distance < minDistance || distance > maxDistance) continue;

      // Check price similarity
      const priceDiff = Math.abs(firstPeak.price - secondPeak.price) / firstPeak.price;
      if (priceDiff > tolerance) continue;

      // Double Top: second peak should not be significantly higher than first
      // Allow only up to half of tolerance above first peak
      if (secondPeak.price > firstPeak.price * (1 + tolerance * 0.5)) continue;

      // Find the middle trough between the two peaks
      const middleTrough = findMiddleTrough(swingLows, firstPeak.index, secondPeak.index);
      if (!middleTrough) continue;

      // Check middle depth
      const avgPeakPrice = (firstPeak.price + secondPeak.price) / 2;
      const depth = (avgPeakPrice - middleTrough.price) / avgPeakPrice;
      if (depth < minMiddleDepth) continue;

      // Calculate pattern metrics
      const patternHeight = avgPeakPrice - middleTrough.price;
      const target = middleTrough.price - patternHeight; // Measured move
      const necklinePrice = middleTrough.price;

      // Find breakdown point (price broke below neckline after second peak)
      const breakdownPoint = findNecklineBreakPoint(
        normalized,
        secondPeak.index,
        necklinePrice,
        "down",
      );
      const confirmed = breakdownPoint !== null;

      // Calculate confidence
      const confidence = calculateDoublePatternConfidence(
        firstPeak.price,
        secondPeak.price,
        depth,
        tolerance,
        confirmed,
      );

      // Find the preceding swing low before the first peak (start of the pattern)
      const startLow = findPrecedingSwingLow(swingLows, firstPeak.index);

      const keyPoints: PatternKeyPoint[] = [];
      if (startLow) {
        keyPoints.push({
          time: normalized[startLow.index].time,
          index: startLow.index,
          price: startLow.price,
          label: "Start Low",
        });
      }
      keyPoints.push(
        {
          time: normalized[firstPeak.index].time,
          index: firstPeak.index,
          price: firstPeak.price,
          label: "First Peak",
        },
        {
          time: normalized[middleTrough.index].time,
          index: middleTrough.index,
          price: middleTrough.price,
          label: "Middle Trough",
        },
        {
          time: normalized[secondPeak.index].time,
          index: secondPeak.index,
          price: secondPeak.price,
          label: "Second Peak",
        },
      );

      // Add breakdown point as 5th keyPoint for M-shape polygon
      if (breakdownPoint) {
        keyPoints.push({
          time: normalized[breakdownPoint.index].time,
          index: breakdownPoint.index,
          price: breakdownPoint.price,
          label: "End Low",
        });
      }

      // Use start low as pattern start if available, otherwise first peak
      const patternStartTime = startLow
        ? normalized[startLow.index].time
        : normalized[firstPeak.index].time;
      const patternEndTime = breakdownPoint
        ? normalized[breakdownPoint.index].time
        : normalized[secondPeak.index].time;

      patterns.push({
        time: normalized[secondPeak.index].time,
        type: "double_top",
        pattern: {
          startTime: patternStartTime,
          endTime: patternEndTime,
          keyPoints,
          neckline: {
            startPrice: necklinePrice,
            endPrice: necklinePrice,
            slope: 0,
            currentPrice: necklinePrice,
          },
          target,
          stopLoss: Math.max(firstPeak.price, secondPeak.price) * 1.01, // 1% above highest peak
          height: patternHeight,
        },
        confidence,
        confirmed,
      });

      // Mark swing points as used to prevent overlapping patterns
      usedSwingIndexes.add(firstPeak.index);
      usedSwingIndexes.add(secondPeak.index);
      break;
    }
  }

  return patterns;
}

/**
 * Detect Double Bottom patterns
 *
 * A Double Bottom is a bullish reversal pattern consisting of:
 * 1. First trough (swing low)
 * 2. Middle peak (rally)
 * 3. Second trough at similar level to first
 * 4. Confirmed when price breaks above the middle peak (neckline)
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected Double Bottom patterns
 */
export function doubleBottom(
  candles: Candle[] | NormalizedCandle[],
  options: DoublePatternOptions = {},
): PatternSignal[] {
  const {
    tolerance = 0.02,
    minDistance = 10,
    maxDistance = 60,
    minMiddleDepth = 0.1,
    swingLookback = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < minDistance * 2) {
    return [];
  }

  // Get all swing highs and lows
  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const swingHighs = getSwingHighs(normalized, swingOpts);
  const swingLows = getSwingLows(normalized, swingOpts);

  const patterns: PatternSignal[] = [];
  // Track used swing points to prevent overlapping patterns
  const usedSwingIndexes = new Set<number>();

  // Look for pairs of swing lows at similar levels
  for (let i = 0; i < swingLows.length - 1; i++) {
    const firstTrough = swingLows[i];

    // Skip if this swing point is already used in another pattern
    if (usedSwingIndexes.has(firstTrough.index)) continue;

    for (let j = i + 1; j < swingLows.length; j++) {
      const secondTrough = swingLows[j];

      // Skip if this swing point is already used
      if (usedSwingIndexes.has(secondTrough.index)) continue;

      // Check distance constraints
      const distance = secondTrough.index - firstTrough.index;
      if (distance < minDistance || distance > maxDistance) continue;

      // Check price similarity
      const priceDiff = Math.abs(firstTrough.price - secondTrough.price) / firstTrough.price;
      if (priceDiff > tolerance) continue;

      // Double Bottom: second trough should not be significantly higher than first
      // Allow only up to half of tolerance above first trough
      if (secondTrough.price > firstTrough.price * (1 + tolerance * 0.5)) continue;

      // Find the middle peak between the two troughs
      const middlePeak = findMiddlePeak(swingHighs, firstTrough.index, secondTrough.index);
      if (!middlePeak) continue;

      // Check middle depth
      const avgTroughPrice = (firstTrough.price + secondTrough.price) / 2;
      const depth = (middlePeak.price - avgTroughPrice) / avgTroughPrice;
      if (depth < minMiddleDepth) continue;

      // Calculate pattern metrics
      const patternHeight = middlePeak.price - avgTroughPrice;
      const target = middlePeak.price + patternHeight; // Measured move
      const necklinePrice = middlePeak.price;

      // Find breakout point (price broke above neckline after second trough)
      const breakoutPoint = findNecklineBreakPoint(
        normalized,
        secondTrough.index,
        necklinePrice,
        "up",
      );
      const confirmed = breakoutPoint !== null;

      // Calculate confidence
      const confidence = calculateDoublePatternConfidence(
        firstTrough.price,
        secondTrough.price,
        depth,
        tolerance,
        confirmed,
      );

      // Find the preceding swing high before the first trough (start of the pattern)
      const startHigh = findPrecedingSwingHigh(swingHighs, firstTrough.index);

      const keyPoints: PatternKeyPoint[] = [];
      if (startHigh) {
        keyPoints.push({
          time: normalized[startHigh.index].time,
          index: startHigh.index,
          price: startHigh.price,
          label: "Start High",
        });
      }
      keyPoints.push(
        {
          time: normalized[firstTrough.index].time,
          index: firstTrough.index,
          price: firstTrough.price,
          label: "First Trough",
        },
        {
          time: normalized[middlePeak.index].time,
          index: middlePeak.index,
          price: middlePeak.price,
          label: "Middle Peak",
        },
        {
          time: normalized[secondTrough.index].time,
          index: secondTrough.index,
          price: secondTrough.price,
          label: "Second Trough",
        },
      );

      // Add breakout point as 5th keyPoint for W-shape polygon
      if (breakoutPoint) {
        keyPoints.push({
          time: normalized[breakoutPoint.index].time,
          index: breakoutPoint.index,
          price: breakoutPoint.price,
          label: "End High",
        });
      }

      // Use start high as pattern start if available, otherwise first trough
      const patternStartTime = startHigh
        ? normalized[startHigh.index].time
        : normalized[firstTrough.index].time;
      const patternEndTime = breakoutPoint
        ? normalized[breakoutPoint.index].time
        : normalized[secondTrough.index].time;

      patterns.push({
        time: normalized[secondTrough.index].time,
        type: "double_bottom",
        pattern: {
          startTime: patternStartTime,
          endTime: patternEndTime,
          keyPoints,
          neckline: {
            startPrice: necklinePrice,
            endPrice: necklinePrice,
            slope: 0,
            currentPrice: necklinePrice,
          },
          target,
          stopLoss: Math.min(firstTrough.price, secondTrough.price) * 0.99, // 1% below lowest trough
          height: patternHeight,
        },
        confidence,
        confirmed,
      });

      // Mark swing points as used to prevent overlapping patterns
      usedSwingIndexes.add(firstTrough.index);
      usedSwingIndexes.add(secondTrough.index);
      break;
    }
  }

  return patterns;
}

// Helper types
interface SwingPoint {
  index: number;
  price: number;
}

/**
 * Find the lowest swing low between two indices
 */
function findMiddleTrough(
  swingLows: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null {
  let lowest: SwingPoint | null = null;

  for (const low of swingLows) {
    if (low.index > startIndex && low.index < endIndex) {
      if (!lowest || low.price < lowest.price) {
        lowest = { index: low.index, price: low.price };
      }
    }
  }

  return lowest;
}

/**
 * Find the highest swing high between two indices
 */
function findMiddlePeak(
  swingHighs: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null {
  let highest: SwingPoint | null = null;

  for (const high of swingHighs) {
    if (high.index > startIndex && high.index < endIndex) {
      if (!highest || high.price > highest.price) {
        highest = { index: high.index, price: high.price };
      }
    }
  }

  return highest;
}

/**
 * Find the candle where price broke through neckline
 * Returns the index and price of the breakout candle
 */
function findNecklineBreakPoint(
  candles: NormalizedCandle[],
  fromIndex: number,
  necklinePrice: number,
  direction: "up" | "down",
): { index: number; price: number } | null {
  for (let i = fromIndex + 1; i < candles.length; i++) {
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
 * Find the closest swing high before the given index
 */
function findPrecedingSwingHigh(
  swingHighs: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  let closest: SwingPoint | null = null;

  for (const high of swingHighs) {
    if (high.index < beforeIndex) {
      if (!closest || high.index > closest.index) {
        closest = { index: high.index, price: high.price };
      }
    }
  }

  return closest;
}

/**
 * Find the closest swing low before the given index
 */
function findPrecedingSwingLow(
  swingLows: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  let closest: SwingPoint | null = null;

  for (const low of swingLows) {
    if (low.index < beforeIndex) {
      if (!closest || low.index > closest.index) {
        closest = { index: low.index, price: low.price };
      }
    }
  }

  return closest;
}

/**
 * Calculate confidence score for double patterns
 */
function calculateDoublePatternConfidence(
  price1: number,
  price2: number,
  depth: number,
  toleranceUsed: number,
  confirmed: boolean,
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

  return Math.min(100, Math.round(confidence));
}
