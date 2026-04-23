/**
 * Regression: candle buckets and LTTB-decimated indicator lines must share
 * the same screen-x coordinate space (the original timeScale's `indexToX`).
 *
 * Previously (v0.1.x) at `barSpacing < 1px` the candle path remapped the
 * timeScale to fill the canvas while the line path compressed a decimated
 * array onto the left portion — overlays drifted off the bars they were
 * supposed to annotate.
 */

import { describe, expect, it } from "vitest";
import { decimateCandles, lttb } from "../core/decimation";
import { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, DataPoint } from "../core/types";

function makeCandles(n: number): CandleData[] {
  return Array.from({ length: n }, (_, i) => ({
    time: i * 86_400_000,
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100 + i,
    volume: 1000 + i,
  }));
}

function makeLine(n: number): DataPoint<number>[] {
  return Array.from({ length: n }, (_, i) => ({ time: i * 86_400_000, value: 100 + i }));
}

describe("decimation x-alignment", () => {
  it("candle bucket center x matches indicator point x on the same timeScale", () => {
    const N = 2000;
    const candles = makeCandles(N);
    const line = makeLine(N);

    const ts = new TimeScale();
    ts.setWidth(800);
    ts.setTotalCount(N);
    ts.setVisibleRange(0, N); // barSpacing < 1 → decimation kicks in

    const candleTarget = 740;
    const lineTarget = 740;

    const dc = decimateCandles(candles, 0, N, candleTarget);
    const dl = lttb(line.slice(0, N), lineTarget, 0);

    // First + last bucket centers line up with first + last LTTB points.
    // (First and last LTTB points are always the input endpoints, so we
    // compare against candle bucket centers at index 0 and last.)
    const firstCandleX = ts.indexToX(dc.originalIndices[0]);
    const firstLineX = ts.indexToX(dl.originalIndices[0]);
    expect(Math.abs(firstCandleX - firstLineX)).toBeLessThanOrEqual(5);

    const lastCandleX = ts.indexToX(dc.originalIndices[dc.originalIndices.length - 1]);
    const lastLineX = ts.indexToX(dl.originalIndices[dl.originalIndices.length - 1]);
    expect(Math.abs(lastCandleX - lastLineX)).toBeLessThanOrEqual(5);

    // Both sets cover the full canvas width (0..ts.width ± bucketSpacing).
    expect(firstCandleX).toBeLessThan(40);
    expect(lastCandleX).toBeGreaterThan(ts.width - 40);
    expect(firstLineX).toBeLessThan(40);
    expect(lastLineX).toBeGreaterThan(ts.width - 40);
  });

  it("lttb with offset shifts originalIndices into the parent coordinate space", () => {
    const data = makeLine(500);
    const startIndex = 100;
    const slice = data.slice(startIndex, startIndex + 300);
    const result = lttb(slice, 80, startIndex);
    expect(result.originalIndices[0]).toBe(startIndex);
    expect(result.originalIndices[result.originalIndices.length - 1]).toBe(startIndex + 299);
  });

  it("non-decimated path still returns sequential originalIndices", () => {
    const candles = makeCandles(20);
    const dc = decimateCandles(candles, 5, 15, 100); // 10 candles ≤ maxBars
    expect(dc.candles.length).toBe(10);
    expect(Array.from(dc.originalIndices)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);

    const priceScale = new PriceScale();
    priceScale.setHeight(300);
    priceScale.setDataRange(99, 120);
    // Sanity: scale is wired, doesn't throw.
    expect(priceScale.priceToY(100)).toBeGreaterThan(0);
  });
});
