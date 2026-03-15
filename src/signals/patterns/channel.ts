/**
 * Channel Pattern Detection
 *
 * Detects ascending, descending, and horizontal channel patterns
 * using parallel trendline fitting.
 *
 * - Ascending Channel: Both lines slope upward, roughly parallel
 * - Descending Channel: Both lines slope downward, roughly parallel
 * - Horizontal Channel: Both lines approximately flat
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
  findTrendlineBreakout,
  fitTrendlinePair,
  getPatternBounds,
  isSlopeFlat,
  lookupAtr,
} from "./trendline-utils";
import type { ChannelOptions, PatternSignal } from "./types";

type ChannelSubtype = "channel_ascending" | "channel_descending" | "channel_horizontal";

/**
 * Check if two slopes are roughly parallel
 */
function areSlopesParallel(
  slope1: number,
  slope2: number,
  avgPrice: number,
  tolerance: number,
): boolean {
  if (avgPrice <= 0) return Math.abs(slope1 - slope2) < tolerance;
  return Math.abs((slope1 - slope2) / avgPrice) < tolerance;
}

/**
 * Classify channel subtype
 */
function classifyChannel(
  upper: TrendlineFit,
  lower: TrendlineFit,
  avgPrice: number,
  flatTolerance: number,
  parallelTolerance: number,
): ChannelSubtype | null {
  if (!areSlopesParallel(upper.slope, lower.slope, avgPrice, parallelTolerance)) {
    return null;
  }

  const upperFlat = isSlopeFlat(upper.slope, avgPrice, flatTolerance);
  const lowerFlat = isSlopeFlat(lower.slope, avgPrice, flatTolerance);

  if (upperFlat && lowerFlat) return "channel_horizontal";
  if (upper.slope > 0 && lower.slope > 0) return "channel_ascending";
  if (upper.slope < 0 && lower.slope < 0) return "channel_descending";

  return null;
}

/**
 * Calculate confidence for a channel pattern
 */
function calculateChannelConfidence(
  upper: TrendlineFit,
  lower: TrendlineFit,
  atrValue: number,
  patternHeight: number,
  confirmed: boolean,
  patternBars: number,
): number {
  let confidence = calculateBaseConfidence(upper, lower, atrValue, 35);

  if (atrValue > 0 && patternHeight / atrValue > 1.5) confidence += 10;

  // Longer channels are more reliable
  if (patternBars > 30) confidence += 5;
  if (patternBars > 50) confidence += 5;

  if (confirmed) confidence += 10;

  return clampConfidence(confidence);
}

/**
 * Detect Channel patterns (ascending, descending, horizontal)
 *
 * A channel forms when price oscillates between two roughly parallel
 * trendlines. Breakouts from channels signal potential trend continuation
 * or reversal.
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected channel patterns
 *
 * @example
 * ```ts
 * const patterns = detectChannel(candles);
 * patterns.forEach(p => {
 *   console.log(`${p.type}, height: ${p.pattern.height}`);
 * });
 * ```
 */
export function detectChannel(
  candles: Candle[] | NormalizedCandle[],
  options: ChannelOptions = {},
): PatternSignal[] {
  const {
    swingLookback = 3,
    minPoints = 3, // Industry standard: 3 touches per boundary, 4+ total
    minRSquared = 0.6,
    flatTolerance = 0.0003,
    parallelTolerance = 0.0003,
    maxBreakoutBars = 20,
    validateVolume = true,
    minVolumeIncrease = 1.2,
    volumeLookback = 10,
    minBars = 20,
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

        if (recentHighs.length < minPoints || recentLows.length < minPoints) continue;

        const pair = fitTrendlinePair(recentHighs, recentLows);
        if (!pair) continue;

        const { upper, lower } = pair;
        if (upper.rSquared < minRSquared || lower.rSquared < minRSquared) continue;

        const { startIndex, endIndex } = getPatternBounds(recentHighs, recentLows);
        if (endIndex - startIndex < minBars) continue;

        const avgPrice = avgClosePrice(normalized, startIndex, endIndex);
        const subtype = classifyChannel(upper, lower, avgPrice, flatTolerance, parallelTolerance);
        if (!subtype) continue;

        const patternKey = `${subtype}_${Math.round(startIndex / 10)}_${Math.round(endIndex / 10)}`;
        if (seenPatterns.has(patternKey)) continue;
        seenPatterns.add(patternKey);

        const midIndex = (startIndex + endIndex) / 2;
        const patternHeight = Math.abs(upper.valueAt(midIndex) - lower.valueAt(midIndex));
        if (patternHeight <= 0) continue;

        const currentAtr = lookupAtr(atrData, normalized, endIndex);
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

        let confidence = calculateChannelConfidence(
          upper,
          lower,
          currentAtr,
          patternHeight,
          confirmed,
          endIndex - startIndex,
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
      } // end sliding window
    }
  }

  return results;
}
