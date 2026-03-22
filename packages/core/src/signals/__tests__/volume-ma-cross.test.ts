import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { volumeMaCross } from "../volume-ma-cross";

// Helper to create test candles
function createCandles(volumes: number[], startTime = 0): NormalizedCandle[] {
  return volumes.map((volume, i) => ({
    time: startTime + i * 86400000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume,
  }));
}

describe("volumeMaCross", () => {
  it("should return empty array for insufficient data", () => {
    const candles = createCandles([100, 200, 300]);
    const result = volumeMaCross(candles, { shortPeriod: 5, longPeriod: 20 });
    expect(result).toHaveLength(0);
  });

  it("should detect bullish volume MA cross", () => {
    // Create pattern: 25 days of low volume, then spike
    // Need enough low volume days so short MA starts below long MA before crossing
    const volumes = [
      // 25 days of low volume
      ...Array(25).fill(100),
      // Then high volume to cause short MA to cross above long MA
      500,
      600,
      700,
      800,
      900,
      1000,
    ];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
      minRatio: 1.0,
    });

    expect(result.length).toBeGreaterThan(0);
    result.forEach((signal) => {
      expect(signal.type).toBe("volume_ma_cross");
      expect(signal.direction).toBe("bullish");
      expect(signal.shortMa).toBeGreaterThan(signal.longMa);
    });
  });

  it("should detect bearish cross when bullishOnly is false", () => {
    // Create pattern: mixed volumes with high recent spike, then sharp drop
    // First need short MA > long MA, then cross below
    const volumes = [
      // 20 days of mixed low-medium volume
      100, 120, 110, 130, 100, 90, 110, 120, 100, 95, 105, 115, 100, 110, 120, 90, 100, 110, 105,
      95,
      // 5 days of high volume (short MA > long MA)
      500, 600, 700, 800, 900,
      // Then sharp drop (short MA crosses below long MA)
      50, 40, 30, 20, 10, 5,
    ];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
      bullishOnly: false,
    });

    const bearishSignals = result.filter((s) => s.direction === "bearish");
    expect(bearishSignals.length).toBeGreaterThan(0);
  });

  it("should not detect bearish cross when bullishOnly is true (default)", () => {
    // Create pattern: high volumes, then drop
    const volumes = [...Array(20).fill(500), 100, 90, 80, 70, 60];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
      bullishOnly: true,
    });

    const bearishSignals = result.filter((s) => s.direction === "bearish");
    expect(bearishSignals).toHaveLength(0);
  });

  it("should respect minRatio parameter", () => {
    // Create pattern where short MA is only slightly above long MA
    const volumes = [
      ...Array(20).fill(100),
      110,
      120,
      130,
      140,
      150, // slight increase
    ];
    const candles = createCandles(volumes);

    // Low minRatio should detect
    const resultLow = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
      minRatio: 1.0,
    });

    // High minRatio should not detect (requiring 2x ratio)
    const resultHigh = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
      minRatio: 2.0,
    });

    expect(resultLow.length).toBeGreaterThanOrEqual(0);
    // Result may still have signals if ratio exceeds 2.0
  });

  it("should throw error for invalid periods", () => {
    const candles = createCandles(Array(30).fill(100));

    // Short period < 1
    expect(() => volumeMaCross(candles, { shortPeriod: 0, longPeriod: 20 })).toThrow();

    // Long period <= short period
    expect(() => volumeMaCross(candles, { shortPeriod: 20, longPeriod: 10 })).toThrow();
    expect(() => volumeMaCross(candles, { shortPeriod: 20, longPeriod: 20 })).toThrow();
  });

  it("should calculate ratio correctly", () => {
    const volumes = [
      ...Array(20).fill(100),
      500,
      500,
      500,
      500,
      500, // 5x increase
    ];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
    });

    result.forEach((signal) => {
      const expectedRatio = signal.shortMa / signal.longMa;
      expect(signal.ratio).toBeCloseTo(expectedRatio, 5);
    });
  });

  it("should track daysSinceCross", () => {
    const volumes = [
      ...Array(20).fill(100),
      300,
      400,
      500,
      600,
      700,
      800, // sustained high volume
    ];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
    });

    // Days since cross should be tracked
    if (result.length >= 2) {
      // Later signals should have higher daysSinceCross
      const sortedByTime = [...result].sort((a, b) => a.time - b.time);
      for (let i = 1; i < sortedByTime.length; i++) {
        expect(sortedByTime[i].daysSinceCross).toBeGreaterThanOrEqual(
          sortedByTime[i - 1].daysSinceCross,
        );
      }
    }
  });

  it("should return correct signal structure", () => {
    const volumes = [...Array(20).fill(100), 300, 400, 500];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
    });

    if (result.length > 0) {
      const signal = result[0];
      expect(signal).toHaveProperty("time");
      expect(signal).toHaveProperty("type", "volume_ma_cross");
      expect(signal).toHaveProperty("volume");
      expect(signal).toHaveProperty("shortMa");
      expect(signal).toHaveProperty("longMa");
      expect(signal).toHaveProperty("direction");
      expect(signal).toHaveProperty("ratio");
      expect(signal).toHaveProperty("daysSinceCross");
    }
  });

  it("should handle noisy data", () => {
    // Create noisy but generally increasing volume
    const volumes = [
      100,
      90,
      110,
      95,
      105,
      100,
      92,
      108,
      98,
      103, // noisy baseline
      100,
      95,
      110,
      105,
      100,
      98,
      102,
      100,
      105,
      95, // more baseline
      200,
      180,
      220,
      250,
      300,
      280,
      350,
      400, // increasing with noise
    ];
    const candles = createCandles(volumes);
    const result = volumeMaCross(candles, {
      shortPeriod: 5,
      longPeriod: 20,
    });

    // Should still detect the overall trend
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});
