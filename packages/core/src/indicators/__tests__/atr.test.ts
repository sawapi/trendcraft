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
    // TR skips index 0 (requires previous close), starts at index 1
    const candles = makeCandles([
      [100, 110, 90, 105], // index 0: TR skipped
      [105, 115, 95, 110], // index 1: TR = max(20, |115-105|, |95-105|) = 20
      [110, 120, 100, 115], // index 2: TR = 20
      [115, 125, 105, 120], // index 3: TR = 20 → first ATR = SMA(TR[1..3]) = 20
      [120, 130, 110, 125], // index 4: TR = 20 → Wilder's smoothed
    ]);
    const result = atr(candles, { period: 3 });

    // First 3 values should be null (indices 0..period-1)
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();

    // Index 3: first ATR = SMA of TR[1..3] = 20
    expect(result[3].value).toBeCloseTo(20, 1);
  });

  it("should apply Wilder smoothing after initial period", () => {
    const candles = makeCandles([
      [100, 110, 90, 105], // index 0: TR skipped
      [105, 115, 95, 110], // index 1: TR = 20
      [110, 120, 100, 115], // index 2: TR = 20
      [115, 125, 105, 120], // index 3: TR = 20, first ATR = 20
      [120, 140, 110, 135], // index 4: TR = 30, Wilder's smoothed
    ]);
    const result = atr(candles, { period: 3 });

    // ATR at index 4 should smooth toward the new TR
    expect(result[4].value).toBeGreaterThan(20);
    expect(result[4].value).toBeLessThan(30);
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
      [100, 110, 90, 105], // index 0: TR skipped
      [120, 125, 115, 122], // index 1: TR = max(10, |125-105|, |115-105|) = 20
    ]);
    const result = atr(candles, { period: 1 });

    // index 0 is null (period=1, first ATR at index 1)
    expect(result[0].value).toBeNull();
    // TR for second candle should include gap
    expect(result[1].value).toBe(20);
  });
});
