import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { atr } from "../volatility/atr";

describe("atr", () => {
  const makeCandles = (data: [number, number, number, number][]): NormalizedCandle[] =>
    data.map(([open, high, low, close], i) => ({
      time: 1700000000000 + i * 86400000,
      open,
      high,
      low,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([[100, 110, 90, 105]]);
    expect(() => atr(candles, { period: 0 })).toThrow();
  });

  it("should return empty array for empty input", () => {
    expect(atr([])).toEqual([]);
  });

  it("should return null values for insufficient data", () => {
    const candles = makeCandles([
      [100, 110, 90, 105],
      [105, 115, 95, 110],
    ]);
    const result = atr(candles, { period: 14 });

    result.forEach((r) => {
      expect(r.value).toBeNull();
    });
  });

  it("should calculate ATR correctly", () => {
    // Create candles with known volatility
    const candles = makeCandles([
      [100, 110, 90, 105], // TR = 20 (high - low)
      [105, 115, 95, 110], // TR = max(20, |115-105|, |95-105|) = 20
      [110, 120, 100, 115], // TR = 20
      [115, 125, 105, 120], // TR = 20
    ]);
    const result = atr(candles, { period: 3 });

    // First 2 values should be null
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();

    // Third value should be simple average of first 3 TRs
    // All TRs are 20, so ATR should be 20
    expect(result[2].value).toBeCloseTo(20, 1);
  });

  it("should apply Wilder smoothing after initial period", () => {
    const candles = makeCandles([
      [100, 110, 90, 105],
      [105, 115, 95, 110],
      [110, 120, 100, 115],
      [115, 135, 105, 130], // High volatility candle, TR = 30
    ]);
    const result = atr(candles, { period: 3 });

    // ATR should smooth toward the new TR
    expect(result[3].value).toBeGreaterThan(20);
    expect(result[3].value).toBeLessThan(30);
  });

  it("should use default period of 14", () => {
    const data: [number, number, number, number][] = Array.from({ length: 20 }, (_, i) => [
      100 + i,
      110 + i,
      90 + i,
      105 + i,
    ]);
    const candles = makeCandles(data);

    const resultDefault = atr(candles);
    const resultExplicit = atr(candles, { period: 14 });

    expect(resultDefault).toEqual(resultExplicit);
  });

  it("should consider gap up/down in true range", () => {
    const candles = makeCandles([
      [100, 110, 90, 105],
      [120, 125, 115, 122], // Gap up: previous close = 105, current low = 115
    ]);
    const result = atr(candles, { period: 1 });

    // TR for second candle should include gap
    // TR = max(125-115, |125-105|, |115-105|) = max(10, 20, 10) = 20
    expect(result[1].value).toBe(20);
  });
});
