import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { roofingFilter } from "../filter/roofing-filter";

describe("roofingFilter", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should handle empty array", () => {
    expect(roofingFilter([])).toEqual([]);
  });

  it("should throw if highPassPeriod is less than 1", () => {
    const candles = makeCandles([100]);
    expect(() => roofingFilter(candles, { highPassPeriod: 0 })).toThrow(
      "Roofing filter highPassPeriod must be at least 1",
    );
  });

  it("should throw if lowPassPeriod is less than 1", () => {
    const candles = makeCandles([100]);
    expect(() => roofingFilter(candles, { lowPassPeriod: 0 })).toThrow(
      "Roofing filter lowPassPeriod must be at least 1",
    );
  });

  it("should return null for first 2 bars", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = roofingFilter(candles);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).not.toBeNull();
  });

  it("should oscillate near zero for linear trend", () => {
    // Linear trend: 100, 101, 102, ..., 149
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles = makeCandles(prices);

    const result = roofingFilter(candles);

    // After warmup, values should stay near zero (trend removed by high-pass)
    const lateValues = result.slice(20).map((r) => r.value as number);
    for (const v of lateValues) {
      expect(Math.abs(v)).toBeLessThan(5);
    }
  });

  it("should converge to zero for constant input", () => {
    const candles = makeCandles(Array(50).fill(100));
    const result = roofingFilter(candles);

    // Constant input has no cycle, should converge to 0
    const last = result[result.length - 1].value as number;
    expect(Math.abs(last)).toBeLessThan(0.01);
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = roofingFilter(candles);

    expect(result[0].time).toBe(candles[0].time);
    expect(result[1].time).toBe(candles[1].time);
    expect(result[2].time).toBe(candles[2].time);
  });

  it("should detect cyclic components", () => {
    // Create a sine wave with period 20 on top of a trend
    const prices = Array.from(
      { length: 60 },
      (_, i) => 100 + i * 0.5 + 10 * Math.sin((2 * Math.PI * i) / 20),
    );
    const candles = makeCandles(prices);

    const result = roofingFilter(candles);

    // The output should show oscillation (not flat zero)
    const lateValues = result.slice(20).map((r) => r.value as number);
    const maxAbs = Math.max(...lateValues.map(Math.abs));
    expect(maxAbs).toBeGreaterThan(1);
  });
});
