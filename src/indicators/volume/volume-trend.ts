/**
 * Volume Trend Confirmation
 *
 * Analyzes whether volume confirms or diverges from price trend.
 * Key principle: Healthy trends should be supported by increasing volume.
 */

import { normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series, VolumeTrendValue } from "../../types";

/**
 * Volume trend confirmation options
 */
export type VolumeTrendOptions = {
  /** Period for price trend detection (default: 10) */
  pricePeriod?: number;
  /** Period for volume trend detection (default: 10) */
  volumePeriod?: number;
  /** Period for volume moving average baseline (default: 20) */
  maPeriod?: number;
  /** Minimum price change percent to consider as trend (default: 2.0) */
  minPriceChange?: number;
};

/**
 * Analyze volume trend confirmation
 *
 * Confirms whether volume supports the current price trend:
 * - Confirmed uptrend: Price rising + volume increasing
 * - Confirmed downtrend: Price falling + volume increasing (strong selling)
 * - Divergence (bullish): Price falling + volume decreasing (selling exhaustion)
 * - Divergence (bearish): Price rising + volume decreasing (weak rally)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Analysis options
 * @returns Series of volume trend confirmation values
 *
 * @example
 * ```ts
 * const trends = volumeTrend(candles);
 *
 * // Find confirmed uptrends
 * const confirmed = trends.filter(t =>
 *   t.value.priceTrend === "up" && t.value.isConfirmed
 * );
 *
 * // Find divergences (potential reversals)
 * const divergences = trends.filter(t => t.value.hasDivergence);
 * ```
 */
export function volumeTrend(
  candles: Candle[] | NormalizedCandle[],
  options: VolumeTrendOptions = {}
): Series<VolumeTrendValue> {
  const { pricePeriod = 10, volumePeriod = 10, maPeriod = 20, minPriceChange = 2.0 } = options;

  const minPeriod = Math.max(pricePeriod, volumePeriod, maPeriod);

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<VolumeTrendValue> = [];

  // Pre-extract price and volume arrays to avoid repeated access
  const prices = new Array<number>(normalized.length);
  const volumes = new Array<number>(normalized.length);
  for (let i = 0; i < normalized.length; i++) {
    prices[i] = normalized[i].close;
    volumes[i] = normalized[i].volume;
  }

  // Pre-calculate volume moving averages using sliding window (O(n) instead of O(n²))
  const volumeMAs: (number | null)[] = new Array(normalized.length);
  let runningSum = 0;
  for (let i = 0; i < normalized.length; i++) {
    runningSum += volumes[i];
    if (i >= maPeriod) {
      runningSum -= volumes[i - maPeriod];
    }
    if (i < maPeriod - 1) {
      volumeMAs[i] = null;
    } else {
      volumeMAs[i] = runningSum / maPeriod;
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    if (i < minPeriod - 1) {
      // Not enough data
      result.push({
        time: normalized[i].time,
        value: {
          priceTrend: "neutral",
          volumeTrend: "neutral",
          isConfirmed: false,
          hasDivergence: false,
          confidence: 0,
        },
      });
      continue;
    }

    // Analyze price trend using linear regression slope (pass array + indices instead of slice)
    const priceTrendInfo = analyzeTrendFast(prices, i - pricePeriod + 1, i + 1, minPriceChange);

    // Analyze volume trend (pass array + indices instead of slice)
    const volumeTrendInfo = analyzeVolumeTrendFast(
      volumes,
      i - volumePeriod + 1,
      i + 1,
      volumeMAs[i],
      normalized[i].volume
    );

    // Determine confirmation and divergence
    const { isConfirmed, hasDivergence, confidence } = evaluateConfirmation(
      priceTrendInfo,
      volumeTrendInfo
    );

    result.push({
      time: normalized[i].time,
      value: {
        priceTrend: priceTrendInfo.direction,
        volumeTrend: volumeTrendInfo.direction,
        isConfirmed,
        hasDivergence,
        confidence,
      },
    });
  }

  return result;
}

type TrendInfo = {
  direction: "up" | "down" | "neutral";
  strength: number; // 0-1
  slope: number;
};

/**
 * Analyze price trend using linear regression (optimized: no array copy)
 * @param arr - Full array of prices
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @param minChange - Minimum price change percent
 */
function analyzeTrendFast(arr: number[], start: number, end: number, minChange: number): TrendInfo {
  const n = end - start;
  if (n < 2) {
    return { direction: "neutral", strength: 0, slope: 0 };
  }

  const first = arr[start];
  const last = arr[end - 1];

  // Calculate percentage change
  const change = first > 0 ? ((last - first) / first) * 100 : 0;

  // Calculate linear regression slope
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const val = arr[start + i];
    sumX += i;
    sumY += val;
    sumXY += i * val;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

  // Normalize slope relative to average price
  const avgPrice = sumY / n;
  const normalizedSlope = avgPrice > 0 ? (slope / avgPrice) * 100 : 0;

  // Determine direction based on both change and slope
  let direction: "up" | "down" | "neutral";
  if (change > minChange && normalizedSlope > 0) {
    direction = "up";
  } else if (change < -minChange && normalizedSlope < 0) {
    direction = "down";
  } else {
    direction = "neutral";
  }

  // Strength based on consistency and magnitude
  const strength = Math.min(Math.abs(change) / (minChange * 2), 1);

  return { direction, strength, slope: normalizedSlope };
}

/**
 * Analyze volume trend (optimized: no array copy)
 * @param arr - Full array of volumes
 * @param start - Start index (inclusive)
 * @param end - End index (exclusive)
 * @param currentMA - Current volume moving average
 * @param currentVolume - Current volume
 */
function analyzeVolumeTrendFast(
  arr: number[],
  start: number,
  end: number,
  currentMA: number | null,
  currentVolume: number
): TrendInfo {
  const n = end - start;
  if (n < 2) {
    return { direction: "neutral", strength: 0, slope: 0 };
  }

  // Calculate average of first half vs second half
  const halfN = Math.floor(n / 2);
  let firstHalfSum = 0;
  let secondHalfSum = 0;

  for (let i = 0; i < halfN; i++) {
    firstHalfSum += arr[start + i];
  }
  for (let i = halfN; i < n; i++) {
    secondHalfSum += arr[start + i];
  }

  const firstHalfAvg = firstHalfSum / halfN;
  const secondHalfAvg = secondHalfSum / (n - halfN);

  // Calculate trend
  let direction: "up" | "down" | "neutral";
  let strength = 0;

  if (firstHalfAvg > 0) {
    const volumeChange = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;

    if (volumeChange > 0.1) {
      // Volume increasing by more than 10%
      direction = "up";
      strength = Math.min(volumeChange, 1);
    } else if (volumeChange < -0.1) {
      // Volume decreasing by more than 10%
      direction = "down";
      strength = Math.min(Math.abs(volumeChange), 1);
    } else {
      direction = "neutral";
      strength = 0;
    }
  } else {
    direction = "neutral";
  }

  // Boost strength if current volume is significantly above MA
  if (currentMA !== null && currentMA > 0) {
    const volumeRatio = currentVolume / currentMA;
    if (volumeRatio > 1.5) {
      strength = Math.min(strength + 0.3, 1);
    }
  }

  return { direction, strength, slope: 0 };
}

/**
 * Evaluate confirmation and divergence
 */
function evaluateConfirmation(
  priceTrend: TrendInfo,
  volumeTrend: TrendInfo
): { isConfirmed: boolean; hasDivergence: boolean; confidence: number } {
  // Neutral price trend = no confirmation or divergence possible
  if (priceTrend.direction === "neutral") {
    return { isConfirmed: false, hasDivergence: false, confidence: 0 };
  }

  // Volume confirms price: both up, or price down + volume up (strong selling)
  const isConfirmed =
    (priceTrend.direction === "up" && volumeTrend.direction === "up") ||
    (priceTrend.direction === "down" && volumeTrend.direction === "up");

  // Divergence: price up + volume down (weak rally) or price down + volume down (exhaustion)
  const hasDivergence =
    (priceTrend.direction === "up" && volumeTrend.direction === "down") ||
    (priceTrend.direction === "down" && volumeTrend.direction === "down");

  // Calculate confidence
  let confidence = 0;
  if (isConfirmed) {
    confidence = ((priceTrend.strength + volumeTrend.strength) / 2) * 100;
  } else if (hasDivergence) {
    // Divergence confidence depends on how clear the divergence is
    confidence = ((priceTrend.strength + volumeTrend.strength) / 2) * 80;
  }

  return {
    isConfirmed,
    hasDivergence,
    confidence: Math.round(confidence),
  };
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
