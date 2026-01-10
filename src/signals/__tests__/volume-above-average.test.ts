import { describe, expect, it } from "vitest";
import { volumeAboveAverage } from "../volume-above-average";
import type { NormalizedCandle } from "../../types";

/**
 * Generate candles with consistent high volume (above average)
 */
function generateHighVolumeCandles(count: number, ratio: number = 1.5): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const baseVolume = 1000000;

  for (let i = 0; i < count; i++) {
    // First half: normal volume, second half: high volume
    const isHighVolume = i >= count / 2;
    const volume = isHighVolume ? baseVolume * ratio : baseVolume;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume,
    });
  }

  return candles;
}

/**
 * Generate candles with alternating volume (not sustained)
 */
function generateAlternatingVolumeCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const baseVolume = 1000000;

  for (let i = 0; i < count; i++) {
    // Alternating high and low volume
    const volume = i % 2 === 0 ? baseVolume * 2 : baseVolume * 0.5;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume,
    });
  }

  return candles;
}

/**
 * Generate candles with gradually increasing then sustained high volume
 */
function generateSustainedHighVolumeCandles(
  count: number,
  sustainedDays: number,
  ratio: number = 1.2
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const baseVolume = 1000000;

  for (let i = 0; i < count; i++) {
    // Last sustainedDays have high volume
    const isHighVolume = i >= count - sustainedDays;
    const volume = isHighVolume ? baseVolume * ratio : baseVolume;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      volume,
    });
  }

  return candles;
}

describe("volumeAboveAverage", () => {
  describe("basic detection", () => {
    it("should detect sustained high volume above average", () => {
      // 40 candles: first 20 normal, last 20 at 1.5x volume
      const candles = generateHighVolumeCandles(40, 1.5);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      expect(signals.length).toBeGreaterThan(0);
      // All signals should be from the high volume period
      signals.forEach((s) => {
        expect(s.ratio).toBeGreaterThanOrEqual(1.0);
        expect(s.consecutiveDays).toBeGreaterThanOrEqual(3);
      });
    });

    it("should not detect when volume alternates", () => {
      const candles = generateAlternatingVolumeCandles(50);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      // No consecutive days of high volume
      expect(signals.length).toBe(0);
    });

    it("should require minimum consecutive days", () => {
      // 30 candles with only 2 days of high volume at the end
      const candles = generateSustainedHighVolumeCandles(30, 2, 1.5);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.3, // Higher threshold to avoid false positives
        minConsecutiveDays: 5,
      });

      // Should not detect because only 2 consecutive days above threshold
      expect(signals.length).toBe(0);
    });

    it("should detect when meeting minimum consecutive days", () => {
      // 30 candles with 5 days of high volume at the end
      const candles = generateSustainedHighVolumeCandles(30, 5, 1.5);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      expect(signals.length).toBeGreaterThan(0);
    });
  });

  describe("minRatio threshold", () => {
    it("should respect minRatio parameter", () => {
      // Generate candles with 1.2x volume
      const candles = generateSustainedHighVolumeCandles(40, 10, 1.2);

      // Should detect with minRatio 1.0
      const signals1 = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });
      expect(signals1.length).toBeGreaterThan(0);

      // Should not detect with minRatio 1.5
      const signals2 = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.5,
        minConsecutiveDays: 3,
      });
      expect(signals2.length).toBe(0);
    });

    it("should calculate correct ratio values", () => {
      // Create candles where we can calculate expected ratio
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const baseVolume = 1000000;

      for (let i = 0; i < 30; i++) {
        // First 20 days: normal volume, last 10 days: 3x volume
        const volume = i >= 20 ? baseVolume * 3 : baseVolume;
        candles.push({
          time: baseTime + i * 24 * 60 * 60 * 1000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume,
        });
      }

      const signals = volumeAboveAverage(candles, {
        period: 10, // Average over 10 days
        minRatio: 1.0,
        minConsecutiveDays: 1,
      });

      // Should have signals
      expect(signals.length).toBeGreaterThan(0);

      // The first signal after high volume starts should have ratio close to 3.0
      // because the average is calculated from the previous 10 days (all normal volume)
      const firstHighVolumeSignal = signals.find(
        (s) => s.time >= baseTime + 20 * 24 * 60 * 60 * 1000
      );
      expect(firstHighVolumeSignal).toBeDefined();
      expect(firstHighVolumeSignal!.ratio).toBeCloseTo(3.0, 1);
    });
  });

  describe("consecutive days tracking", () => {
    it("should track consecutive days correctly", () => {
      const candles = generateSustainedHighVolumeCandles(40, 10, 1.5);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 1,
      });

      // Check that consecutive days increase
      let prevConsecutive = 0;
      for (const signal of signals) {
        expect(signal.consecutiveDays).toBeGreaterThanOrEqual(prevConsecutive);
        prevConsecutive = signal.consecutiveDays;
      }
    });

    it("should reset consecutive count when volume drops", () => {
      // Create custom candles with a gap in high volume
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;
      const baseVolume = 1000000;

      for (let i = 0; i < 50; i++) {
        // High volume for days 25-30, then drop, then high again 35-45
        const isHighVolume = (i >= 25 && i <= 30) || (i >= 35 && i <= 45);
        const volume = isHighVolume ? baseVolume * 2 : baseVolume;

        candles.push({
          time: baseTime + i * 24 * 60 * 60 * 1000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume,
        });
      }

      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      // Should have signals from both high volume periods
      // and consecutive days should reset between them
      const firstPeriodSignals = signals.filter(
        (s) => s.time < baseTime + 32 * 24 * 60 * 60 * 1000
      );
      const secondPeriodSignals = signals.filter(
        (s) => s.time >= baseTime + 35 * 24 * 60 * 60 * 1000
      );

      if (secondPeriodSignals.length > 0) {
        // Second period should start counting from 1 again
        expect(secondPeriodSignals[0].consecutiveDays).toBeLessThan(10);
      }
    });
  });

  describe("edge cases", () => {
    it("should return empty array for insufficient data", () => {
      const candles = generateHighVolumeCandles(10);
      const signals = volumeAboveAverage(candles, {
        period: 20,
      });

      expect(signals).toEqual([]);
    });

    it("should throw error for period less than 2", () => {
      const candles = generateHighVolumeCandles(30);

      expect(() => {
        volumeAboveAverage(candles, { period: 1 });
      }).toThrow("Volume above average period must be at least 2");
    });

    it("should use default options when not specified", () => {
      const candles = generateSustainedHighVolumeCandles(50, 10, 1.5);
      const signals = volumeAboveAverage(candles);

      // Default: period=20, minRatio=1.0, minConsecutiveDays=3
      expect(signals.length).toBeGreaterThan(0);
    });

    it("should handle candles with zero volume gracefully", () => {
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 30; i++) {
        candles.push({
          time: baseTime + i * 24 * 60 * 60 * 1000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: i === 15 ? 0 : 1000000,
        });
      }

      // Should not throw
      expect(() => {
        volumeAboveAverage(candles, { period: 10 });
      }).not.toThrow();
    });
  });

  describe("signal properties", () => {
    it("should include correct signal properties", () => {
      const candles = generateSustainedHighVolumeCandles(40, 10, 1.5);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      expect(signals.length).toBeGreaterThan(0);

      const signal = signals[0];
      expect(signal).toHaveProperty("time");
      expect(signal).toHaveProperty("type", "volume_above_average");
      expect(signal).toHaveProperty("volume");
      expect(signal).toHaveProperty("averageVolume");
      expect(signal).toHaveProperty("ratio");
      expect(signal).toHaveProperty("consecutiveDays");

      expect(typeof signal.time).toBe("number");
      expect(typeof signal.volume).toBe("number");
      expect(typeof signal.averageVolume).toBe("number");
      expect(typeof signal.ratio).toBe("number");
      expect(typeof signal.consecutiveDays).toBe("number");
    });

    it("should have consistent volume/averageVolume/ratio relationship", () => {
      const candles = generateSustainedHighVolumeCandles(40, 10, 2.0);
      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 1,
      });

      signals.forEach((signal) => {
        const calculatedRatio = signal.volume / signal.averageVolume;
        // Allow for floating point differences
        expect(Math.abs(calculatedRatio - signal.ratio)).toBeLessThan(0.001);
      });
    });
  });

  describe("comparison with volumeAccumulation", () => {
    it("should detect different patterns than linear regression", () => {
      // Create candles with CONSTANT high volume (no trend)
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 50; i++) {
        // Normal volume for first 30, then constant 2x volume
        const volume = i >= 30 ? 2000000 : 1000000;

        candles.push({
          time: baseTime + i * 24 * 60 * 60 * 1000,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume,
        });
      }

      const signals = volumeAboveAverage(candles, {
        period: 20,
        minRatio: 1.0,
        minConsecutiveDays: 3,
      });

      // Should detect the sustained high volume period
      // even though there's no increasing trend (slope ≈ 0)
      expect(signals.length).toBeGreaterThan(0);
    });
  });
});
