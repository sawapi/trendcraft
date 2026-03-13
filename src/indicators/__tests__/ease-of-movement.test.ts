import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { easeOfMovement } from "../volume/ease-of-movement";

describe("easeOfMovement", () => {
  const makeCandles = (data: { high: number; low: number; volume: number }[]): NormalizedCandle[] =>
    data.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: (d.high + d.low) / 2,
      high: d.high,
      low: d.low,
      close: (d.high + d.low) / 2,
      volume: d.volume,
    }));

  it("should return empty for empty input", () => {
    expect(easeOfMovement([])).toEqual([]);
  });

  it("should throw if period < 1", () => {
    const candles = makeCandles([{ high: 101, low: 99, volume: 1000 }]);
    expect(() => easeOfMovement(candles, { period: 0 })).toThrow();
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([
      { high: 101, low: 99, volume: 10000 },
      { high: 102, low: 100, volume: 10000 },
      { high: 103, low: 101, volume: 10000 },
    ]);
    const result = easeOfMovement(candles, { period: 14 });
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should handle H==L (null for that bar)", () => {
    const data: { high: number; low: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      if (i === 5) {
        data.push({ high: 100, low: 100, volume: 10000 }); // H==L
      } else {
        data.push({ high: 101 + i, low: 99 + i, volume: 10000 });
      }
    }
    const candles = makeCandles(data);
    const result = easeOfMovement(candles, { period: 3 });
    // Should not crash, and some values may be null due to H==L in window
    expect(result).toHaveLength(20);
  });

  it("should produce values for enough data with small period", () => {
    const data: { high: number; low: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ high: 102 + i, low: 98 + i, volume: 50000 });
    }
    const candles = makeCandles(data);
    const result = easeOfMovement(candles, { period: 3 });

    // From index 3 onwards should have non-null values
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);

    // Uptrend should produce positive EMV
    const lastValue = result[result.length - 1].value;
    expect(lastValue).not.toBeNull();
    expect(lastValue!).toBeGreaterThan(0);
  });

  it("should preserve timestamps", () => {
    const data: { high: number; low: number; volume: number }[] = [];
    for (let i = 0; i < 20; i++) {
      data.push({ high: 102 + i, low: 98 + i, volume: 50000 });
    }
    const candles = makeCandles(data);
    const result = easeOfMovement(candles, { period: 3 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });
});
