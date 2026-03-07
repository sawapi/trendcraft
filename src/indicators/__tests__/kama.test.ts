import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { kama } from "../moving-average/kama";

describe("kama", () => {
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000,
      open: close,
      high: close,
      low: close,
      close,
      volume: 1000,
    }));

  it("should throw if period is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => kama(candles, { period: 0 })).toThrow("KAMA period must be at least 1");
  });

  it("should throw if fastPeriod is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => kama(candles, { fastPeriod: 0 })).toThrow(
      "KAMA fastPeriod must be at least 1",
    );
  });

  it("should throw if slowPeriod is less than 1", () => {
    const candles = makeCandles([100, 101, 102]);
    expect(() => kama(candles, { slowPeriod: 0 })).toThrow(
      "KAMA slowPeriod must be at least 1",
    );
  });

  it("should return null for insufficient data", () => {
    const candles = makeCandles([100, 101, 102]);
    const result = kama(candles, { period: 10 });

    result.forEach((r) => expect(r.value).toBeNull());
  });

  it("should start outputting values at index period", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    const candles = makeCandles(closes);
    const result = kama(candles, { period: 10 });

    // First 10 values (index 0-9) should be null
    for (let i = 0; i < 10; i++) {
      expect(result[i].value).toBeNull();
    }
    // Index 10 should have a value
    expect(result[10].value).not.toBeNull();
  });

  it("should track trending prices closely (high ER)", () => {
    // Strong uptrend: ER ≈ 1, KAMA should follow closely
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const candles = makeCandles(closes);
    const result = kama(candles, { period: 10 });

    const lastValue = result[result.length - 1].value!;
    const lastPrice = closes[closes.length - 1];

    // In a perfect trend, KAMA should be close to price
    expect(Math.abs(lastValue - lastPrice)).toBeLessThan(lastPrice * 0.05);
  });

  it("should be smoother in choppy markets (low ER)", () => {
    // Choppy: alternating up/down, ER ≈ 0
    const closes: number[] = [];
    for (let i = 0; i < 30; i++) {
      closes.push(100 + (i % 2 === 0 ? 5 : -5));
    }
    const candles = makeCandles(closes);
    const result = kama(candles, { period: 10 });

    // In choppy market, KAMA should barely move from seed
    const validValues = result.filter((r) => r.value !== null).map((r) => r.value!);
    const range = Math.max(...validValues) - Math.min(...validValues);
    expect(range).toBeLessThan(5);
  });

  it("should handle constant prices", () => {
    const candles = makeCandles(Array(20).fill(100));
    const result = kama(candles, { period: 10 });

    for (const r of result) {
      if (r.value !== null) {
        expect(r.value).toBeCloseTo(100, 10);
      }
    }
  });

  it("should handle empty array", () => {
    expect(kama([])).toEqual([]);
  });

  it("should preserve time values", () => {
    const candles = makeCandles(Array.from({ length: 15 }, (_, i) => 100 + i));
    const result = kama(candles, { period: 10 });

    for (let i = 0; i < candles.length; i++) {
      expect(result[i].time).toBe(candles[i].time);
    }
  });

  it("should seed with SMA of first period prices (TA-Lib compatible)", () => {
    // With period=10, KAMA seed should be SMA of first 10 prices
    const closes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const candles = makeCandles(closes);
    const result = kama(candles, { period: 10 });

    // SMA(0..9) = (10+20+30+40+50+60+70+80+90+100)/10 = 55
    // The seed is used internally at index 9, first output at index 10
    // At index 10, price=110, direction = |110 - 10| = 100
    // volatility = sum of |close[j] - close[j-1]| for j=1..10 = 10*10 = 100
    // ER = 100/100 = 1.0
    // fastSC = 2/3, slowSC = 2/31
    // SC = (1.0 * (2/3 - 2/31) + 2/31)^2 = (2/3)^2 = 4/9
    // KAMA = 55 + (4/9) * (110 - 55) = 55 + 24.444... = 79.444...
    expect(result[10].value).toBeCloseTo(79.4444, 2);
  });
});
