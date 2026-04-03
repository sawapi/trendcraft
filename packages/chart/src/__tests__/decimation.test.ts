import { describe, expect, it } from "vitest";
import { decimateCandles, getDecimationTarget, lttb } from "../core/decimation";
import type { CandleData, DataPoint } from "../core/types";

describe("lttb", () => {
  function makeData(count: number): DataPoint<number>[] {
    return Array.from({ length: count }, (_, i) => ({
      time: i * 1000,
      value: Math.sin(i * 0.1) * 100,
    }));
  }

  it("returns original data if already smaller than target", () => {
    const data = makeData(10);
    const result = lttb(data, 20);
    expect(result.length).toBe(10);
  });

  it("reduces data to target count", () => {
    const data = makeData(1000);
    const result = lttb(data, 100);
    expect(result.length).toBe(100);
  });

  it("preserves first and last points", () => {
    const data = makeData(500);
    const result = lttb(data, 50);
    expect(result[0].time).toBe(data[0].time);
    expect(result[result.length - 1].time).toBe(data[data.length - 1].time);
  });

  it("handles null values gracefully", () => {
    const data: DataPoint<number | null>[] = [
      { time: 0, value: 10 },
      { time: 1, value: null },
      { time: 2, value: 20 },
      { time: 3, value: null },
      { time: 4, value: 30 },
    ];
    // Only 3 valid points, which equals target → returns original
    const result = lttb(data, 3);
    expect(result.length).toBe(5);
  });

  it("returns empty for empty input", () => {
    const result = lttb([], 10);
    expect(result.length).toBe(0);
  });
});

describe("decimateCandles", () => {
  function makeCandles(count: number): CandleData[] {
    return Array.from({ length: count }, (_, i) => ({
      time: i * 86400000,
      open: 100 + i,
      high: 102 + i,
      low: 98 + i,
      close: 101 + i,
      volume: 1000 * (i + 1),
    }));
  }

  it("returns original slice if within maxBars", () => {
    const candles = makeCandles(50);
    const result = decimateCandles(candles, 0, 50, 100);
    expect(result.length).toBe(50);
  });

  it("reduces to maxBars count", () => {
    const candles = makeCandles(1000);
    const result = decimateCandles(candles, 0, 1000, 200);
    expect(result.length).toBe(200);
  });

  it("preserves OHLCV extremes in buckets", () => {
    const candles = makeCandles(100);
    const result = decimateCandles(candles, 0, 100, 10);
    // Each bucket of 10 candles: high should be max of bucket, low should be min
    expect(result[0].open).toBe(candles[0].open);
    expect(result[0].close).toBe(candles[9].close);
    expect(result[0].high).toBeGreaterThanOrEqual(candles[0].high);
    expect(result[0].low).toBeLessThanOrEqual(candles[9].low);
  });

  it("sums volume across bucket", () => {
    const candles = makeCandles(10);
    const result = decimateCandles(candles, 0, 10, 2);
    const firstBucketVolume = candles.slice(0, 5).reduce((s, c) => s + c.volume, 0);
    expect(result[0].volume).toBe(firstBucketVolume);
  });
});

describe("getDecimationTarget", () => {
  it("returns 0 when no decimation needed", () => {
    expect(getDecimationTarget(100, 800)).toBe(0);
  });

  it("returns target when too many points", () => {
    const target = getDecimationTarget(5000, 800);
    expect(target).toBe(800);
    expect(target).toBeLessThan(5000);
  });
});
