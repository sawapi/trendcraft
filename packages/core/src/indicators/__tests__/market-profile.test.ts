import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { marketProfile } from "../volume/market-profile";

describe("marketProfile", () => {
  const makeCandles = (
    data: { high: number; low: number; close: number; time?: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: d.time ?? 1700000000000 + i * 60000, // 1 min intervals within same day
      open: d.close,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(marketProfile([])).toEqual([]);
  });

  it("should compute POC for single candle", () => {
    const candles = makeCandles([{ high: 102, low: 98, close: 100 }]);
    const result = marketProfile(candles, { tickSize: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].value.poc).not.toBeNull();
    expect(result[0].value.profile).not.toBeNull();
    expect(result[0].value.profile!.size).toBeGreaterThan(0);
  });

  it("should identify POC at most-visited price level", () => {
    // Multiple candles all hovering around 100
    const candles = makeCandles([
      { high: 102, low: 98, close: 100 },
      { high: 101, low: 99, close: 100 },
      { high: 101, low: 99, close: 100 },
      { high: 105, low: 103, close: 104 }, // one visit to 104-105
    ]);
    const result = marketProfile(candles, { tickSize: 1 });

    const last = result[result.length - 1].value;
    // POC should be around 100 since most candles overlap there
    expect(last.poc).not.toBeNull();
    expect(last.poc!).toBeGreaterThanOrEqual(98);
    expect(last.poc!).toBeLessThanOrEqual(102);
  });

  it("should have valueAreaHigh >= valueAreaLow", () => {
    const candles = makeCandles([
      { high: 105, low: 95, close: 100 },
      { high: 103, low: 97, close: 100 },
      { high: 104, low: 96, close: 100 },
    ]);
    const result = marketProfile(candles, { tickSize: 1 });

    const last = result[result.length - 1].value;
    expect(last.valueAreaHigh).not.toBeNull();
    expect(last.valueAreaLow).not.toBeNull();
    expect(last.valueAreaHigh!).toBeGreaterThanOrEqual(last.valueAreaLow!);
  });

  it("should reset profile on new day", () => {
    const day1 = 1700000000000;
    const day2 = day1 + 86400000;
    const candles = makeCandles([
      { high: 102, low: 98, close: 100, time: day1 },
      { high: 101, low: 99, close: 100, time: day1 + 60000 },
      { high: 110, low: 108, close: 109, time: day2 }, // new day, far from 100
    ]);
    const result = marketProfile(candles, { tickSize: 1 });

    // Day 2 should reset — POC should be around 108-110
    const last = result[result.length - 1].value;
    expect(last.poc!).toBeGreaterThanOrEqual(108);
  });

  it("should auto-detect tick size when not provided", () => {
    const candles = makeCandles([
      { high: 200, low: 100, close: 150 },
      { high: 180, low: 120, close: 150 },
    ]);
    const result = marketProfile(candles);

    expect(result).toHaveLength(2);
    expect(result[0].value.poc).not.toBeNull();
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([
      { high: 102, low: 98, close: 100 },
      { high: 103, low: 99, close: 101 },
    ]);
    const result = marketProfile(candles, { tickSize: 1 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
