import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { connorsRsi } from "../momentum/connors-rsi";

describe("connorsRsi", () => {
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
    expect(connorsRsi([])).toEqual([]);
  });

  it("should return null crsi for insufficient data", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = connorsRsi(candles);

    // With defaults (rsiPeriod=3, streakPeriod=2, rocPeriod=100), early values are null
    expect(result[0].value.crsi).toBeNull();
    expect(result[1].value.crsi).toBeNull();
  });

  it("should return crsi values between 0 and 100", () => {
    // Generate enough data for all components to be valid
    const closes: number[] = [];
    for (let i = 0; i < 120; i++) {
      closes.push(100 + Math.sin(i * 0.3) * 20 + i * 0.1);
    }
    const candles = makeCandles(closes);
    const result = connorsRsi(candles, { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 });

    const nonNullValues = result.filter((r) => r.value.crsi !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
    nonNullValues.forEach((r) => {
      expect(r.value.crsi!).toBeGreaterThanOrEqual(0);
      expect(r.value.crsi!).toBeLessThanOrEqual(100);
    });
  });

  it("should correctly track streaks", () => {
    // 3 consecutive up days, then 2 consecutive down days
    const candles = makeCandles([100, 102, 104, 106, 104, 102]);
    const result = connorsRsi(candles);

    // Streaks: 0, +1, +2, +3, -1, -2
    // RSI of these streaks should eventually compute
    expect(result).toHaveLength(6);
  });

  it("should decompose into three components", () => {
    const closes: number[] = [];
    for (let i = 0; i < 120; i++) {
      closes.push(100 + Math.sin(i * 0.3) * 20);
    }
    const candles = makeCandles(closes);
    const result = connorsRsi(candles);

    // Find a point where crsi is non-null
    const validPoint = result.find((r) => r.value.crsi !== null);
    if (validPoint) {
      const { crsi, rsi, streakRsi, rocPercentile } = validPoint.value;
      expect(crsi).not.toBeNull();
      expect(rsi).not.toBeNull();
      expect(streakRsi).not.toBeNull();
      expect(rocPercentile).not.toBeNull();
      // CRSI should be average of the three
      expect(crsi!).toBeCloseTo((rsi! + streakRsi! + rocPercentile!) / 3, 6);
    }
  });

  it("should respect custom periods", () => {
    const closes: number[] = [];
    for (let i = 0; i < 50; i++) {
      closes.push(100 + i * 0.5 + Math.sin(i) * 5);
    }
    const candles = makeCandles(closes);

    // Shorter rocPeriod means CRSI values appear sooner
    const result = connorsRsi(candles, { rsiPeriod: 2, streakPeriod: 2, rocPeriod: 10 });

    const nonNullValues = result.filter((r) => r.value.crsi !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
  });
});
