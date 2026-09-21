import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../../core/random";
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
  // Seeded so the fixture is the same on every run: an unseeded draw made assertions on the generated data flaky.
  const random = mulberry32(
    count + Math.round(volatilityMultiplier * 100) + { up: 1, down: 2, flat: 3 }[trend],
  );
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
    const open = price + (random() - 0.5) * dailyRange * 0.5;
    const close = price + (random() - 0.5) * dailyRange * 0.5;
    const high = Math.max(open, close) + random() * dailyRange * 0.5;
    const low = Math.min(open, close) - random() * dailyRange * 0.5;
    const volume = 1000000 + random() * 500000;

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
      // Generate data with decreasing volatility at the end. As in the
      // high-volatility test below, the tail is kept shorter than the 50-bar
      // lookback window so the window straddles the shift; a 50-bar tail read
      // "normal" for a third of the generator seeds, 20 bars read "low" for
      // 199 of 200.
      const normalVolatility = generateTestCandles(100, { volatilityMultiplier: 1 });
      const lowVolatility = generateTestCandles(20, {
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

      const lastValue = result[result.length - 1].value;
      expect(lastValue.regime).toBe("low");
    });

    it("should detect high volatility regime", () => {
      // Generate data with increasing volatility at the end. The high-volatility
      // tail must be shorter than the lookback window: the regime is a percentile
      // within that window, so a window filled entirely with high-volatility bars
      // reads "normal" (or even "low") relative to itself. 20 bars in a 50-bar
      // window read high/extreme for every one of 500 generator seeds.
      const normalVolatility = generateTestCandles(100, { volatilityMultiplier: 0.5 });
      const highVolatility = generateTestCandles(20, {
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

      const lastValue = result[result.length - 1].value;
      expect(["high", "extreme"]).toContain(lastValue.regime);
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
