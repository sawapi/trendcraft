/**
 * Wedge Pattern Detection
 *
 * Detects rising and falling wedge patterns using trendline fitting.
 *
 * - Rising Wedge: Both lines slope upward but converge -- bearish reversal
 * - Falling Wedge: Both lines slope downward but converge -- bullish reversal
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import { atr as calcAtr } from "../../indicators/volatility/atr";
import type { Candle, NormalizedCandle } from "../../types";
import {
  type TrendlineFit,
  buildTouchKeyPoints,
  calculateBaseConfidence,
  calculateBreakoutLevels,
  checkBreakoutVolume,
  clampConfidence,
  fitTrendlinePair,
  getPatternBounds,
  lookupAtr,
} from "./trendline-utils";
import type { PatternSignal, WedgeOptions } from "./types";

type WedgeSubtype = "rising_wedge" | "falling_wedge";

/**
 * Classify wedge subtype: both lines must slope in the same direction and converge
 */
function classifyWedge(upper: TrendlineFit, lower: TrendlineFit): WedgeSubtype | null {
  const converging = upper.slope < lower.slope;
  if (!converging) return null;

  if (upper.slope > 0 && lower.slope > 0) return "rising_wedge";
  if (upper.slope < 0 && lower.slope < 0) return "falling_wedge";

  return null;
}

/**
 * Calculate confidence for a wedge pattern
 */
function calculateWedgeConfidence(
  upper: TrendlineFit,
  lower: TrendlineFit,
  atrValue: number,
  patternHeight: number,
  confirmed: boolean,
): number {
  let confidence = calculateBaseConfidence(upper, lower, atrValue, 40);

  if (atrValue > 0 && patternHeight / atrValue > 2) confidence += 10;
  if (confirmed) confidence += 10;

  return clampConfidence(confidence);
}

/**
 * Find breakout from a wedge pattern
 *
 * Rising wedge breaks downward; falling wedge breaks upward.
 */
function findWedgeBreakout(
  candles: NormalizedCandle[],
  upper: TrendlineFit,
  lower: TrendlineFit,
  subtype: WedgeSubtype,
  fromIndex: number,
  maxBars: number,
): { index: number; direction: "up" | "down" } | null {
  const endIndex = Math.min(fromIndex + maxBars, candles.length);

  for (let i = fromIndex; i < endIndex; i++) {
    if (subtype === "rising_wedge" && candles[i].close < lower.valueAt(i)) {
      return { index: i, direction: "down" };
    }
    if (subtype === "falling_wedge" && candles[i].close > upper.valueAt(i)) {
      return { index: i, direction: "up" };
    }
  }

  return null;
}

/**
 * Detect Wedge patterns (rising and falling)
 *
 * A wedge is formed when both upper and lower trendlines slope in the
 * same direction but converge. Rising wedges are bearish; falling wedges
 * are bullish.
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected wedge patterns
 *
 * @example
 * ```ts
 * const patterns = detectWedge(candles);
 * patterns.filter(p => p.type === 'falling_wedge').forEach(p => {
 *   console.log(`Bullish wedge, target: ${p.pattern.target}`);
 * });
 * ```
 */
export function detectWedge(
  candles: Candle[] | NormalizedCandle[],
  options: WedgeOptions = {},
): PatternSignal[] {
  const {
    swingLookback = 3,
    minPoints = 3, // Industry standard: 3 touches per trendline to validate
    minRSquared = 0.6,
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

        if (recentHighs.length < minPoints || recentLows.length < minPoints) continue;

        const pair = fitTrendlinePair(recentHighs, recentLows);
        if (!pair) continue;

        const { upper, lower } = pair;
        if (upper.rSquared < minRSquared || lower.rSquared < minRSquared) continue;

        const subtype = classifyWedge(upper, lower);
        if (!subtype) continue;

        const { startIndex, endIndex } = getPatternBounds(recentHighs, recentLows);
        if (endIndex - startIndex < minBars) continue;

        // Apex must be in the future (convergence point hasn't been reached yet)
        if (pair.convergenceBar !== null && pair.convergenceBar <= endIndex) continue;

        const patternKey = `${subtype}_${Math.round(startIndex / 10)}_${Math.round(endIndex / 10)}`;
        if (seenPatterns.has(patternKey)) continue;
        seenPatterns.add(patternKey);

        const patternHeight = Math.abs(upper.valueAt(startIndex) - lower.valueAt(startIndex));
        if (patternHeight <= 0) continue;

        const currentAtr = lookupAtr(atrData, normalized, endIndex);
        const breakout = findWedgeBreakout(
          normalized,
          upper,
          lower,
          subtype,
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

        // Volume typically decreases as the wedge forms
        const wedgeLen = endIndex - startIndex;
        const halfLen = Math.floor(wedgeLen / 2);
        let firstHalfVol = 0;
        let secondHalfVol = 0;
        for (let k = startIndex; k < startIndex + halfLen; k++)
          firstHalfVol += normalized[k].volume;
        for (let k = startIndex + halfLen; k <= endIndex; k++)
          secondHalfVol += normalized[k].volume;
        firstHalfVol /= halfLen || 1;
        secondHalfVol /= wedgeLen - halfLen + 1 || 1;
        const volumeDecreasing = secondHalfVol < firstHalfVol * 0.9;

        let confidence = calculateWedgeConfidence(
          upper,
          lower,
          currentAtr,
          patternHeight,
          confirmed,
        );
        if (volumeDecreasing) confidence = Math.min(100, confidence + 5);
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
