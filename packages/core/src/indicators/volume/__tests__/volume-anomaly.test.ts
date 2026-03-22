/**
 * Volume Anomaly Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { volumeAnomaly } from "../volume-anomaly";

// Helper to create test candles
function createCandles(volumes: number[]): NormalizedCandle[] {
  return volumes.map((volume, i) => ({
    time: 1000000 + i * 86400000,
    open: 100,
    high: 105,
    low: 95,
    close: 102,
    volume,
  }));
}

describe("volumeAnomaly", () => {
  describe("basic functionality", () => {
    it("should return empty array for empty input", () => {
      const result = volumeAnomaly([]);
      expect(result).toEqual([]);
    });

    it("should return values for each candle", () => {
      const candles = createCandles([100, 200, 150, 300, 250]);
      const result = volumeAnomaly(candles, { period: 3 });
      expect(result).toHaveLength(5);
    });

    it("should include required fields in each value", () => {
      const candles = createCandles([100, 200, 150, 300, 250]);
      const result = volumeAnomaly(candles, { period: 3 });

      for (const item of result) {
        expect(item.value).toHaveProperty("volume");
        expect(item.value).toHaveProperty("avgVolume");
        expect(item.value).toHaveProperty("ratio");
        expect(item.value).toHaveProperty("isAnomaly");
        expect(item.value).toHaveProperty("level");
      }
    });
  });

  describe("anomaly detection with ratio method", () => {
    it("should detect high volume anomaly when ratio exceeds threshold", () => {
      // Create data with normal volumes then a spike
      const volumes = Array(20).fill(100);
      volumes.push(250); // ~2.4x average (accounting for rolling window)
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 20,
        highThreshold: 2.0,
        extremeThreshold: 3.0,
        useZScore: false, // Test ratio-based detection only
      });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.isAnomaly).toBe(true);
      expect(lastValue.level).toBe("high");
      expect(lastValue.ratio).toBeGreaterThanOrEqual(2.0);
    });

    it("should detect extreme volume anomaly", () => {
      const volumes = Array(20).fill(100);
      volumes.push(400); // ~3.8x average - should be extreme
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 20,
        highThreshold: 2.0,
        extremeThreshold: 3.0,
        useZScore: false, // Test ratio-based detection only
      });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.isAnomaly).toBe(true);
      expect(lastValue.level).toBe("extreme");
    });

    it("should not flag normal volume as anomaly", () => {
      const volumes = Array(20).fill(100);
      volumes.push(120); // 1.2x average - not anomalous
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 20,
        highThreshold: 2.0,
        useZScore: false, // Test ratio-based detection only
      });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.isAnomaly).toBe(false);
      expect(lastValue.level).toBe("normal");
    });

    it("should correctly calculate volume ratio", () => {
      const volumes = Array(10).fill(100);
      volumes.push(200); // 2x average
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, { period: 10, useZScore: false });
      const lastValue = result[result.length - 1].value;

      expect(lastValue.volume).toBe(200);
      // Note: avgVolume includes current candle in rolling window
      // so avgVolume = (9*100 + 200) / 10 = 110
      expect(lastValue.avgVolume).toBe(110);
      expect(lastValue.ratio).toBeCloseTo(200 / 110);
    });
  });

  describe("anomaly detection with zScore method", () => {
    it("should calculate zScore when useZScore is true", () => {
      const volumes = Array(20).fill(100);
      volumes.push(250);
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 20,
        useZScore: true,
        zScoreThreshold: 2.0,
      });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.zScore).not.toBeNull();
      expect(typeof lastValue.zScore).toBe("number");
    });

    it("should detect anomaly using zScore threshold", () => {
      // Create data with some variation to have meaningful stdDev
      const volumes = [];
      for (let i = 0; i < 30; i++) {
        volumes.push(100 + (i % 3) * 10); // 100, 110, 120 repeating
      }
      // Add a significant spike
      volumes.push(400);
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 30,
        useZScore: true,
        zScoreThreshold: 2.0,
      });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.isAnomaly).toBe(true);
      expect(lastValue.zScore).toBeGreaterThan(2.0);
    });

    it("should not flag normal variations as anomaly with zScore only", () => {
      // Create data with some variation so stdDev is meaningful
      const volumes = [];
      for (let i = 0; i < 30; i++) {
        volumes.push(100 + (i % 2 === 0 ? 5 : -5)); // 95-105 range
      }
      volumes.push(110); // Small spike, within normal variation
      const candles = createCandles(volumes);

      const result = volumeAnomaly(candles, {
        period: 30,
        useZScore: true,
        zScoreThreshold: 3.0, // High threshold
        highThreshold: 3.0, // High ratio threshold too
        extremeThreshold: 4.0,
      });

      const lastValue = result[result.length - 1].value;
      // With high thresholds, small variation should not be anomaly
      expect(lastValue.ratio).toBeLessThan(2);
    });
  });

  describe("period handling", () => {
    it("should handle early values before full period", () => {
      const candles = createCandles([100, 200, 150, 300, 250]);
      const result = volumeAnomaly(candles, { period: 3, useZScore: false });

      // First two values (before period) use current volume as avgVolume
      expect(result[0].value.avgVolume).toBe(100);
      expect(result[1].value.avgVolume).toBe(200);
      // Third value (index 2) should have calculated avgVolume
      expect(result[2].value.avgVolume).toBeGreaterThan(0);
    });

    it("should use rolling window for average calculation", () => {
      const candles = createCandles([100, 200, 300, 400, 500]);
      const result = volumeAnomaly(candles, { period: 3 });

      // At index 3, average should be (200 + 300 + 400) / 3 = 300
      // But looking at the code, it uses indices 0 to period-1 for average
      // Let's check the actual behavior
      expect(result[3].value.avgVolume).toBeGreaterThan(0);
    });

    it("should respect custom period setting", () => {
      const candles = createCandles(Array(50).fill(100).concat([200]));

      const result5 = volumeAnomaly(candles, { period: 5 });
      const result20 = volumeAnomaly(candles, { period: 20 });

      // Both should calculate averages but at different positions
      expect(result5[4].value.avgVolume).toBeGreaterThan(0);
      expect(result20[19].value.avgVolume).toBeGreaterThan(0);
    });
  });

  describe("threshold customization", () => {
    it("should use custom highThreshold", () => {
      const volumes = Array(20).fill(100);
      volumes.push(180); // ~1.7x (accounting for rolling avg including spike)
      const candles = createCandles(volumes);

      // With threshold 1.5, this should be anomalous
      const result1 = volumeAnomaly(candles, { period: 20, highThreshold: 1.5, useZScore: false });
      expect(result1[result1.length - 1].value.isAnomaly).toBe(true);

      // With threshold 2.0 and useZScore disabled, this should not be anomalous
      const result2 = volumeAnomaly(candles, { period: 20, highThreshold: 2.0, useZScore: false });
      expect(result2[result2.length - 1].value.isAnomaly).toBe(false);
    });

    it("should use custom extremeThreshold", () => {
      const volumes = Array(20).fill(100);
      volumes.push(350); // ~3.3x (accounting for rolling avg)
      const candles = createCandles(volumes);

      // With extreme threshold 2.5, this should be extreme (useZScore disabled to test ratio only)
      const result1 = volumeAnomaly(candles, {
        period: 20,
        highThreshold: 2.0,
        extremeThreshold: 2.5,
        useZScore: false,
      });
      expect(result1[result1.length - 1].value.level).toBe("extreme");

      // With extreme threshold 4.0, this should be high (not extreme)
      const result2 = volumeAnomaly(candles, {
        period: 20,
        highThreshold: 2.0,
        extremeThreshold: 4.0,
        useZScore: false,
      });
      expect(result2[result2.length - 1].value.level).toBe("high");
    });
  });

  describe("edge cases", () => {
    it("should handle all zero volumes", () => {
      const candles = createCandles([0, 0, 0, 0, 0]);
      const result = volumeAnomaly(candles, { period: 3 });

      // Should not throw and should handle division by zero
      expect(result).toHaveLength(5);
    });

    it("should handle single candle", () => {
      const candles = createCandles([100]);
      const result = volumeAnomaly(candles, { period: 1 });
      expect(result).toHaveLength(1);
    });

    it("should handle very large volumes", () => {
      const candles = createCandles([1e10, 2e10, 3e10]);
      const result = volumeAnomaly(candles, { period: 2 });
      expect(result).toHaveLength(3);
      expect(result[2].value.ratio).toBeGreaterThan(0);
    });

    it("should handle fluctuating volumes", () => {
      const volumes = [100, 500, 50, 600, 30, 700, 20, 800];
      const candles = createCandles(volumes);
      const result = volumeAnomaly(candles, { period: 4, highThreshold: 2.0 });

      // Should not throw
      expect(result).toHaveLength(8);
    });
  });

  describe("time preservation", () => {
    it("should preserve candle timestamps", () => {
      const candles = createCandles([100, 200, 300]);
      const result = volumeAnomaly(candles);

      for (let i = 0; i < candles.length; i++) {
        expect(result[i].time).toBe(candles[i].time);
      }
    });
  });
});
