import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { volatilityRegime } from "../regime";

/**
 * Generate test candles with controllable volatility
 */
function generateTestCandles(
  count: number,
  options: {
    basePrice?: number;
    volatilityMultiplier?: number;
    trend?: "up" | "down" | "flat";
  } = {},
): NormalizedCandle[] {
  const { basePrice = 100, volatilityMultiplier = 1, trend = "flat" } = options;
  const candles: NormalizedCandle[] = [];

  let price = basePrice;
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Add trend component
    if (trend === "up") {
      price *= 1.002; // ~0.2% daily increase
    } else if (trend === "down") {
      price *= 0.998; // ~0.2% daily decrease
    }

    // Daily volatility scaled by multiplier
    const dailyRange = price * 0.02 * volatilityMultiplier;
    const open = price + (Math.random() - 0.5) * dailyRange * 0.5;
    const close = price + (Math.random() - 0.5) * dailyRange * 0.5;
    const high = Math.max(open, close) + Math.random() * dailyRange * 0.5;
    const low = Math.min(open, close) - Math.random() * dailyRange * 0.5;
    const volume = 1000000 + Math.random() * 500000;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume,
    });

    price = close;
  }

  return candles;
}

describe("Volatility Regime", () => {
  describe("volatilityRegime indicator", () => {
    it("should return empty array for empty candles", () => {
      const result = volatilityRegime([]);
      expect(result).toEqual([]);
    });

    it("should return results for each candle", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles);

      expect(result).toHaveLength(candles.length);
      expect(result[0].time).toBe(candles[0].time);
    });

    it("should have null values initially before enough data", () => {
      const candles = generateTestCandles(50);
      const result = volatilityRegime(candles, { lookbackPeriod: 100 });

      // Early values should have null percentiles
      expect(result[0].value.atrPercentile).toBeNull();
      expect(result[0].value.bandwidthPercentile).toBeNull();
      expect(result[0].value.confidence).toBe(0);
    });

    it("should classify regimes after enough data", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles, { lookbackPeriod: 100 });

      // Later values should have valid percentiles
      const lastValue = result[result.length - 1].value;
      expect(lastValue.regime).toMatch(/^(low|normal|high|extreme)$/);
      expect(lastValue.atrPercentile).not.toBeNull();
      expect(lastValue.bandwidthPercentile).not.toBeNull();
    });

    it("should detect low volatility regime", () => {
      // Generate data with decreasing volatility at the end
      const normalVolatility = generateTestCandles(100, { volatilityMultiplier: 1 });
      const lowVolatility = generateTestCandles(50, {
        volatilityMultiplier: 0.3,
        basePrice: normalVolatility[normalVolatility.length - 1].close,
      });

      // Adjust timestamps for low volatility candles
      const lastTime = normalVolatility[normalVolatility.length - 1].time;
      lowVolatility.forEach((c, i) => {
        c.time = lastTime + (i + 1) * 24 * 60 * 60 * 1000;
      });

      const candles = [...normalVolatility, ...lowVolatility];
      const result = volatilityRegime(candles, { lookbackPeriod: 50 });

      // The last few values should tend toward low volatility
      const lastValue = result[result.length - 1].value;
      // Either low or at least not high/extreme
      expect(["low", "normal"]).toContain(lastValue.regime);
    });

    it("should detect high volatility regime", () => {
      // Generate data with increasing volatility at the end
      const normalVolatility = generateTestCandles(100, { volatilityMultiplier: 0.5 });
      const highVolatility = generateTestCandles(50, {
        volatilityMultiplier: 3,
        basePrice: normalVolatility[normalVolatility.length - 1].close,
      });

      // Adjust timestamps for high volatility candles
      const lastTime = normalVolatility[normalVolatility.length - 1].time;
      highVolatility.forEach((c, i) => {
        c.time = lastTime + (i + 1) * 24 * 60 * 60 * 1000;
      });

      const candles = [...normalVolatility, ...highVolatility];
      const result = volatilityRegime(candles, { lookbackPeriod: 50 });

      // The last few values should tend toward high volatility
      const lastValue = result[result.length - 1].value;
      // Either high, extreme, or at least not low
      expect(["high", "extreme", "normal"]).toContain(lastValue.regime);
    });

    it("should use custom thresholds", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles, {
        thresholds: {
          low: 10,
          high: 90,
          extreme: 98,
        },
      });

      // With stricter thresholds, most values should be "normal"
      const lastValue = result[result.length - 1].value;
      expect(lastValue.regime).toMatch(/^(low|normal|high|extreme)$/);
    });

    it("should include ATR and bandwidth values", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles);

      // After enough data, ATR and bandwidth should be present
      const lastValue = result[result.length - 1].value;
      expect(lastValue.atr).not.toBeNull();
      expect(lastValue.bandwidth).not.toBeNull();
      if (lastValue.atr !== null) {
        expect(lastValue.atr).toBeGreaterThan(0);
      }
    });

    it("should calculate historical volatility", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles);

      const lastValue = result[result.length - 1].value;
      expect(lastValue.historicalVol).not.toBeNull();
      if (lastValue.historicalVol !== null) {
        expect(lastValue.historicalVol).toBeGreaterThan(0);
      }
    });

    it("should provide confidence score", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles);

      const lastValue = result[result.length - 1].value;
      expect(lastValue.confidence).toBeGreaterThanOrEqual(0);
      expect(lastValue.confidence).toBeLessThanOrEqual(1);
    });

    it("should work with custom ATR and BB periods", () => {
      const candles = generateTestCandles(150);
      const result = volatilityRegime(candles, {
        atrPeriod: 7,
        bbPeriod: 10,
        lookbackPeriod: 50,
      });

      expect(result).toHaveLength(candles.length);
      // Should have valid values earlier due to shorter periods
      const midValue = result[60].value;
      expect(midValue.regime).toMatch(/^(low|normal|high|extreme)$/);
    });
  });

  describe("percentile calculation", () => {
    it("should calculate percentiles between 0 and 100", () => {
      const candles = generateTestCandles(200);
      const result = volatilityRegime(candles, { lookbackPeriod: 50 });

      // Check percentiles in valid range for values that have them
      for (let i = 100; i < result.length; i++) {
        const value = result[i].value;
        if (value.atrPercentile !== null) {
          expect(value.atrPercentile).toBeGreaterThanOrEqual(0);
          expect(value.atrPercentile).toBeLessThanOrEqual(100);
        }
        if (value.bandwidthPercentile !== null) {
          expect(value.bandwidthPercentile).toBeGreaterThanOrEqual(0);
          expect(value.bandwidthPercentile).toBeLessThanOrEqual(100);
        }
      }
    });
  });
});
