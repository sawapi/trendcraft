/**
 * Double Top and Double Bottom Pattern Detection
 *
 * Double Top: Bearish reversal pattern with two peaks at similar levels
 * Double Bottom: Bullish reversal pattern with two troughs at similar levels
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import type { Candle, NormalizedCandle } from "../../types";
import {
  calculateDoublePatternConfidence,
  calculateProminence,
  countNecklineCrosses,
  findMiddlePeak,
  findMiddleTrough,
  findNecklineBreakPoint,
  findPrecedingSwingHigh,
  findPrecedingSwingLow,
  hasHigherSwingHigh,
  hasLowerSwingLow,
  hasNecklineViolation,
  interpolateTime,
  validateBreakoutVolume,
} from "./double-pattern-utils";
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
