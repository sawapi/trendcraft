/**
 * Cup with Handle Pattern Detection
 *
 * A bullish continuation pattern popular in growth stock trading.
 * Consists of a U-shaped cup followed by a smaller pullback (handle).
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import type { Candle, NormalizedCandle } from "../../types";
import type { CupHandleOptions, PatternKeyPoint, PatternSignal } from "./types";

/**
 * Detect Cup with Handle patterns
 *
 * A Cup with Handle consists of:
 * 1. Left rim (prior high before the cup)
 * 2. Cup formation (U-shaped decline and recovery)
 * 3. Right rim (recovery back to near left rim level)
 * 4. Handle (small pullback from right rim)
 * 5. Breakout above handle high
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected Cup with Handle patterns
 *
 * @example
 * ```ts
 * const patterns = cupWithHandle(candles, {
 *   minCupDepth: 0.15,
 *   maxCupDepth: 0.35
 * });
 *
 * patterns.forEach(p => {
 *   if (p.confirmed) {
 *     console.log(`Breakout! Target: ${p.pattern.target}`);
 *   }
 * });
 * ```
 */
export function cupWithHandle(
  candles: Candle[] | NormalizedCandle[],
  options: CupHandleOptions = {},
): PatternSignal[] {
  const {
    minCupDepth = 0.12,
    maxCupDepth = 0.35,
    minCupLength = 30,
    maxHandleDepth = 0.12,
    minHandleLength = 5,
    swingLookback = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < minCupLength + minHandleLength) {
    return [];
  }

  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const swingHighs = getSwingHighs(normalized, swingOpts);
  const swingLows = getSwingLows(normalized, swingOpts);

  const patterns: PatternSignal[] = [];

  // Look for cup formations: high -> low -> high pattern
  for (let i = 0; i < swingHighs.length - 1; i++) {
    const leftRim = swingHighs[i];

    // Look for a right rim that forms a cup
    for (let j = i + 1; j < swingHighs.length; j++) {
      const rightRim = swingHighs[j];

      // Check cup length
      const cupLength = rightRim.index - leftRim.index;
      if (cupLength < minCupLength) continue;

      // Find the cup bottom (lowest point between rims)
      const cupBottom = findCupBottom(swingLows, leftRim.index, rightRim.index);
      if (!cupBottom) continue;

      // Check cup depth
      const avgRimPrice = (leftRim.price + rightRim.price) / 2;
      const cupDepth = (avgRimPrice - cupBottom.price) / avgRimPrice;
      if (cupDepth < minCupDepth || cupDepth > maxCupDepth) continue;

      // Right rim should be within 5% of left rim (recovery)
      const rimDiff = Math.abs(rightRim.price - leftRim.price) / leftRim.price;
      if (rimDiff > 0.05) continue;

      // Check cup shape (should be U-shaped, not V-shaped)
      if (!isUShapedCup(normalized, leftRim.index, cupBottom.index, rightRim.index)) {
        continue;
      }

      // Look for handle after right rim
      const handle = findHandle(
        normalized,
        swingLows,
        rightRim.index,
        rightRim.price,
        maxHandleDepth,
        minHandleLength,
      );

      if (!handle) continue;

      // Calculate pattern metrics
      const cupHeight = avgRimPrice - cupBottom.price;
      const pivotPoint = Math.max(leftRim.price, rightRim.price);
      const target = pivotPoint + cupHeight; // Measured move from pivot

      // Check if breakout confirmed
      const confirmed = checkBreakout(normalized, handle.endIndex, pivotPoint);

      // Calculate confidence
      const confidence = calculateCupConfidence(
        cupDepth,
        rimDiff,
        handle.depth,
        cupLength,
        confirmed,
      );

      const keyPoints: PatternKeyPoint[] = [
        {
          time: normalized[leftRim.index].time,
          index: leftRim.index,
          price: leftRim.price,
          label: "Left Rim",
        },
        {
          time: normalized[cupBottom.index].time,
          index: cupBottom.index,
          price: cupBottom.price,
          label: "Cup Bottom",
        },
        {
          time: normalized[rightRim.index].time,
          index: rightRim.index,
          price: rightRim.price,
          label: "Right Rim",
        },
        {
          time: normalized[handle.lowIndex].time,
          index: handle.lowIndex,
          price: handle.lowPrice,
          label: "Handle Low",
        },
        {
          time: normalized[handle.endIndex].time,
          index: handle.endIndex,
          price: normalized[handle.endIndex].close,
          label: "Handle End",
        },
      ];

      patterns.push({
        time: normalized[handle.endIndex].time,
        type: "cup_handle",
        pattern: {
          startTime: normalized[leftRim.index].time,
          endTime: normalized[handle.endIndex].time,
          keyPoints,
          target,
          stopLoss: handle.lowPrice * 0.97, // 3% below handle low
          height: cupHeight,
        },
        confidence,
        confirmed,
      });

      // Found a valid cup with handle starting from this left rim
      break;
    }
  }

  return patterns;
}

// Helper types and functions

interface CupBottom {
  index: number;
  price: number;
}

interface HandleInfo {
  lowIndex: number;
  lowPrice: number;
  endIndex: number;
  depth: number;
}

function findCupBottom(
  swingLows: { index: number; price: number }[],
  startIndex: number,
  endIndex: number,
): CupBottom | null {
  let lowest: CupBottom | null = null;

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
 * Check if cup is U-shaped (gradual) rather than V-shaped (sharp)
 * A U-shaped cup should have the bottom roughly in the middle third
 */
function isUShapedCup(
  candles: NormalizedCandle[],
  leftIndex: number,
  bottomIndex: number,
  rightIndex: number,
): boolean {
  const cupLength = rightIndex - leftIndex;
  const bottomPosition = (bottomIndex - leftIndex) / cupLength;

  // Bottom should be roughly in the middle 60% of the cup
  if (bottomPosition < 0.2 || bottomPosition > 0.8) {
    return false;
  }

  // Check for gradual decline and recovery (not too sharp)
  const leftHalf = bottomIndex - leftIndex;
  const rightHalf = rightIndex - bottomIndex;

  // Neither half should be less than 30% of the other
  const ratio = Math.min(leftHalf, rightHalf) / Math.max(leftHalf, rightHalf);
  if (ratio < 0.3) {
    return false;
  }

  return true;
}

function findHandle(
  candles: NormalizedCandle[],
  swingLows: { index: number; price: number }[],
  rimIndex: number,
  rimPrice: number,
  maxDepth: number,
  minLength: number,
): HandleInfo | null {
  // Look for handle formation after right rim
  // Handle should be a small pullback

  // Find the first swing low after the rim
  let handleLow: { index: number; price: number } | null = null;

  for (const low of swingLows) {
    if (low.index > rimIndex) {
      // Check if this pullback is within acceptable depth
      const depth = (rimPrice - low.price) / rimPrice;
      if (depth > 0 && depth <= maxDepth) {
        handleLow = low;
        break;
      }
    }
  }

  if (!handleLow) {
    // No swing low found, look for any pullback
    let lowestPrice = Number.POSITIVE_INFINITY;
    let lowestIndex = -1;

    for (let i = rimIndex + 1; i < Math.min(rimIndex + 30, candles.length); i++) {
      if (candles[i].low < lowestPrice) {
        lowestPrice = candles[i].low;
        lowestIndex = i;
      }
    }

    if (lowestIndex === -1) return null;

    const depth = (rimPrice - lowestPrice) / rimPrice;
    if (depth <= 0 || depth > maxDepth) return null;

    handleLow = { index: lowestIndex, price: lowestPrice };
  }

  // Handle should be at least minLength bars
  const handleLength = handleLow.index - rimIndex;
  if (handleLength < minLength) {
    return null;
  }

  // Find where handle ends (recovery from handle low)
  let endIndex = handleLow.index;
  for (let i = handleLow.index + 1; i < candles.length; i++) {
    endIndex = i;
    // Handle ends when price recovers to near rim level
    if (candles[i].close >= rimPrice * 0.98) {
      break;
    }
    // Or after max 20 bars
    if (i - handleLow.index > 20) {
      break;
    }
  }

  const depth = (rimPrice - handleLow.price) / rimPrice;

  return {
    lowIndex: handleLow.index,
    lowPrice: handleLow.price,
    endIndex,
    depth,
  };
}

function checkBreakout(
  candles: NormalizedCandle[],
  fromIndex: number,
  pivotPoint: number,
): boolean {
  for (let i = fromIndex; i < candles.length; i++) {
    if (candles[i].close > pivotPoint) {
      return true;
    }
  }
  return false;
}

function calculateCupConfidence(
  cupDepth: number,
  rimDiff: number,
  handleDepth: number,
  cupLength: number,
  confirmed: boolean,
): number {
  let confidence = 50;

  // Ideal cup depth (15-30%)
  if (cupDepth >= 0.15 && cupDepth <= 0.3) {
    confidence += 15;
  } else if (cupDepth >= 0.12 && cupDepth <= 0.35) {
    confidence += 10;
  }

  // Better rim alignment
  if (rimDiff < 0.02) confidence += 10;
  else if (rimDiff < 0.03) confidence += 5;

  // Shallow handle is better
  if (handleDepth < 0.08) confidence += 10;
  else if (handleDepth < 0.1) confidence += 5;

  // Longer cup formations are more reliable
  if (cupLength > 50) confidence += 5;

  // Confirmation
  if (confirmed) confidence += 15;

  return Math.min(100, Math.round(confidence));
}
