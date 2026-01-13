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
    maxDistance = 40, // Changed from 60 to 40 (about 2 months for daily data)
    minMiddleDepth = 0.1,
    swingLookback = 5,
    validateVolume = true,
    minVolumeIncrease = 1.2,
    volumeLookback = 10,
    validateNeckline = true,
    maxNecklineCrosses = 3,
    validateProminence = true,
    minProminence = 0.02,
    maxBreakoutDistance = 20,
    validateNecklineViolation = true,
    necklineViolationTolerance = 0, // 0に変更：ネックラインを超える足は許容しない
    strictMode = false,
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

      // Check that there's no higher swing high between the two peaks
      // A valid double top should have both peaks as the highest points
      const highestPeakPrice = Math.max(firstPeak.price, secondPeak.price);
      if (hasHigherSwingHigh(swingHighs, firstPeak.index, secondPeak.index, highestPeakPrice)) {
        continue;
      }

      // Check prominence - peaks must stand out from surroundings
      const prominenceLookback = swingLookback * 2;
      const prom1 = calculateProminence(normalized, firstPeak.index, "peak", prominenceLookback);
      const prom2 = calculateProminence(normalized, secondPeak.index, "peak", prominenceLookback);

      if (validateProminence) {
        if (prom1 < minProminence || prom2 < minProminence) continue;
      }

      // Find the middle trough between the two peaks
      const middleTrough = findMiddleTrough(swingLows, firstPeak.index, secondPeak.index);
      if (!middleTrough) continue;

      // Check middle depth
      const avgPeakPrice = (firstPeak.price + secondPeak.price) / 2;
      const depth = (avgPeakPrice - middleTrough.price) / avgPeakPrice;
      if (depth < minMiddleDepth) continue;

      // Check for neckline violation during pattern formation
      // For double top: price should not go below the middle trough (neckline) before the pattern completes
      if (validateNecklineViolation) {
        const hasViolation = hasNecklineViolation(
          normalized,
          firstPeak.index,
          secondPeak.index,
          middleTrough.price,
          "below",
          necklineViolationTolerance,
          middleTrough.index, // Skip the middle trough itself
        );
        if (hasViolation) {
          continue;
        }
      }

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
        maxBreakoutDistance,
      );
      const confirmed = breakdownPoint !== null;

      // Volume validation
      const volumeValid = !validateVolume || !breakdownPoint
        ? true
        : validateBreakoutVolume(normalized, breakdownPoint.index, volumeLookback, minVolumeIncrease);

      // Neckline quality check - count crosses between middle trough and breakdown/end
      const necklineCrosses = !validateNeckline
        ? 0
        : countNecklineCrosses(
            normalized,
            middleTrough.index,
            breakdownPoint?.index ?? secondPeak.index,
            necklinePrice,
          );

      // Skip pattern if neckline is too messy
      if (validateNeckline && necklineCrosses > maxNecklineCrosses) {
        continue;
      }

      // Calculate confidence
      const confidence = calculateDoublePatternConfidence(
        firstPeak.price,
        secondPeak.price,
        depth,
        tolerance,
        confirmed,
        volumeValid,
        necklineCrosses,
        prom1,
        prom2,
      );

      // Find the preceding swing low before the first peak (start of the pattern)
      const startLow = findPrecedingSwingLow(swingLows, firstPeak.index);

      // Strict mode: pattern must start below neckline for double top
      if (strictMode && startLow) {
        if (startLow.price >= necklinePrice) {
          continue; // Pattern start is at or above neckline, skip in strict mode
        }
      }

      const keyPoints: PatternKeyPoint[] = [];

      // In strict mode with both start and end points, use 7-point structure
      // with neckline intersection points for cleaner polygon
      if (strictMode && startLow && breakdownPoint) {
        // Calculate intersection point: startLow → firstPeak line crosses neckline
        const intersection1Time = interpolateTime(
          normalized[startLow.index].time,
          startLow.price,
          normalized[firstPeak.index].time,
          firstPeak.price,
          necklinePrice,
        );

        // Calculate fractional index for intersection 1 (linear interpolation based on price)
        const priceRatio1 =
          firstPeak.price !== startLow.price
            ? (necklinePrice - startLow.price) / (firstPeak.price - startLow.price)
            : 0;
        const intersection1Index = startLow.index + priceRatio1 * (firstPeak.index - startLow.index);

        // Calculate intersection point: secondPeak → breakdownPoint line crosses neckline
        const intersection2Time = interpolateTime(
          normalized[secondPeak.index].time,
          secondPeak.price,
          normalized[breakdownPoint.index].time,
          breakdownPoint.price,
          necklinePrice,
        );

        // Calculate fractional index for intersection 2 (linear interpolation based on price)
        const priceRatio2 =
          breakdownPoint.price !== secondPeak.price
            ? (necklinePrice - secondPeak.price) / (breakdownPoint.price - secondPeak.price)
            : 0;
        const intersection2Index =
          secondPeak.index + priceRatio2 * (breakdownPoint.index - secondPeak.index);

        // 7-point structure for strict mode
        keyPoints.push(
          {
            time: normalized[startLow.index].time,
            index: startLow.index,
            price: startLow.price,
            label: "Start",
          },
          {
            time: intersection1Time,
            index: intersection1Index,
            price: necklinePrice,
            label: "Neckline Start",
          },
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
          {
            time: intersection2Time,
            index: intersection2Index,
            price: necklinePrice,
            label: "Neckline End",
          },
          {
            time: normalized[breakdownPoint.index].time,
            index: breakdownPoint.index,
            price: breakdownPoint.price,
            label: "End",
          },
        );
      } else {
        // Standard 5-point structure (or less if missing start/end)
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

        if (breakdownPoint) {
          keyPoints.push({
            time: normalized[breakdownPoint.index].time,
            index: breakdownPoint.index,
            price: breakdownPoint.price,
            label: "End Low",
          });
        }
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
    maxDistance = 40, // Changed from 60 to 40 (about 2 months for daily data)
    minMiddleDepth = 0.1,
    swingLookback = 5,
    validateVolume = true,
    minVolumeIncrease = 1.2,
    volumeLookback = 10,
    validateNeckline = true,
    maxNecklineCrosses = 3,
    validateProminence = true,
    minProminence = 0.02,
    maxBreakoutDistance = 20,
    validateNecklineViolation = true,
    necklineViolationTolerance = 0, // 0に変更：ネックラインを超える足は許容しない
    strictMode = false,
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

      // Check that there's no lower swing low between the two troughs
      // A valid double bottom should have both troughs as the lowest points
      const lowestTroughPrice = Math.min(firstTrough.price, secondTrough.price);
      if (hasLowerSwingLow(swingLows, firstTrough.index, secondTrough.index, lowestTroughPrice)) {
        continue;
      }

      // Check prominence - troughs must stand out from surroundings
      const prominenceLookback = swingLookback * 2;
      const prom1 = calculateProminence(normalized, firstTrough.index, "trough", prominenceLookback);
      const prom2 = calculateProminence(normalized, secondTrough.index, "trough", prominenceLookback);

      if (validateProminence) {
        if (prom1 < minProminence || prom2 < minProminence) continue;
      }

      // Find the middle peak between the two troughs
      const middlePeak = findMiddlePeak(swingHighs, firstTrough.index, secondTrough.index);
      if (!middlePeak) continue;

      // Check middle depth
      const avgTroughPrice = (firstTrough.price + secondTrough.price) / 2;
      const depth = (middlePeak.price - avgTroughPrice) / avgTroughPrice;
      if (depth < minMiddleDepth) continue;

      // Check for neckline violation during pattern formation
      // For double bottom: price should not go above the middle peak (neckline) before the pattern completes
      if (validateNecklineViolation) {
        const hasViolation = hasNecklineViolation(
          normalized,
          firstTrough.index,
          secondTrough.index,
          middlePeak.price,
          "above",
          necklineViolationTolerance,
          middlePeak.index, // Skip the middle peak itself
        );
        if (hasViolation) {
          continue;
        }
      }

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
        maxBreakoutDistance,
      );
      const confirmed = breakoutPoint !== null;

      // Volume validation
      const volumeValid = !validateVolume || !breakoutPoint
        ? true
        : validateBreakoutVolume(normalized, breakoutPoint.index, volumeLookback, minVolumeIncrease);

      // Neckline quality check - count crosses between middle peak and breakout/end
      const necklineCrosses = !validateNeckline
        ? 0
        : countNecklineCrosses(
            normalized,
            middlePeak.index,
            breakoutPoint?.index ?? secondTrough.index,
            necklinePrice,
          );

      // Skip pattern if neckline is too messy
      if (validateNeckline && necklineCrosses > maxNecklineCrosses) {
        continue;
      }

      // Calculate confidence
      const confidence = calculateDoublePatternConfidence(
        firstTrough.price,
        secondTrough.price,
        depth,
        tolerance,
        confirmed,
        volumeValid,
        necklineCrosses,
        prom1,
        prom2,
      );

      // Find the preceding swing high before the first trough (start of the pattern)
      const startHigh = findPrecedingSwingHigh(swingHighs, firstTrough.index);

      // Strict mode: pattern must start above neckline for double bottom
      if (strictMode && startHigh) {
        if (startHigh.price <= necklinePrice) {
          continue; // Pattern start is at or below neckline, skip in strict mode
        }
      }

      const keyPoints: PatternKeyPoint[] = [];

      // In strict mode with both start and end points, use 7-point structure
      // with neckline intersection points for cleaner polygon
      if (strictMode && startHigh && breakoutPoint) {
        // Calculate intersection point: startHigh → firstTrough line crosses neckline
        const intersection1Time = interpolateTime(
          normalized[startHigh.index].time,
          startHigh.price,
          normalized[firstTrough.index].time,
          firstTrough.price,
          necklinePrice,
        );

        // Calculate fractional index for intersection 1 (linear interpolation based on price)
        const priceRatio1 =
          firstTrough.price !== startHigh.price
            ? (necklinePrice - startHigh.price) / (firstTrough.price - startHigh.price)
            : 0;
        const intersection1Index =
          startHigh.index + priceRatio1 * (firstTrough.index - startHigh.index);

        // Calculate intersection point: secondTrough → breakoutPoint line crosses neckline
        const intersection2Time = interpolateTime(
          normalized[secondTrough.index].time,
          secondTrough.price,
          normalized[breakoutPoint.index].time,
          breakoutPoint.price,
          necklinePrice,
        );

        // Calculate fractional index for intersection 2 (linear interpolation based on price)
        const priceRatio2 =
          breakoutPoint.price !== secondTrough.price
            ? (necklinePrice - secondTrough.price) / (breakoutPoint.price - secondTrough.price)
            : 0;
        const intersection2Index =
          secondTrough.index + priceRatio2 * (breakoutPoint.index - secondTrough.index);

        // 7-point structure for strict mode
        keyPoints.push(
          {
            time: normalized[startHigh.index].time,
            index: startHigh.index,
            price: startHigh.price,
            label: "Start",
          },
          {
            time: intersection1Time,
            index: intersection1Index,
            price: necklinePrice,
            label: "Neckline Start",
          },
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
          {
            time: intersection2Time,
            index: intersection2Index,
            price: necklinePrice,
            label: "Neckline End",
          },
          {
            time: normalized[breakoutPoint.index].time,
            index: breakoutPoint.index,
            price: breakoutPoint.price,
            label: "End",
          },
        );
      } else {
        // Standard 5-point structure (or less if missing start/end)
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

        if (breakoutPoint) {
          keyPoints.push({
            time: normalized[breakoutPoint.index].time,
            index: breakoutPoint.index,
            price: breakoutPoint.price,
            label: "End High",
          });
        }
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
 * Interpolate time between two points to find where price crosses a target level
 * Used in strict mode to find neckline intersection points
 */
function interpolateTime(
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
function findSwingPointBetween(
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
function findMiddleTrough(
  swingLows: { time: number; index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): SwingPoint | null {
  return findSwingPointBetween(swingLows, startIndex, endIndex, (a, b) => a < b);
}

/**
 * Find the highest swing high between two indices
 */
function findMiddlePeak(
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
function findNecklineBreakPoint(
  candles: NormalizedCandle[],
  fromIndex: number,
  necklinePrice: number,
  direction: "up" | "down",
  maxDistance?: number,
): { index: number; price: number } | null {
  const endIndex = maxDistance !== undefined
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
function findPrecedingSwing(
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
function findPrecedingSwingHigh(
  swingHighs: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  return findPrecedingSwing(swingHighs, beforeIndex);
}

/**
 * Find the closest swing low before the given index
 */
function findPrecedingSwingLow(
  swingLows: { time: number; index: number; price: number }[],
  beforeIndex: number,
): SwingPoint | null {
  return findPrecedingSwing(swingLows, beforeIndex);
}

/**
 * Check if there's a swing point between two indices that crosses a threshold
 */
function hasSwingBeyondThreshold(
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
function hasLowerSwingLow(
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
function hasHigherSwingHigh(
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
function validateBreakoutVolume(
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
function countNecklineCrosses(
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
function hasNecklineViolation(
  candles: NormalizedCandle[],
  startIndex: number,
  endIndex: number,
  necklinePrice: number,
  direction: "above" | "below",
  tolerancePercent: number = 0,
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
function calculateProminence(
  candles: NormalizedCandle[],
  index: number,
  type: "peak" | "trough",
  lookback: number = 10,
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
  } else {
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
