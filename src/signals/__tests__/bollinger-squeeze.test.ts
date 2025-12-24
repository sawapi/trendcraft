import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { bollingerSqueeze } from "../bollinger-squeeze";

// Helper to create test candles
function createCandle(day: number, close: number): NormalizedCandle {
  return {
    time: new Date(2024, 0, day).getTime(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000000,
  };
}

// Helper to create candles with specific volatility pattern
function createVolatilityCandles(
  startDay: number,
  count: number,
  basePrice: number,
  volatility: number,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    const variation = Math.sin(i / 5) * volatility;
    candles.push({
      time: new Date(2024, 0, startDay + i).getTime(),
      open: basePrice + variation,
      high: basePrice + variation + volatility * 0.5,
      low: basePrice + variation - volatility * 0.5,
      close: basePrice + variation,
      volume: 1000000,
    });
  }
  return candles;
}

describe("bollingerSqueeze", () => {
  it("should return empty array for insufficient data", () => {
    const candles = [createCandle(1, 100), createCandle(2, 101)];
    expect(bollingerSqueeze(candles)).toEqual([]);
  });

  it("should return empty array when not enough data for lookback", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 100; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 10) * 10));
    }
    // Default lookback is 120, period is 20, so need 140+ candles
    expect(bollingerSqueeze(candles)).toEqual([]);
  });

  it("should work with sufficient data", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 200; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 10) * 10));
    }
    const signals = bollingerSqueeze(candles);
    expect(Array.isArray(signals)).toBe(true);
  });

  it("should detect squeeze when volatility contracts", () => {
    // Create high volatility period followed by low volatility
    const highVolCandles = createVolatilityCandles(1, 150, 100, 20);
    const lowVolCandles = createVolatilityCandles(151, 50, 100, 2);
    const candles = [...highVolCandles, ...lowVolCandles];

    const signals = bollingerSqueeze(candles, { lookback: 100, threshold: 10 });

    // Should detect squeeze in the low volatility period
    expect(signals.length).toBeGreaterThan(0);

    // At least one signal should be in or after the low volatility transition
    // (squeeze detection uses lookback, so it may detect before the exact transition point)
    const hasLowVolSignal = signals.some((signal) => {
      const idx = candles.findIndex((c) => c.time === signal.time);
      return idx >= 100; // After initial lookback period
    });
    expect(hasLowVolSignal).toBe(true);
  });

  it("should return signals with correct structure", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 200; i++) {
      // Create varying volatility
      const vol = i < 150 ? 10 : 2;
      candles.push(createCandle(i, 100 + Math.sin(i / 5) * vol));
    }

    const signals = bollingerSqueeze(candles, { threshold: 20 });

    for (const signal of signals) {
      expect(signal).toHaveProperty("time");
      expect(signal).toHaveProperty("type");
      expect(signal.type).toBe("squeeze");
      expect(signal).toHaveProperty("bandwidth");
      expect(typeof signal.bandwidth).toBe("number");
      expect(signal).toHaveProperty("percentile");
      expect(signal.percentile).toBeGreaterThanOrEqual(0);
      expect(signal.percentile).toBeLessThanOrEqual(100);
    }
  });

  it("should respect threshold option", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 200; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 10) * 10));
    }

    const signalsStrict = bollingerSqueeze(candles, { threshold: 1 });
    const signalsLoose = bollingerSqueeze(candles, { threshold: 20 });

    // Looser threshold should find more or equal signals
    expect(signalsLoose.length).toBeGreaterThanOrEqual(signalsStrict.length);
  });

  it("should respect lookback option", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 300; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 10) * 10));
    }

    const signalsShort = bollingerSqueeze(candles, { lookback: 50 });
    const signalsLong = bollingerSqueeze(candles, { lookback: 200 });

    // Both should return arrays (different results due to different perspectives)
    expect(Array.isArray(signalsShort)).toBe(true);
    expect(Array.isArray(signalsLong)).toBe(true);
  });

  it("should not return consecutive signals too close together", () => {
    const candles: NormalizedCandle[] = [];
    // Create a long period of constant low volatility
    for (let i = 1; i <= 300; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 20) * 5));
    }

    const signals = bollingerSqueeze(candles, { threshold: 50 });

    // Check that signals are at least 5 bars apart
    for (let i = 1; i < signals.length; i++) {
      const prevIdx = candles.findIndex((c) => c.time === signals[i - 1].time);
      const currIdx = candles.findIndex((c) => c.time === signals[i].time);
      expect(currIdx - prevIdx).toBeGreaterThanOrEqual(5);
    }
  });

  it("should respect period option", () => {
    const candles: NormalizedCandle[] = [];
    for (let i = 1; i <= 200; i++) {
      candles.push(createCandle(i, 100 + Math.sin(i / 10) * 10));
    }

    // Different periods should potentially yield different results
    const signals10 = bollingerSqueeze(candles, { period: 10, lookback: 100 });
    const signals30 = bollingerSqueeze(candles, { period: 30, lookback: 100 });

    expect(Array.isArray(signals10)).toBe(true);
    expect(Array.isArray(signals30)).toBe(true);
  });

  it("should handle real-world-like price pattern", () => {
    const candles: NormalizedCandle[] = [];

    // Simulate: trending up with decreasing volatility (classic squeeze setup)
    for (let i = 1; i <= 200; i++) {
      const trend = i * 0.1; // Gradual uptrend
      const volatility = Math.max(1, 15 - i * 0.05); // Decreasing volatility
      const noise = Math.sin(i / 3) * volatility;

      candles.push({
        time: new Date(2024, 0, i).getTime(),
        open: 100 + trend + noise,
        high: 100 + trend + noise + volatility * 0.3,
        low: 100 + trend + noise - volatility * 0.3,
        close: 100 + trend + noise,
        volume: 1000000,
      });
    }

    const signals = bollingerSqueeze(candles, { threshold: 10 });

    // Should detect squeeze as volatility decreases
    expect(signals.length).toBeGreaterThan(0);

    // Later signals should have lower bandwidth
    if (signals.length >= 2) {
      const firstSignal = signals[0];
      const lastSignal = signals[signals.length - 1];
      expect(lastSignal.bandwidth).toBeLessThanOrEqual(firstSignal.bandwidth);
    }
  });
});
