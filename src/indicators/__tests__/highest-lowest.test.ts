import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { highest, highestLowest, lowest } from "../price/highest-lowest";

describe("highestLowest", () => {
  const makeCandles = (data: [number, number][]): NormalizedCandle[] =>
    data.map(([high, low], i) => ({
      time: 1700000000000 + i * 86400000,
      open: (high + low) / 2,
      high,
      low,
      close: (high + low) / 2,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([[110, 90]]);
    expect(() => highestLowest(candles, { period: 0 })).toThrow();
  });

  it("should return null values for insufficient data", () => {
    const candles = makeCandles([
      [110, 90],
      [115, 95],
    ]);
    const result = highestLowest(candles, { period: 5 });

    result.forEach((r) => {
      expect(r.value.highest).toBeNull();
      expect(r.value.lowest).toBeNull();
    });
  });

  it("should calculate highest and lowest correctly", () => {
    const candles = makeCandles([
      [110, 90],
      [120, 100],
      [115, 95],
      [125, 105],
      [118, 98],
    ]);
    const result = highestLowest(candles, { period: 3 });

    // First 2 values should be null
    expect(result[0].value.highest).toBeNull();
    expect(result[1].value.highest).toBeNull();

    // Third value: highest of [110, 120, 115] = 120, lowest of [90, 100, 95] = 90
    expect(result[2].value.highest).toBe(120);
    expect(result[2].value.lowest).toBe(90);

    // Fourth value: highest of [120, 115, 125] = 125, lowest of [100, 95, 105] = 95
    expect(result[3].value.highest).toBe(125);
    expect(result[3].value.lowest).toBe(95);
  });
});

describe("highest", () => {
  const makeCandles = (highs: number[]): NormalizedCandle[] =>
    highs.map((high, i) => ({
      time: 1700000000000 + i * 86400000,
      open: high - 5,
      high,
      low: high - 10,
      close: high - 3,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([110, 120]);
    expect(() => highest(candles, 0)).toThrow();
  });

  it("should calculate highest high correctly", () => {
    const candles = makeCandles([100, 120, 110, 130, 115]);
    const result = highest(candles, 3);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(120); // max(100, 120, 110)
    expect(result[3].value).toBe(130); // max(120, 110, 130)
    expect(result[4].value).toBe(130); // max(110, 130, 115)
  });
});

describe("lowest", () => {
  const makeCandles = (lows: number[]): NormalizedCandle[] =>
    lows.map((low, i) => ({
      time: 1700000000000 + i * 86400000,
      open: low + 5,
      high: low + 10,
      low,
      close: low + 3,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([90, 100]);
    expect(() => lowest(candles, 0)).toThrow();
  });

  it("should calculate lowest low correctly", () => {
    const candles = makeCandles([100, 80, 90, 70, 85]);
    const result = lowest(candles, 3);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(80); // min(100, 80, 90)
    expect(result[3].value).toBe(70); // min(80, 90, 70)
    expect(result[4].value).toBe(70); // min(90, 70, 85)
  });
});
