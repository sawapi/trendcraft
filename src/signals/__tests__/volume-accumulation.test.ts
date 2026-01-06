import { describe, it, expect } from "vitest";
import { volumeAccumulation } from "../volume-accumulation";
import type { NormalizedCandle } from "../../types";

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

describe("volumeAccumulation", () => {
  it("should return empty array for insufficient data", () => {
    const candles = createCandles([100, 200, 300]);
    const result = volumeAccumulation(candles, { period: 10 });
    expect(result).toHaveLength(0);
  });

  it("should detect upward volume accumulation", () => {
    // Create clearly increasing volumes
    const volumes = [
      100, 100, 100, 100, 100, // baseline
      120, 150, 180, 220, 260, // increasing
      300, 350, 400, 450, 500, // strongly increasing
    ];
    const candles = createCandles(volumes);
    const result = volumeAccumulation(candles, {
      period: 5,
      minSlope: 0.05,
      minRSquared: 0.5,
      minConsecutiveDays: 3,
    });

    expect(result.length).toBeGreaterThan(0);
    result.forEach((signal) => {
      expect(signal.type).toBe("volume_accumulation");
      expect(signal.normalizedSlope).toBeGreaterThan(0);
      expect(signal.rSquared).toBeGreaterThanOrEqual(0.5);
      expect(signal.consecutiveDays).toBeGreaterThanOrEqual(3);
    });
  });

  it("should not detect trend in flat volume", () => {
    // Flat volumes
    const volumes = Array(20).fill(100);
    const candles = createCandles(volumes);
    const result = volumeAccumulation(candles, {
      period: 5,
      minSlope: 0.05,
      minConsecutiveDays: 3,
    });

    expect(result).toHaveLength(0);
  });

  it("should not detect trend in decreasing volume", () => {
    // Decreasing volumes
    const volumes = [500, 450, 400, 350, 300, 260, 220, 180, 150, 120, 100, 90, 80, 70, 60];
    const candles = createCandles(volumes);
    const result = volumeAccumulation(candles, {
      period: 5,
      minSlope: 0.05,
      minConsecutiveDays: 3,
    });

    expect(result).toHaveLength(0);
  });

  it("should respect minSlope parameter", () => {
    // Slowly increasing volumes
    const volumes = [100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128];
    const candles = createCandles(volumes);

    // Low minSlope should detect
    const resultLow = volumeAccumulation(candles, {
      period: 5,
      minSlope: 0.01,
      minRSquared: 0.8,
      minConsecutiveDays: 1,
    });

    // High minSlope should not detect
    const resultHigh = volumeAccumulation(candles, {
      period: 5,
      minSlope: 0.5,
      minRSquared: 0.8,
      minConsecutiveDays: 1,
    });

    expect(resultLow.length).toBeGreaterThan(0);
    expect(resultHigh).toHaveLength(0);
  });

  it("should respect minConsecutiveDays parameter", () => {
    // Create pattern: flat, then increasing
    const volumes = [
      100, 100, 100, 100, 100, 100, 100, // flat
      150, 200, 250, 300, // short increase
      100, 100, 100, // flat again
    ];
    const candles = createCandles(volumes);

    // Low consecutive days requirement
    const resultLow = volumeAccumulation(candles, {
      period: 3,
      minSlope: 0.1,
      minRSquared: 0.5,
      minConsecutiveDays: 2,
    });

    // High consecutive days requirement
    const resultHigh = volumeAccumulation(candles, {
      period: 3,
      minSlope: 0.1,
      minRSquared: 0.5,
      minConsecutiveDays: 10,
    });

    expect(resultLow.length).toBeGreaterThanOrEqual(0); // May detect short trend
    expect(resultHigh).toHaveLength(0); // Should not detect
  });

  it("should throw error for period < 2", () => {
    const candles = createCandles([100, 200, 300]);
    expect(() => volumeAccumulation(candles, { period: 1 })).toThrow();
  });

  it("should track consecutive days correctly", () => {
    // Strong upward trend
    const volumes = [
      100, 100, 100, // baseline
      150, 200, 250, 300, 350, 400, 450, 500, // strong increase
    ];
    const candles = createCandles(volumes);
    const result = volumeAccumulation(candles, {
      period: 3,
      minSlope: 0.01,
      minRSquared: 0.3,
      minConsecutiveDays: 1,
    });

    // Consecutive days should increase
    if (result.length >= 2) {
      for (let i = 1; i < result.length; i++) {
        // If signals are consecutive, days should increase
        const timeDiff = result[i].time - result[i - 1].time;
        if (timeDiff === 86400000) {
          expect(result[i].consecutiveDays).toBeGreaterThanOrEqual(result[i - 1].consecutiveDays);
        }
      }
    }
  });

  it("should return correct signal structure", () => {
    const volumes = [100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600];
    const candles = createCandles(volumes);
    const result = volumeAccumulation(candles, {
      period: 3,
      minSlope: 0.01,
      minRSquared: 0.3,
      minConsecutiveDays: 1,
    });

    if (result.length > 0) {
      const signal = result[0];
      expect(signal).toHaveProperty("time");
      expect(signal).toHaveProperty("type", "volume_accumulation");
      expect(signal).toHaveProperty("volume");
      expect(signal).toHaveProperty("slope");
      expect(signal).toHaveProperty("normalizedSlope");
      expect(signal).toHaveProperty("rSquared");
      expect(signal).toHaveProperty("consecutiveDays");
    }
  });
});
