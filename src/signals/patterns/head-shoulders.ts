/**
 * Head and Shoulders Pattern Detection
 *
 * Head and Shoulders: Bearish reversal pattern with left shoulder, head (highest), right shoulder
 * Inverse Head and Shoulders: Bullish reversal pattern (mirror of H&S)
 */

import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle } from "../../types";
import type { PatternSignal, HeadShouldersOptions, PatternKeyPoint, PatternNeckline } from "./types";

/**
 * Detect Head and Shoulders patterns
 *
 * A Head and Shoulders is a bearish reversal pattern consisting of:
 * 1. Left shoulder (first swing high)
 * 2. Head (highest swing high, higher than shoulders)
 * 3. Right shoulder (third swing high, similar level to left shoulder)
 * 4. Neckline connecting the two troughs
 * 5. Confirmed when price breaks below neckline
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected H&S patterns
 *
 * @example
 * ```ts
 * const patterns = headAndShoulders(candles);
 * patterns.forEach(p => {
 *   if (p.confirmed) {
 *     console.log(`H&S confirmed, target: ${p.pattern.target}`);
 *   }
 * });
 * ```
 */
export function headAndShoulders(
  candles: Candle[] | NormalizedCandle[],
  options: HeadShouldersOptions = {},
): PatternSignal[] {
  const {
    shoulderTolerance = 0.05,
    maxNecklineSlope = 0.1,
    minHeadHeight = 0.03,
    swingLookback = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 30) {
    return [];
  }

  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const swingHighs = getSwingHighs(normalized, swingOpts);
  const swingLows = getSwingLows(normalized, swingOpts);

  const patterns: PatternSignal[] = [];

  // Need at least 3 swing highs for H&S
  if (swingHighs.length < 3) {
    return [];
  }

  // Look for H&S pattern: left shoulder, head, right shoulder
  for (let i = 0; i < swingHighs.length - 2; i++) {
    const leftShoulder = swingHighs[i];
    const head = swingHighs[i + 1];
    const rightShoulder = swingHighs[i + 2];

    // Head must be higher than both shoulders
    if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) {
      continue;
    }

    // Check minimum head height above shoulders
    const avgShoulderPrice = (leftShoulder.price + rightShoulder.price) / 2;
    const headHeight = (head.price - avgShoulderPrice) / avgShoulderPrice;
    if (headHeight < minHeadHeight) {
      continue;
    }

    // Shoulders should be at similar levels
    const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
    if (shoulderDiff > shoulderTolerance) {
      continue;
    }

    // Find neckline (connecting the two troughs between shoulders and head)
    const leftTrough = findTroughBetween(swingLows, leftShoulder.index, head.index);
    const rightTrough = findTroughBetween(swingLows, head.index, rightShoulder.index);

    if (!leftTrough || !rightTrough) {
      continue;
    }

    // Calculate neckline
    const neckline = calculateNeckline(
      normalized,
      leftTrough.index,
      leftTrough.price,
      rightTrough.index,
      rightTrough.price,
      rightShoulder.index,
    );

    // Check neckline slope
    const patternLength = rightShoulder.index - leftShoulder.index;
    const totalPriceChange = Math.abs(neckline.endPrice - neckline.startPrice) / neckline.startPrice;
    if (totalPriceChange > maxNecklineSlope) {
      continue;
    }

    // Calculate pattern metrics
    const patternHeight = head.price - neckline.currentPrice;
    const target = neckline.currentPrice - patternHeight;

    // Check if confirmed (price broke below neckline)
    const confirmed = checkNecklineBreak(normalized, rightShoulder.index, neckline, "down");

    // Calculate confidence
    const confidence = calculateHSConfidence(
      leftShoulder.price,
      rightShoulder.price,
      headHeight,
      totalPriceChange,
      confirmed,
    );

    const keyPoints: PatternKeyPoint[] = [
      { time: normalized[leftShoulder.index].time, index: leftShoulder.index, price: leftShoulder.price, label: "Left Shoulder" },
      { time: normalized[leftTrough.index].time, index: leftTrough.index, price: leftTrough.price, label: "Left Trough" },
      { time: normalized[head.index].time, index: head.index, price: head.price, label: "Head" },
      { time: normalized[rightTrough.index].time, index: rightTrough.index, price: rightTrough.price, label: "Right Trough" },
      { time: normalized[rightShoulder.index].time, index: rightShoulder.index, price: rightShoulder.price, label: "Right Shoulder" },
    ];

    patterns.push({
      time: normalized[rightShoulder.index].time,
      type: "head_shoulders",
      pattern: {
        startTime: normalized[leftShoulder.index].time,
        endTime: normalized[rightShoulder.index].time,
        keyPoints,
        neckline,
        target,
        stopLoss: head.price * 1.01,
        height: patternHeight,
      },
      confidence,
      confirmed,
    });
  }

  return patterns;
}

/**
 * Detect Inverse Head and Shoulders patterns
 *
 * An Inverse H&S is a bullish reversal pattern (mirror of H&S):
 * 1. Left shoulder (first swing low)
 * 2. Head (lowest swing low, lower than shoulders)
 * 3. Right shoulder (third swing low, similar level to left shoulder)
 * 4. Neckline connecting the two peaks
 * 5. Confirmed when price breaks above neckline
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected Inverse H&S patterns
 */
export function inverseHeadAndShoulders(
  candles: Candle[] | NormalizedCandle[],
  options: HeadShouldersOptions = {},
): PatternSignal[] {
  const {
    shoulderTolerance = 0.05,
    maxNecklineSlope = 0.1,
    minHeadHeight = 0.03,
    swingLookback = 5,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 30) {
    return [];
  }

  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const swingHighs = getSwingHighs(normalized, swingOpts);
  const swingLows = getSwingLows(normalized, swingOpts);

  const patterns: PatternSignal[] = [];

  if (swingLows.length < 3) {
    return [];
  }

  // Look for Inverse H&S: left shoulder (low), head (lower), right shoulder (low)
  for (let i = 0; i < swingLows.length - 2; i++) {
    const leftShoulder = swingLows[i];
    const head = swingLows[i + 1];
    const rightShoulder = swingLows[i + 2];

    // Head must be lower than both shoulders
    if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) {
      continue;
    }

    // Check minimum head depth below shoulders
    const avgShoulderPrice = (leftShoulder.price + rightShoulder.price) / 2;
    const headDepth = (avgShoulderPrice - head.price) / avgShoulderPrice;
    if (headDepth < minHeadHeight) {
      continue;
    }

    // Shoulders should be at similar levels
    const shoulderDiff = Math.abs(leftShoulder.price - rightShoulder.price) / leftShoulder.price;
    if (shoulderDiff > shoulderTolerance) {
      continue;
    }

    // Find neckline (connecting the two peaks between shoulders and head)
    const leftPeak = findPeakBetween(swingHighs, leftShoulder.index, head.index);
    const rightPeak = findPeakBetween(swingHighs, head.index, rightShoulder.index);

    if (!leftPeak || !rightPeak) {
      continue;
    }

    // Calculate neckline
    const neckline = calculateNeckline(
      normalized,
      leftPeak.index,
      leftPeak.price,
      rightPeak.index,
      rightPeak.price,
      rightShoulder.index,
    );

    // Check neckline slope
    const totalPriceChange = Math.abs(neckline.endPrice - neckline.startPrice) / neckline.startPrice;
    if (totalPriceChange > maxNecklineSlope) {
      continue;
    }

    // Calculate pattern metrics
    const patternHeight = neckline.currentPrice - head.price;
    const target = neckline.currentPrice + patternHeight;

    // Check if confirmed (price broke above neckline)
    const confirmed = checkNecklineBreak(normalized, rightShoulder.index, neckline, "up");

    // Calculate confidence
    const confidence = calculateHSConfidence(
      leftShoulder.price,
      rightShoulder.price,
      headDepth,
      totalPriceChange,
      confirmed,
    );

    const keyPoints: PatternKeyPoint[] = [
      { time: normalized[leftShoulder.index].time, index: leftShoulder.index, price: leftShoulder.price, label: "Left Shoulder" },
      { time: normalized[leftPeak.index].time, index: leftPeak.index, price: leftPeak.price, label: "Left Peak" },
      { time: normalized[head.index].time, index: head.index, price: head.price, label: "Head" },
      { time: normalized[rightPeak.index].time, index: rightPeak.index, price: rightPeak.price, label: "Right Peak" },
      { time: normalized[rightShoulder.index].time, index: rightShoulder.index, price: rightShoulder.price, label: "Right Shoulder" },
    ];

    patterns.push({
      time: normalized[rightShoulder.index].time,
      type: "inverse_head_shoulders",
      pattern: {
        startTime: normalized[leftShoulder.index].time,
        endTime: normalized[rightShoulder.index].time,
        keyPoints,
        neckline,
        target,
        stopLoss: head.price * 0.99,
        height: patternHeight,
      },
      confidence,
      confirmed,
    });
  }

  return patterns;
}

// Helper functions

interface SwingPoint {
  index: number;
  price: number;
}

function findTroughBetween(
  swingLows: { index: number; price: number }[],
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

function findPeakBetween(
  swingHighs: { index: number; price: number }[],
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

function calculateNeckline(
  _candles: NormalizedCandle[],
  index1: number,
  price1: number,
  index2: number,
  price2: number,
  currentIndex: number,
): PatternNeckline {
  const slope = (price2 - price1) / (index2 - index1);
  const currentPrice = price1 + slope * (currentIndex - index1);

  return {
    startPrice: price1,
    endPrice: price2,
    slope,
    currentPrice,
  };
}

function checkNecklineBreak(
  candles: NormalizedCandle[],
  fromIndex: number,
  neckline: PatternNeckline,
  direction: "up" | "down",
): boolean {
  for (let i = fromIndex + 1; i < candles.length; i++) {
    // Calculate neckline price at this index (accounting for slope)
    const necklinePrice = neckline.startPrice + neckline.slope * (i - fromIndex);

    if (direction === "down" && candles[i].close < necklinePrice) {
      return true;
    }
    if (direction === "up" && candles[i].close > necklinePrice) {
      return true;
    }
  }
  return false;
}

function calculateHSConfidence(
  leftShoulderPrice: number,
  rightShoulderPrice: number,
  headHeightRatio: number,
  necklineSlope: number,
  confirmed: boolean,
): number {
  let confidence = 50;

  // Better shoulder match
  const shoulderDiff = Math.abs(leftShoulderPrice - rightShoulderPrice) / leftShoulderPrice;
  if (shoulderDiff < 0.02) confidence += 15;
  else if (shoulderDiff < 0.03) confidence += 10;

  // More prominent head
  if (headHeightRatio > 0.05) confidence += 10;
  if (headHeightRatio > 0.10) confidence += 5;

  // Flatter neckline is more reliable
  if (necklineSlope < 0.03) confidence += 10;

  // Confirmation
  if (confirmed) confidence += 15;

  return Math.min(100, Math.round(confidence));
}
