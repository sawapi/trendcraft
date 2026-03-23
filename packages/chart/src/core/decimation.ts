/**
 * Data Decimation — Reduces data points for performance at low zoom levels.
 *
 * LTTB (Largest Triangle Three Buckets): Preserves visual shape of line data.
 * Candle bucketing: Merges multiple candles into one when pixel density is too high.
 */

import type { CandleData, DataPoint } from "./types";

/**
 * LTTB (Largest Triangle Three Buckets) algorithm.
 * Reduces a series of points to `targetCount` while preserving visual shape.
 *
 * @param data - Input data points (must be sorted by time)
 * @param targetCount - Desired number of output points
 * @returns Decimated data (or original if already small enough)
 */
export function lttb(
  data: readonly DataPoint<number | null>[],
  targetCount: number,
): DataPoint<number | null>[] {
  const validPoints: { index: number; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i]?.value;
    if (v !== null && v !== undefined) {
      validPoints.push({ index: i, value: v });
    }
  }

  if (validPoints.length <= targetCount || targetCount < 3) {
    return data.slice() as DataPoint<number | null>[];
  }

  const bucketSize = (validPoints.length - 2) / (targetCount - 2);
  const result: DataPoint<number | null>[] = [];

  // Always keep first point
  result.push(data[validPoints[0].index]);

  let prevSelectedIdx = 0;

  for (let bucket = 1; bucket < targetCount - 1; bucket++) {
    const bucketStart = Math.floor((bucket - 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor(bucket * bucketSize) + 1, validPoints.length - 1);

    // Next bucket average (for triangle area calculation)
    const nextBucketStart = Math.floor(bucket * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((bucket + 1) * bucketSize) + 1, validPoints.length);
    let avgX = 0;
    let avgY = 0;
    let nextCount = 0;
    for (let i = nextBucketStart; i < nextBucketEnd; i++) {
      avgX += validPoints[i].index;
      avgY += validPoints[i].value;
      nextCount++;
    }
    if (nextCount > 0) {
      avgX /= nextCount;
      avgY /= nextCount;
    }

    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let maxIdx = bucketStart;

    const prevX = validPoints[prevSelectedIdx].index;
    const prevY = validPoints[prevSelectedIdx].value;

    for (let i = bucketStart; i < bucketEnd; i++) {
      const area = Math.abs(
        (prevX - avgX) * (validPoints[i].value - prevY) -
          (prevX - validPoints[i].index) * (avgY - prevY),
      );
      if (area > maxArea) {
        maxArea = area;
        maxIdx = i;
      }
    }

    result.push(data[validPoints[maxIdx].index]);
    prevSelectedIdx = maxIdx;
  }

  // Always keep last point
  result.push(data[validPoints[validPoints.length - 1].index]);

  return result;
}

/**
 * Decimate candles by merging multiple candles into OHLCV buckets.
 * Used when bar spacing is less than 1px (too many candles per pixel).
 *
 * @param candles - Input candles
 * @param startIndex - First visible index
 * @param endIndex - Last visible index (exclusive)
 * @param maxBars - Maximum number of output bars
 * @returns Decimated candles (or original slice if already small enough)
 */
export function decimateCandles(
  candles: readonly CandleData[],
  startIndex: number,
  endIndex: number,
  maxBars: number,
): CandleData[] {
  const count = endIndex - startIndex;
  if (count <= maxBars || maxBars <= 0) {
    return candles.slice(startIndex, endIndex) as CandleData[];
  }

  const bucketSize = count / maxBars;
  const result: CandleData[] = [];

  for (let b = 0; b < maxBars; b++) {
    const bStart = startIndex + Math.floor(b * bucketSize);
    const bEnd = Math.min(startIndex + Math.floor((b + 1) * bucketSize), endIndex);

    const open = candles[bStart].open;
    let high = Number.NEGATIVE_INFINITY;
    let low = Number.POSITIVE_INFINITY;
    const close = candles[bEnd - 1].close;
    let volume = 0;
    const time = candles[bStart].time;

    for (let i = bStart; i < bEnd; i++) {
      const c = candles[i];
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume;
    }

    result.push({ time, open, high, low, close, volume });
  }

  return result;
}

/**
 * Determine if decimation is needed based on bar spacing.
 * Returns the target point count, or 0 if no decimation needed.
 */
export function getDecimationTarget(
  dataCount: number,
  pixelWidth: number,
  minPixelsPerPoint = 1,
): number {
  const maxPoints = Math.floor(pixelWidth / minPixelsPerPoint);
  if (dataCount <= maxPoints) return 0;
  return maxPoints;
}
