import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { hma } from "../moving-average/hma";

describe("hma", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 2", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => hma(candles, { period: 1 })).toThrow("HMA period must be at least 2");
  });

  it("should return empty for empty input", () => {
    expect(hma([], { period: 9 })).toEqual([]);
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = hma(candles, { period: 9 });
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should calculate HMA correctly with period 4", () => {
    // HMA(4): halfPeriod=2, sqrtPeriod=2
    // Step 1: WMA(2)
    // Step 2: WMA(4)
    // Step 3: diff = 2*WMA(2) - WMA(4)
    // Step 4: WMA(2) on diff
    const candles = makeCandles([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    const result = hma(candles, { period: 4 });

    expect(result).toHaveLength(11);
    // First several values should be null (need warmup for WMA(4) + WMA(sqrt(4)=2))
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeNull();

    // Later values should be non-null
    const nonNullValues = result.filter((r) => r.value !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);

    // HMA should be responsive — for a linear uptrend, later HMA values should increase
    const hmaValues = nonNullValues.map((r) => r.value as number);
    for (let i = 1; i < hmaValues.length; i++) {
      expect(hmaValues[i]).toBeGreaterThan(hmaValues[i - 1]);
    }
  });

  it("should have less lag than WMA in trending market", () => {
    // In a rising market, HMA should be closer to the current price than WMA
    const candles = makeCandles([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
    const result = hma(candles, { period: 4 });

    const lastHma = result[result.length - 1].value;
    expect(lastHma).not.toBeNull();
    // HMA should be closer to 30 than a simple WMA(4) would be
    expect(lastHma!).toBeGreaterThan(25);
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([100, 101, 102, 103, 104, 105]);
    const result = hma(candles, { period: 4 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    expect(() => hma(candles, { period: 9.5 })).toThrow("HMA period must be an integer");
  });
});
