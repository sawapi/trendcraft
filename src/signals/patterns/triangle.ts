/**
 * Triangle Pattern Detection
 *
 * Detects symmetrical, ascending, and descending triangle patterns
 * using trendline fitting on swing points.
 *
 * - Symmetrical: Converging upper (descending) + lower (ascending) lines
 * - Ascending: Flat upper + ascending lower line
 * - Descending: Descending upper + flat lower line
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import { atr as calcAtr } from "../../indicators/volatility/atr";
import type { Candle, NormalizedCandle } from "../../types";
import {
  type TrendlineFit,
  avgClosePrice,
  buildTouchKeyPoints,
  calculateBaseConfidence,
  calculateBreakoutLevels,
  checkBreakoutVolume,
  clampConfidence,
  countTouchPoints,
  findTrendlineBreakout,
  fitTrendlinePair,
  getPatternBounds,
  isSlopeFlat,
  lookupAtr,
} from "./trendline-utils";
import type { PatternSignal, TriangleOptions } from "./types";

type TriangleSubtype = "triangle_symmetrical" | "triangle_ascending" | "triangle_descending";

/**
 * Classify triangle subtype from upper and lower trendlines
 */
function classifyTriangle(
  upper: TrendlineFit,
  lower: TrendlineFit,
  avgPrice: number,
  flatTolerance: number,
): TriangleSubtype | null {
  const upperFlat = isSlopeFlat(upper.slope, avgPrice, flatTolerance);
  const lowerFlat = isSlopeFlat(lower.slope, avgPrice, flatTolerance);
  const upperDescending = upper.slope < 0;
  const lowerAscending = lower.slope > 0;

  if (upperFlat && lowerAscending) return "triangle_ascending";
  if (upperDescending && lowerFlat) return "triangle_descending";
  if (upperDescending && lowerAscending) return "triangle_symmetrical";

  return null;
}

/**
 * Check if volume is decreasing within the pattern (typical for triangles)
 */
function isVolumeDecreasing(
  candles: NormalizedCandle[],
  startIndex: number,
  endIndex: number,
): boolean {
  const length = endIndex - startIndex;
  if (length < 6) return false;

  const halfLen = Math.floor(length / 2);
  let firstHalfVol = 0;
  let secondHalfVol = 0;

  for (let i = startIndex; i < startIndex + halfLen; i++) {
    firstHalfVol += candles[i].volume;
  }
  for (let i = startIndex + halfLen; i < endIndex; i++) {
    secondHalfVol += candles[i].volume;
  }

  firstHalfVol /= halfLen;
  secondHalfVol /= endIndex - startIndex - halfLen;

  return secondHalfVol < firstHalfVol * 0.9;
}

/**
 * Calculate confidence score for a triangle pattern
 */
function calculateTriangleConfidence(
  upper: TrendlineFit,
  lower: TrendlineFit,
  atrValue: number,
  patternHeight: number,
  volumeDecreasing: boolean,
  confirmed: boolean,
): number {
  let confidence = calculateBaseConfidence(upper, lower, atrValue, 40);

  // Pattern size relative to ATR
  if (atrValue > 0) {
    const atrRatio = patternHeight / atrValue;
    if (atrRatio > 2) confidence += 10;
    if (atrRatio > 4) confidence += 5;
  }

  if (volumeDecreasing) confidence += 5;
  if (confirmed) confidence += 10;

  return clampConfidence(confidence);
}

/**
 * Detect Triangle patterns (symmetrical, ascending, descending)
 *
 * Uses multi-scale swing point detection and OLS trendline fitting
 * to identify converging price patterns.
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected triangle patterns
 *
 * @example
 * ```ts
 * const patterns = detectTriangle(candles);
 * patterns.forEach(p => {
 *   console.log(`${p.type} at bar ${p.time}, confidence: ${p.confidence}`);
 * });
 * ```
 */
export function detectTriangle(
  candles: Candle[] | NormalizedCandle[],
  options: TriangleOptions = {},
): PatternSignal[] {
  const {
    swingLookback = 3,
    minPoints = 2,
    minRSquared = 0.6,
    flatTolerance = 0.0003,
    maxBreakoutBars = 20,
    validateVolume = true,
    minVolumeIncrease = 1.2,
    volumeLookback = 10,
    minBars = 15,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  if (normalized.length < minBars) return [];

  const results: PatternSignal[] = [];
  const atrData = calcAtr(normalized, { period: 14 });
  const scales = [swingLookback, swingLookback + 2, swingLookback + 5];
  const seenPatterns = new Set<string>();

  for (const scale of scales) {
    const swingOpts = { leftBars: scale, rightBars: scale };
    const highs = getSwingHighs(normalized, swingOpts);
    const lows = getSwingLows(normalized, swingOpts);

    if (highs.length < minPoints || lows.length < minPoints) continue;

    const windowSizes = [3, 4, 5, 6];

    for (const winSize of windowSizes) {
      // Slide window across all swing points, not just the most recent
      const maxWindows = Math.max(highs.length - winSize + 1, 1);
      for (let wi = Math.max(0, maxWindows - 10); wi < maxWindows; wi++) {
        const recentHighs = highs.slice(wi, wi + winSize).map((h) => ({
          index: h.index,
          price: h.price,
        }));
        const recentLows = lows.slice(wi, Math.min(wi + winSize, lows.length)).map((l) => ({
          index: l.index,
          price: l.price,
        }));

        const pair = fitTrendlinePair(recentHighs, recentLows);
        if (!pair) continue;

        const { upper, lower } = pair;
        if (upper.rSquared < minRSquared || lower.rSquared < minRSquared) continue;

        // Must be converging (upper slope < lower slope)
        if (upper.slope >= lower.slope) continue;

        const { startIndex, endIndex } = getPatternBounds(recentHighs, recentLows);
        if (endIndex - startIndex < minBars) continue;

        const avgPrice = avgClosePrice(normalized, startIndex, endIndex);
        const subtype = classifyTriangle(upper, lower, avgPrice, flatTolerance);
        if (!subtype) continue;

        // Deduplicate by approximate location
        const patternKey = `${subtype}_${Math.round(startIndex / 10)}_${Math.round(endIndex / 10)}`;
        if (seenPatterns.has(patternKey)) continue;
        seenPatterns.add(patternKey);

        const patternHeight = upper.valueAt(startIndex) - lower.valueAt(startIndex);
        if (patternHeight <= 0) continue;

        const currentAtr = lookupAtr(atrData, normalized, endIndex);
        const volumeDecreasing = isVolumeDecreasing(normalized, startIndex, endIndex);
        const breakout = findTrendlineBreakout(
          normalized,
          upper,
          lower,
          endIndex + 1,
          maxBreakoutBars,
        );
        const confirmed = breakout != null;

        const volumeValid = confirmed
          ? checkBreakoutVolume(
              normalized,
              breakout!.index,
              validateVolume,
              volumeLookback,
              minVolumeIncrease,
            )
          : true;

        const detectionIndex = confirmed ? breakout!.index : endIndex;

        let confidence = calculateTriangleConfidence(
          upper,
          lower,
          currentAtr,
          patternHeight,
          volumeDecreasing,
          confirmed,
        );
        if (!volumeValid) confidence = Math.max(0, confidence - 10);

        const levels = breakout
          ? calculateBreakoutLevels(normalized, breakout, upper, lower, patternHeight)
          : undefined;

        results.push({
          time: normalized[detectionIndex].time,
          type: subtype,
          pattern: {
            startTime: normalized[startIndex].time,
            endTime: normalized[endIndex].time,
            keyPoints: buildTouchKeyPoints(normalized, recentHighs, recentLows),
            neckline: {
              startPrice: upper.valueAt(startIndex),
              endPrice: upper.valueAt(endIndex),
              slope: upper.slope,
              currentPrice: upper.valueAt(endIndex),
            },
            target: levels?.target,
            stopLoss: levels?.stopLoss,
            height: patternHeight,
          },
          confidence,
          confirmed,
        });
      }
    } // end sliding window loop
  }

  return results;
}
