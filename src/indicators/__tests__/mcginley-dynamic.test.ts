import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { mcginleyDynamic } from "../moving-average/mcginley-dynamic";

describe("mcginleyDynamic", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    }));

  it("should return empty for empty input", () => {
    expect(mcginleyDynamic([])).toEqual([]);
  });

  it("should throw if period < 1", () => {
    const candles = makeCandles([100]);
    expect(() => mcginleyDynamic(candles, { period: 0 })).toThrow();
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = mcginleyDynamic(candles, { period: 14 });
    expect(result).toHaveLength(3);
    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should seed with SMA", () => {
    const candles = makeCandles([10, 12, 14, 16, 18]);
    const result = mcginleyDynamic(candles, { period: 3 });

    // First non-null at index 2: SMA(3) = (10+12+14)/3 = 12
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBeCloseTo(12, 5);
  });

  it("should track price in uptrend", () => {
    const closes: number[] = [];
    for (let i = 0; i < 30; i++) {
      closes.push(100 + i * 2);
    }
    const candles = makeCandles(closes);
    const result = mcginleyDynamic(candles, { period: 10 });

    // MD should follow and approach price
    const nonNull = result.filter((r) => r.value !== null);
    expect(nonNull.length).toBeGreaterThan(0);

    // Last MD should be less than current price but trending up
    const lastMd = result[result.length - 1].value!;
    expect(lastMd).toBeGreaterThan(100);
    expect(lastMd).toBeLessThan(closes[closes.length - 1]);
  });

  it("should preserve timestamps", () => {
    const candles = makeCandles([100, 101, 102, 103, 104, 105, 106, 107, 108, 109]);
    const result = mcginleyDynamic(candles, { period: 5 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should throw on non-integer period", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => mcginleyDynamic(candles, { period: 14.5 })).toThrow(
      "McGinley Dynamic period must be an integer",
    );
  });
});
