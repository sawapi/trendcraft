import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { anchoredVwap } from "../volume/anchored-vwap";

describe("anchoredVwap", () => {
  const makeCandles = (
    data: Array<{ time: number; high: number; low: number; close: number; volume: number }>,
  ): NormalizedCandle[] =>
    data.map((d) => ({
      time: d.time,
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

  const baseTime = 1700000000000;

  it("should return empty for empty input", () => {
    expect(anchoredVwap([], { anchorTime: baseTime })).toEqual([]);
  });

  it("should return null before anchor time", () => {
    const candles = makeCandles([
      { time: baseTime, high: 110, low: 90, close: 100, volume: 1000 },
      { time: baseTime + 86400000, high: 120, low: 100, close: 110, volume: 2000 },
      { time: baseTime + 86400000 * 2, high: 130, low: 110, close: 120, volume: 1500 },
    ]);

    const result = anchoredVwap(candles, { anchorTime: baseTime + 86400000 * 2 });

    expect(result[0].value.vwap).toBeNull();
    expect(result[1].value.vwap).toBeNull();
    expect(result[2].value.vwap).not.toBeNull();
  });

  it("should calculate cumulative VWAP from anchor point", () => {
    const candles = makeCandles([
      { time: baseTime, high: 110, low: 90, close: 100, volume: 1000 },
      { time: baseTime + 86400000, high: 120, low: 100, close: 110, volume: 2000 },
      { time: baseTime + 86400000 * 2, high: 130, low: 110, close: 120, volume: 1500 },
    ]);

    const result = anchoredVwap(candles, { anchorTime: baseTime + 86400000 });

    // Before anchor
    expect(result[0].value.vwap).toBeNull();

    // At anchor: TP = (120 + 100 + 110) / 3 = 110, VWAP = 110 * 2000 / 2000 = 110
    expect(result[1].value.vwap).toBe(110);

    // After anchor: cumulative
    // TP2 = (130 + 110 + 120) / 3 = 120
    // VWAP = (110 * 2000 + 120 * 1500) / (2000 + 1500)
    //      = (220000 + 180000) / 3500 ≈ 114.286
    expect(result[2].value.vwap).toBeCloseTo(114.286, 2);
  });

  it("should include bands when requested", () => {
    const candles = makeCandles([
      { time: baseTime, high: 110, low: 90, close: 100, volume: 1000 },
      { time: baseTime + 86400000, high: 120, low: 100, close: 110, volume: 2000 },
      { time: baseTime + 86400000 * 2, high: 130, low: 110, close: 120, volume: 1500 },
    ]);

    const result = anchoredVwap(candles, { anchorTime: baseTime, bands: 2 });

    // All should have band fields
    expect(result[0].value.upper1).not.toBeUndefined();
    expect(result[0].value.lower1).not.toBeUndefined();
    expect(result[0].value.upper2).not.toBeUndefined();
    expect(result[0].value.lower2).not.toBeUndefined();

    // With enough data, bands should be symmetric around VWAP
    const last = result[2].value;
    if (last.vwap !== null && last.upper1 != null && last.lower1 != null) {
      const spread1 = last.upper1 - last.vwap;
      const spreadLow1 = last.vwap - last.lower1;
      expect(spread1).toBeCloseTo(spreadLow1, 6);
    }

    // 2σ should be wider than 1σ
    if (last.upper1 != null && last.upper2 != null) {
      expect(last.upper2).toBeGreaterThan(last.upper1);
    }
  });

  it("should return null bands before anchor with bands option", () => {
    const candles = makeCandles([
      { time: baseTime, high: 110, low: 90, close: 100, volume: 1000 },
      { time: baseTime + 86400000, high: 120, low: 100, close: 110, volume: 2000 },
    ]);

    const result = anchoredVwap(candles, { anchorTime: baseTime + 86400000, bands: 1 });

    expect(result[0].value.upper1).toBeNull();
    expect(result[0].value.lower1).toBeNull();
  });
});
