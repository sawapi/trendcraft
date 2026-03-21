/**
 * Flag and Pennant Pattern Detection
 *
 * Detects flag (small counter-trend channel) and pennant (small symmetrical
 * triangle) patterns that follow a sharp impulse move (flagpole).
 *
 * - Bull Flag: Sharp up move + small descending channel
 * - Bear Flag: Sharp down move + small ascending channel
 * - Bull Pennant: Sharp up move + small symmetrical triangle
 * - Bear Pennant: Sharp down move + small symmetrical triangle
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { getSwingHighs, getSwingLows } from "../../indicators/price/swing-points";
import { atr as calcAtr } from "../../indicators/volatility/atr";
import type { Candle, NormalizedCandle } from "../../types";
import {
  type TrendlineFit,
  avgClosePrice,
  calculateBaseConfidence,
  calculateBreakoutLevels,
  checkBreakoutVolume,
  clampConfidence,
  fitTrendlinePair,
  isSlopeFlat,
  lookupAtr,
} from "./trendline-utils";
import type { FlagOptions, PatternKeyPoint, PatternSignal } from "./types";

type FlagSubtype = "bull_flag" | "bear_flag" | "bull_pennant" | "bear_pennant";

interface FlagpoleResult {
  startIndex: number;
  endIndex: number;
  direction: "up" | "down";
  magnitude: number;
}

/**
 * Find a flagpole (sharp impulse move) ending near the given index
 */
function findFlagpole(
  candles: NormalizedCandle[],
  endIndex: number,
  atrValue: number,
  minAtrMultiple: number,
  maxPoleBars: number,
): FlagpoleResult | null {
  if (endIndex < 2 || atrValue <= 0) return null;

  const startSearch = Math.max(0, endIndex - maxPoleBars);
  let bestPole: FlagpoleResult | null = null;
  let bestMagnitude = 0;

  for (let startIdx = startSearch; startIdx < endIndex - 1; startIdx++) {
    const priceChange = candles[endIndex].close - candles[startIdx].close;
    const absMagnitude = Math.abs(priceChange);
    const barsUsed = endIndex - startIdx;

    if (absMagnitude < atrValue * minAtrMultiple) continue;

    // Prefer shorter, sharper poles
    const efficiency = absMagnitude / barsUsed;
    const bestEfficiency = bestPole ? bestMagnitude / (endIndex - bestPole.startIndex) : 0;

    if (efficiency > bestEfficiency) {
      bestPole = {
        startIndex: startIdx,
        endIndex,
        direction: priceChange > 0 ? "up" : "down",
        magnitude: absMagnitude,
      };
      bestMagnitude = absMagnitude;
    }
  }

  return bestPole;
}

/**
 * Classify consolidation after flagpole as flag or pennant
 */
function classifyConsolidation(
  upper: TrendlineFit,
  lower: TrendlineFit,
  poleDirection: "up" | "down",
  avgPrice: number,
  flatTolerance: number,
): FlagSubtype | null {
  const upperDescending = upper.slope < 0;
  const lowerAscending = lower.slope > 0;
  const upperFlat = isSlopeFlat(upper.slope, avgPrice, flatTolerance);
  const lowerFlat = isSlopeFlat(lower.slope, avgPrice, flatTolerance);

  // Pennant: converging symmetrical triangle
  if (upper.slope < lower.slope && upperDescending && lowerAscending) {
    return poleDirection === "up" ? "bull_pennant" : "bear_pennant";
  }

  // Flag: small counter-trend channel
  if (poleDirection === "up") {
    // Bull flag: consolidation drifts down or is flat
    if ((upper.slope < 0 || upperFlat) && (lower.slope < 0 || lowerFlat)) {
      return "bull_flag";
    }
  } else {
    // Bear flag: consolidation drifts up or is flat
    if ((upper.slope > 0 || upperFlat) && (lower.slope > 0 || lowerFlat)) {
      return "bear_flag";
    }
  }

  return null;
}

/**
 * Calculate flag/pennant confidence
 */
function calculateFlagConfidence(
  upper: TrendlineFit,
  lower: TrendlineFit,
  poleMagnitude: number,
  patternHeight: number,
  atrValue: number,
  confirmed: boolean,
  volumeValid: boolean,
): number {
  // Use base R-squared scoring (with lower weight: 15 instead of 20)
  const avgR2 = (upper.rSquared + lower.rSquared) / 2;
  let confidence = 40 + avgR2 * 15;

  // Consolidation should be small relative to pole
  if (poleMagnitude > 0 && patternHeight / poleMagnitude < 0.5) confidence += 10;
  if (poleMagnitude > 0 && patternHeight / poleMagnitude < 0.3) confidence += 5;

  // Pole strength relative to ATR
  if (atrValue > 0 && poleMagnitude / atrValue > 3) confidence += 10;

  if (confirmed) confidence += 10;
  if (!volumeValid) confidence -= 10;

  return clampConfidence(confidence);
}

/**
 * Find breakout from flag/pennant in the expected direction
 */
function findFlagBreakout(
  candles: NormalizedCandle[],
  upper: TrendlineFit,
  lower: TrendlineFit,
  poleDirection: "up" | "down",
  fromIndex: number,
  maxBars: number,
): { index: number; direction: "up" | "down" } | null {
  const endIndex = Math.min(fromIndex + maxBars, candles.length);

  for (let i = fromIndex; i < endIndex; i++) {
    if (poleDirection === "up" && candles[i].close > upper.valueAt(i)) {
      return { index: i, direction: "up" };
    }
    if (poleDirection === "down" && candles[i].close < lower.valueAt(i)) {
      return { index: i, direction: "down" };
    }
  }

  return null;
}

/**
 * Detect Flag and Pennant patterns
 *
 * Identifies a sharp impulse move (flagpole) followed by a small
 * consolidation period (flag or pennant shape).
 *
 * @param candles - Price data
 * @param options - Detection options
 * @returns Array of detected flag/pennant patterns
 *
 * @example
 * ```ts
 * const patterns = detectFlag(candles);
 * const bullFlags = patterns.filter(p => p.type === 'bull_flag');
 * ```
 */
export function detectFlag(
  candles: Candle[] | NormalizedCandle[],
  options: FlagOptions = {},
): PatternSignal[] {
  const {
    swingLookback = 2,
    minPoints = 2,
    minRSquared = 0.5,
    flatTolerance = 0.0003,
    minAtrMultiple = 2.0,
    maxPoleBars = 8,
    minConsolidationBars = 5,
    maxConsolidationBars = 20,
    maxBreakoutBars = 10,
    validateVolume = true,
    minVolumeIncrease = 1.2,
    volumeLookback = 10,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const minTotalBars = maxPoleBars + minConsolidationBars;
  if (normalized.length < minTotalBars) return [];

  const results: PatternSignal[] = [];
  const atrData = calcAtr(normalized, { period: 14 });
  const seenPatterns = new Set<string>();

  const swingOpts = { leftBars: swingLookback, rightBars: swingLookback };
  const highs = getSwingHighs(normalized, swingOpts);
  const lows = getSwingLows(normalized, swingOpts);

  if (highs.length < minPoints || lows.length < minPoints) return [];

  // Find flagpole candidates at swing extremes (sharp moves ending at swing highs/lows)
  // instead of scanning every bar, which causes massive over-detection.
  const poleEndCandidates: { index: number; direction: "up" | "down" }[] = [];
  for (const h of highs) {
    if (h.index >= maxPoleBars) poleEndCandidates.push({ index: h.index, direction: "up" });
  }
  for (const l of lows) {
    if (l.index >= maxPoleBars) poleEndCandidates.push({ index: l.index, direction: "down" });
  }
  poleEndCandidates.sort((a, b) => a.index - b.index);

  for (const candidate of poleEndCandidates) {
    const consStart = candidate.index;
    if (consStart + minConsolidationBars >= normalized.length) continue;

    const currentAtr = lookupAtr(atrData, normalized, consStart);
    if (currentAtr <= 0) continue;

    const pole = findFlagpole(normalized, consStart, currentAtr, minAtrMultiple, maxPoleBars);
    if (!pole) continue;
    // Direction must match the swing point type
    if (pole.direction !== candidate.direction) continue;

    // Try the consolidation window that maximizes swing point coverage
    const consEndMax = Math.min(consStart + maxConsolidationBars, normalized.length - 1);
    const consEnd = consEndMax;
    const consEndMin = consStart + minConsolidationBars;
    if (consEndMin > consEndMax) continue;

    // Get swing points within the consolidation zone
    const consHighs = highs
      .filter((h) => h.index >= consStart && h.index <= consEnd)
      .map((h) => ({ index: h.index, price: h.price }));
    const consLows = lows
      .filter((l) => l.index >= consStart && l.index <= consEnd)
      .map((l) => ({ index: l.index, price: l.price }));

    if (consHighs.length < minPoints || consLows.length < minPoints) continue;

    const pair = fitTrendlinePair(consHighs, consLows);
    if (!pair) continue;

    const { upper, lower } = pair;
    if (upper.rSquared < minRSquared || lower.rSquared < minRSquared) continue;

    const avgPrice = avgClosePrice(normalized, consStart, consEnd);
    const subtype = classifyConsolidation(upper, lower, pole.direction, avgPrice, flatTolerance);
    if (!subtype) continue;

    // Deduplicate by pole location
    const patternKey = `${subtype}_${Math.round(pole.startIndex / maxPoleBars)}`;
    if (seenPatterns.has(patternKey)) continue;
    seenPatterns.add(patternKey);

    const midIndex = (consStart + consEnd) / 2;
    const patternHeight = Math.abs(upper.valueAt(midIndex) - lower.valueAt(midIndex));

    // Consolidation should retrace no more than 50% of the pole (industry standard: 38-50%)
    if (patternHeight > pole.magnitude * 0.5) continue;

    // Consolidation duration should not greatly exceed the flagpole duration
    const poleBars = pole.endIndex - pole.startIndex;
    const consBars = consEnd - consStart;
    if (poleBars > 0 && consBars > poleBars * 3) continue;

    // Volume should generally decrease during consolidation
    const poleAvgVol =
      normalized.slice(pole.startIndex, pole.endIndex + 1).reduce((s, c) => s + c.volume, 0) /
      (poleBars + 1);
    const consAvgVol =
      normalized.slice(consStart, consEnd + 1).reduce((s, c) => s + c.volume, 0) / (consBars + 1);
    if (poleAvgVol > 0 && consAvgVol > poleAvgVol * 1.2) continue;

    const breakout = findFlagBreakout(
      normalized,
      upper,
      lower,
      pole.direction,
      consEnd + 1,
      maxBreakoutBars,
    );
    const confirmed = breakout != null;

    const volumeValid = confirmed
      ? checkBreakoutVolume(
          normalized,
          breakout?.index ?? consEnd,
          validateVolume,
          volumeLookback,
          minVolumeIncrease,
        )
      : true;

    const detectionIndex = confirmed ? (breakout?.index ?? consEnd) : consEnd;

    const confidence = calculateFlagConfidence(
      upper,
      lower,
      pole.magnitude,
      patternHeight,
      currentAtr,
      confirmed,
      volumeValid,
    );

    // Target: flagpole magnitude projected from breakout
    const levels = breakout
      ? calculateBreakoutLevels(normalized, breakout, upper, lower, pole.magnitude)
      : undefined;

    // Build key points with pole start/end + consolidation touches
    const keyPoints: PatternKeyPoint[] = [
      {
        time: normalized[pole.startIndex].time,
        index: pole.startIndex,
        price: normalized[pole.startIndex].close,
        label: "pole_start",
      },
      {
        time: normalized[pole.endIndex].time,
        index: pole.endIndex,
        price: normalized[pole.endIndex].close,
        label: "pole_end",
      },
    ];
    for (const p of consHighs) {
      keyPoints.push({
        time: normalized[p.index].time,
        index: p.index,
        price: p.price,
        label: "consolidation_high",
      });
    }
    for (const p of consLows) {
      keyPoints.push({
        time: normalized[p.index].time,
        index: p.index,
        price: p.price,
        label: "consolidation_low",
      });
    }
    keyPoints.sort((a, b) => a.index - b.index);

    results.push({
      time: normalized[detectionIndex].time,
      type: subtype,
      pattern: {
        startTime: normalized[pole.startIndex].time,
        endTime: normalized[consEnd].time,
        keyPoints,
        target: levels?.target,
        stopLoss: levels?.stopLoss,
        height: pole.magnitude,
      },
      confidence,
      confirmed,
    });
  }

  return results;
}
