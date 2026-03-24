import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import type { CandleData, DataPoint, PaneRect } from "../core/types";
import { computePaneRange, computeSeriesRange } from "../renderer/range-calculator";

function makeCandle(time: number, close: number, high?: number, low?: number): CandleData {
  return {
    time,
    open: close - 1,
    high: high ?? close + 2,
    low: low ?? close - 2,
    close,
    volume: 1000,
  };
}

function makeSeries(data: DataPoint<unknown>[], paneId = "main"): InternalSeries {
  return {
    id: "s1",
    paneId,
    type: "line",
    config: {},
    data,
    visible: true,
  };
}

function makePane(id: string): PaneRect {
  return { id, x: 0, y: 0, width: 800, height: 300, config: { id, flex: 1 } };
}

describe("computePaneRange", () => {
  const candles = [makeCandle(1, 100), makeCandle(2, 110), makeCandle(3, 95)];

  it("computes range for main pane from candles", () => {
    const [min, max] = computePaneRange(makePane("main"), 0, 3, candles, []);
    expect(min).toBeLessThanOrEqual(93); // lowest low
    expect(max).toBeGreaterThanOrEqual(112); // highest high
  });

  it("computes range for volume pane", () => {
    const [min, max] = computePaneRange(makePane("volume"), 0, 3, candles, []);
    expect(min).toBe(0);
    expect(max).toBe(1000);
  });

  it("returns default range for empty subchart", () => {
    const [min, max] = computePaneRange(makePane("rsi"), 0, 3, candles, []);
    expect(min).toBe(0);
    expect(max).toBe(100);
  });

  it("includes series range in main pane", () => {
    const series = makeSeries([
      { time: 1, value: 50 },
      { time: 2, value: 200 },
    ]);
    const [min, max] = computePaneRange(makePane("main"), 0, 2, candles, [series]);
    expect(min).toBeLessThanOrEqual(50);
    expect(max).toBeGreaterThanOrEqual(200);
  });
});

describe("computeSeriesRange", () => {
  it("computes range for number series", () => {
    const series = makeSeries([
      { time: 1, value: 30 },
      { time: 2, value: 70 },
      { time: 3, value: 50 },
    ]);
    const [min, max] = computeSeriesRange(series, 0, 3);
    expect(min).toBe(30);
    expect(max).toBe(70);
  });

  it("computes range for band series", () => {
    const series = makeSeries([
      { time: 1, value: { upper: 110, middle: 100, lower: 90 } },
      { time: 2, value: { upper: 120, middle: 105, lower: 85 } },
    ]);
    const [min, max] = computeSeriesRange(series, 0, 2);
    expect(min).toBeLessThanOrEqual(85);
    expect(max).toBeGreaterThanOrEqual(120);
  });

  it("handles null values in number series", () => {
    const series = makeSeries([
      { time: 1, value: null },
      { time: 2, value: 50 },
      { time: 3, value: null },
    ]);
    const [min, max] = computeSeriesRange(series, 0, 3);
    expect(min).toBe(50);
    expect(max).toBe(50);
  });

  it("returns infinity for empty data", () => {
    const series = makeSeries([]);
    const [min, max] = computeSeriesRange(series, 0, 0);
    expect(min).toBe(Number.POSITIVE_INFINITY);
  });
});
