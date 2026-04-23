/**
 * Data Decimation — Reduces data points for performance at low zoom levels.
 *
 * LTTB (Largest Triangle Three Buckets): Preserves visual shape of line data.
 * Candle bucketing: Merges multiple candles into one when pixel density is too high.
 */

import type { CandleData, DataPoint } from "./types";

/**
 * LTTB decimation result. `originalIndices[i]` is the input-array index the
 * selected point at `points[i]` came from — callers use it to compute screen
 * x coordinates against the unmodified timeScale so the line aligns with
 * non-decimated overlays.
 */
export type DecimatedPoints<T> = {
  readonly points: readonly DataPoint<T>[];
  readonly originalIndices: Int32Array;
};

/**
 * Candle bucketing result. `originalIndices[i]` is the center original-array
 * index that bucket `i` represents. Used for screen-x alignment with
 * non-decimated indicators.
 */
export type DecimatedCandles = {
  readonly candles: readonly CandleData[];
  readonly originalIndices: Int32Array;
};

/**
 * LTTB (Largest Triangle Three Buckets) algorithm.
 * Reduces a series of points to `targetCount` while preserving visual shape.
 *
 * @param data - Input data points (must be sorted by time)
 * @param targetCount - Desired number of output points
 * @param indexOffset - Added to every `originalIndices` entry so callers who
 *        pass a slice can recover the absolute index in their coordinate
 *        space. Defaults to 0.
 * @returns Decimated points and a parallel array of their original indices
 *        (shifted by `indexOffset`).
 */
export function lttb(
  data: readonly DataPoint<number | null>[],
  targetCount: number,
  indexOffset = 0,
): DecimatedPoints<number | null> {
  const validPoints: { index: number; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const v = data[i]?.value;
    if (v !== null && v !== undefined) {
      validPoints.push({ index: i, value: v });
    }
  }

  if (validPoints.length <= targetCount || targetCount < 3) {
    const points = data.slice() as DataPoint<number | null>[];
    const originalIndices = new Int32Array(points.length);
    for (let i = 0; i < points.length; i++) originalIndices[i] = i + indexOffset;
    return { points, originalIndices };
  }

  const bucketSize = (validPoints.length - 2) / (targetCount - 2);
  const points: DataPoint<number | null>[] = [];
  const selectedIndices: number[] = [];

  // Always keep first point
  points.push(data[validPoints[0].index]);
  selectedIndices.push(validPoints[0].index);

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

    points.push(data[validPoints[maxIdx].index]);
    selectedIndices.push(validPoints[maxIdx].index);
    prevSelectedIdx = maxIdx;
  }

  // Always keep last point
  const lastIdx = validPoints[validPoints.length - 1].index;
  points.push(data[lastIdx]);
  selectedIndices.push(lastIdx);

  const originalIndices = new Int32Array(selectedIndices.length);
  for (let i = 0; i < selectedIndices.length; i++) {
    originalIndices[i] = selectedIndices[i] + indexOffset;
  }
  return { points, originalIndices };
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
): DecimatedCandles {
  const count = endIndex - startIndex;
  if (count <= maxBars || maxBars <= 0) {
    const result = candles.slice(startIndex, endIndex) as CandleData[];
    const originalIndices = new Int32Array(result.length);
    for (let i = 0; i < result.length; i++) originalIndices[i] = startIndex + i;
    return { candles: result, originalIndices };
  }

  const bucketSize = count / maxBars;
  const result: CandleData[] = [];
  const originalIndices = new Int32Array(maxBars);

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
    // Bucket center — anchors the rendered candle at the visual midpoint of
    // the bars it summarizes.
    originalIndices[b] = Math.floor((bStart + bEnd - 1) / 2);
  }

  return { candles: result, originalIndices };
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
