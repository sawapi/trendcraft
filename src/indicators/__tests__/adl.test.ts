import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { adl } from "../volume/adl";

describe("adl", () => {
  const makeCandles = (
    data: { high: number; low: number; close: number; volume: number }[],
  ): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: (d.high + d.low) / 2,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));

  it("should return empty for empty input", () => {
    expect(adl([])).toEqual([]);
  });

  it("should calculate CLV correctly when close is at high", () => {
    // Close = High → CLV = ((H-L) - 0) / (H-L) = 1
    const candles = makeCandles([{ high: 110, low: 90, close: 110, volume: 1000 }]);

    const result = adl(candles);
    // CLV = 1, MFV = 1 * 1000 = 1000
    expect(result[0].value).toBe(1000);
  });

  it("should calculate CLV correctly when close is at low", () => {
    // Close = Low → CLV = (0 - (H-L)) / (H-L) = -1
    const candles = makeCandles([{ high: 110, low: 90, close: 90, volume: 1000 }]);

    const result = adl(candles);
    // CLV = -1, MFV = -1 * 1000 = -1000
    expect(result[0].value).toBe(-1000);
  });

  it("should calculate CLV correctly when close is at midpoint", () => {
    // Close = midpoint → CLV = 0
    const candles = makeCandles([{ high: 110, low: 90, close: 100, volume: 1000 }]);

    const result = adl(candles);
    // CLV = 0, MFV = 0
    expect(result[0].value).toBe(0);
  });

  it("should handle zero range (high = low)", () => {
    const candles = makeCandles([{ high: 100, low: 100, close: 100, volume: 1000 }]);

    const result = adl(candles);
    // CLV = 0 (range is 0)
    expect(result[0].value).toBe(0);
  });

  it("should accumulate ADL over multiple bars", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 110, volume: 1000 }, // CLV=1, MFV=1000, ADL=1000
      { high: 110, low: 90, close: 110, volume: 2000 }, // CLV=1, MFV=2000, ADL=3000
      { high: 110, low: 90, close: 90, volume: 500 }, // CLV=-1, MFV=-500, ADL=2500
    ]);

    const result = adl(candles);
    expect(result[0].value).toBe(1000);
    expect(result[1].value).toBe(3000);
    expect(result[2].value).toBe(2500);
  });

  it("should show rising ADL for accumulation", () => {
    // Close consistently near high with rising volume
    const candles = makeCandles(
      Array.from({ length: 10 }, (_, i) => ({
        high: 110 + i,
        low: 90 + i,
        close: 108 + i, // Close near high
        volume: 1000 + i * 100,
      })),
    );

    const result = adl(candles);

    // ADL should be generally rising
    for (let i = 1; i < result.length; i++) {
      expect(result[i].value).toBeGreaterThan(result[i - 1].value);
    }
  });

  it("should show falling ADL for distribution", () => {
    // Close consistently near low
    const candles = makeCandles(
      Array.from({ length: 10 }, (_, i) => ({
        high: 110 - i,
        low: 90 - i,
        close: 92 - i, // Close near low
        volume: 1000 + i * 100,
      })),
    );

    const result = adl(candles);

    // ADL should be generally falling
    for (let i = 1; i < result.length; i++) {
      expect(result[i].value).toBeLessThan(result[i - 1].value);
    }
  });

  it("should calculate CLV formula correctly", () => {
    // CLV = ((close - low) - (high - close)) / (high - low)
    const candles = makeCandles([{ high: 120, low: 80, close: 110, volume: 1000 }]);

    const result = adl(candles);
    // CLV = ((110-80) - (120-110)) / (120-80) = (30 - 10) / 40 = 0.5
    // MFV = 0.5 * 1000 = 500
    expect(result[0].value).toBe(500);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([
      { high: 110, low: 90, close: 100, volume: 1000 },
      { high: 115, low: 95, close: 108, volume: 1500 },
    ]);
    const result = adl(candles);

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
  });

  it("should handle single candle", () => {
    const candles = makeCandles([{ high: 110, low: 90, close: 105, volume: 2000 }]);

    const result = adl(candles);
    expect(result.length).toBe(1);
    // CLV = ((105-90) - (110-105)) / (110-90) = (15-5)/20 = 0.5
    // MFV = 0.5 * 2000 = 1000
    expect(result[0].value).toBe(1000);
  });
});
