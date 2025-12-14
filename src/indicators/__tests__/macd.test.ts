import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { macd } from "../momentum/macd";

describe("macd", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should throw if fast period >= slow period", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => macd(candles, { fastPeriod: 26, slowPeriod: 12 })).toThrow();
  });

  it("should throw if periods are less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => macd(candles, { fastPeriod: 0 })).toThrow();
  });

  it("should return empty array for empty input", () => {
    expect(macd([])).toEqual([]);
  });

  it("should return null values for insufficient data", () => {
    const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
    const result = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

    // All should be null since we need at least 26 candles for slow EMA
    result.forEach((r) => {
      expect(r.value.macd).toBeNull();
    });
  });

  it("should calculate MACD correctly", () => {
    // Create enough data for MACD calculation
    const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.5) * 10);
    const candles = makeCandles(closes);
    const result = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

    expect(result).toHaveLength(50);

    // After enough data, MACD values should be calculated
    const lastValue = result[result.length - 1].value;
    expect(lastValue.macd).not.toBeNull();
    expect(lastValue.signal).not.toBeNull();
    expect(lastValue.histogram).not.toBeNull();

    // Histogram should equal MACD - Signal
    if (lastValue.macd !== null && lastValue.signal !== null && lastValue.histogram !== null) {
      expect(lastValue.histogram).toBeCloseTo(lastValue.macd - lastValue.signal, 10);
    }
  });

  it("should use default periods (12, 26, 9)", () => {
    const closes = Array.from({ length: 50 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);

    const resultDefault = macd(candles);
    const resultExplicit = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });

    expect(resultDefault).toEqual(resultExplicit);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 30 }, (_, i) => 100 + i));
    const result = macd(candles);

    expect(result[0].time).toBe(candles[0].time);
    expect(result[29].time).toBe(candles[29].time);
  });
});
