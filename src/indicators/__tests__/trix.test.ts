import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { trix } from "../momentum/trix";

describe("trix", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => trix(candles, { period: 0 })).toThrow("TRIX period must be at least 1");
  });

  it("should throw if signal period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => trix(candles, { period: 5, signalPeriod: 0 })).toThrow(
      "TRIX signal period must be at least 1",
    );
  });

  it("should return empty for empty input", () => {
    expect(trix([])).toEqual([]);
  });

  it("should return null trix for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = trix(candles, { period: 5 });

    // With period=5, need 3 * (5-1) = 12 bars minimum for valid EMA3
    // First bar always null (no prev EMA3)
    result.forEach((r) => {
      expect(r.value.trix).toBeNull();
    });
  });

  it("should calculate TRIX values for sufficient data", () => {
    // Generate enough data for period=3
    const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
    const candles = makeCandles(prices);
    const result = trix(candles, { period: 3, signalPeriod: 3 });

    // Early values should be null
    expect(result[0].value.trix).toBeNull();

    // Later values should be valid numbers
    const validTrix = result.filter((r) => r.value.trix !== null);
    expect(validTrix.length).toBeGreaterThan(0);

    // TRIX values should be finite numbers
    for (const v of validTrix) {
      expect(Number.isFinite(v.value.trix!)).toBe(true);
    }
  });

  it("should calculate signal line after sufficient TRIX values", () => {
    const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);
    const candles = makeCandles(prices);
    const result = trix(candles, { period: 3, signalPeriod: 3 });

    // Signal should be null initially
    expect(result[0].value.signal).toBeNull();

    // Signal should eventually become valid
    const validSignal = result.filter((r) => r.value.signal !== null);
    expect(validSignal.length).toBeGreaterThan(0);
  });

  it("should show positive TRIX for consistently rising prices", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 100 + i * 2);
    const candles = makeCandles(prices);
    const result = trix(candles, { period: 3 });

    const validValues = result.filter((r) => r.value.trix !== null);
    // After warm-up, TRIX should be positive for rising trend
    const lateValues = validValues.slice(-10);
    for (const v of lateValues) {
      expect(v.value.trix!).toBeGreaterThan(0);
    }
  });

  it("should show negative TRIX for consistently falling prices", () => {
    const prices = Array.from({ length: 40 }, (_, i) => 200 - i * 2);
    const candles = makeCandles(prices);
    const result = trix(candles, { period: 3 });

    const validValues = result.filter((r) => r.value.trix !== null);
    const lateValues = validValues.slice(-10);
    for (const v of lateValues) {
      expect(v.value.trix!).toBeLessThan(0);
    }
  });

  it("should preserve time values", () => {
    const candles = makeCandles([100, 101, 102, 103, 104]);
    const result = trix(candles, { period: 2 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should use default period=15 and signalPeriod=9", () => {
    const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.1) * 20);
    const candles = makeCandles(prices);
    const result = trix(candles);

    expect(result.length).toBe(100);
    // With period=15, need ~45 bars for first valid TRIX
    const validTrix = result.filter((r) => r.value.trix !== null);
    expect(validTrix.length).toBeGreaterThan(0);
    expect(validTrix.length).toBeLessThan(100);
  });
});
