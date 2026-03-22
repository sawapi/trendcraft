/**
 * Volume Trend Confirmation Tests
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { volumeTrend } from "../volume-trend";

// Helper to create test candles with specific price and volume patterns
function createCandles(data: Array<{ close: number; volume: number }>): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: 1000000 + i * 86400000,
    open: d.close * 0.99,
    high: d.close * 1.02,
    low: d.close * 0.98,
    close: d.close,
    volume: d.volume,
  }));
}

// Create candles with linear price trend
function createTrendingCandles(
  count: number,
  startPrice: number,
  priceChange: number,
  startVolume: number,
  volumeChange: number,
): NormalizedCandle[] {
  return Array(count)
    .fill(null)
    .map((_, i) => ({
      time: 1000000 + i * 86400000,
      open: startPrice + i * priceChange,
      high: startPrice + i * priceChange + 2,
      low: startPrice + i * priceChange - 2,
      close: startPrice + i * priceChange,
      volume: startVolume + i * volumeChange,
    }));
}

describe("volumeTrend", () => {
  describe("basic functionality", () => {
    it("should return empty array for empty input", () => {
      const result = volumeTrend([]);
      expect(result).toEqual([]);
    });

    it("should return values for each candle", () => {
      const candles = createTrendingCandles(20, 100, 1, 1000, 10);
      const result = volumeTrend(candles);
      expect(result).toHaveLength(20);
    });

    it("should include all required fields in output", () => {
      const candles = createTrendingCandles(20, 100, 1, 1000, 10);
      const result = volumeTrend(candles);

      for (const item of result) {
        expect(item.value).toHaveProperty("priceTrend");
        expect(item.value).toHaveProperty("volumeTrend");
        expect(item.value).toHaveProperty("isConfirmed");
        expect(item.value).toHaveProperty("hasDivergence");
        expect(item.value).toHaveProperty("confidence");
      }
    });
  });

  describe("trend confirmation", () => {
    it("should confirm uptrend with increasing volume (bullish confirmation)", () => {
      // Price going up, volume going up
      const candles = createTrendingCandles(30, 100, 2, 1000, 50);
      const result = volumeTrend(candles, { minPriceChange: 1 });

      // After enough data, should show confirmation
      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("up");
      expect(lastValue.volumeTrend).toBe("up");
      expect(lastValue.isConfirmed).toBe(true);
      expect(lastValue.hasDivergence).toBe(false);
    });

    it("should confirm downtrend with increasing volume (bearish confirmation)", () => {
      // Price going down, volume going up (strong selling)
      const candles = createTrendingCandles(30, 200, -2, 1000, 50);
      const result = volumeTrend(candles, { minPriceChange: 1 });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("down");
      expect(lastValue.volumeTrend).toBe("up");
      expect(lastValue.isConfirmed).toBe(true);
    });
  });

  describe("divergence detection", () => {
    it("should detect bearish divergence (price up, volume down)", () => {
      // Price going up but volume decreasing (weak rally)
      const candles = createTrendingCandles(30, 100, 2, 2000, -30);
      const result = volumeTrend(candles, { minPriceChange: 1 });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("up");
      expect(lastValue.volumeTrend).toBe("down");
      expect(lastValue.hasDivergence).toBe(true);
      expect(lastValue.isConfirmed).toBe(false);
    });

    it("should detect bullish divergence (price down, volume down - exhaustion)", () => {
      // Price going down but volume decreasing (selling exhaustion)
      const candles = createTrendingCandles(30, 200, -2, 2000, -30);
      const result = volumeTrend(candles, { minPriceChange: 1 });

      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("down");
      expect(lastValue.volumeTrend).toBe("down");
      expect(lastValue.hasDivergence).toBe(true);
    });
  });

  describe("neutral detection", () => {
    it("should return neutral for flat price action", () => {
      // Price staying roughly flat
      const candles = createCandles(
        Array(30)
          .fill(null)
          .map((_, i) => ({
            close: 100 + (i % 2 === 0 ? 0.1 : -0.1), // Small oscillation
            volume: 1000 + i * 10,
          })),
      );

      const result = volumeTrend(candles, { minPriceChange: 5 }); // High threshold
      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("neutral");
    });

    it("should not confirm or diverge when price is neutral", () => {
      const candles = createCandles(
        Array(30)
          .fill(null)
          .map((_, i) => ({
            close: 100 + (i % 2 === 0 ? 0.1 : -0.1),
            volume: 1000 + i * 10,
          })),
      );

      const result = volumeTrend(candles, { minPriceChange: 5 });
      const lastValue = result[result.length - 1].value;

      expect(lastValue.isConfirmed).toBe(false);
      expect(lastValue.hasDivergence).toBe(false);
    });
  });

  describe("confidence scoring", () => {
    it("should return confidence between 0 and 100", () => {
      const candles = createTrendingCandles(30, 100, 2, 1000, 50);
      const result = volumeTrend(candles);

      for (const item of result) {
        expect(item.value.confidence).toBeGreaterThanOrEqual(0);
        expect(item.value.confidence).toBeLessThanOrEqual(100);
      }
    });

    it("should have higher confidence for stronger trends", () => {
      // Weak trend
      const weakCandles = createTrendingCandles(30, 100, 0.5, 1000, 5);
      const weakResult = volumeTrend(weakCandles, { minPriceChange: 0.1 });

      // Strong trend
      const strongCandles = createTrendingCandles(30, 100, 5, 1000, 100);
      const strongResult = volumeTrend(strongCandles, { minPriceChange: 0.1 });

      const weakConfidence = weakResult[weakResult.length - 1].value.confidence;
      const strongConfidence = strongResult[strongResult.length - 1].value.confidence;

      expect(strongConfidence).toBeGreaterThan(weakConfidence);
    });
  });

  describe("period options", () => {
    it("should respect pricePeriod option", () => {
      const candles = createTrendingCandles(50, 100, 1, 1000, 10);

      const result5 = volumeTrend(candles, { pricePeriod: 5 });
      const result20 = volumeTrend(candles, { pricePeriod: 20 });

      // Both should work without errors
      expect(result5).toHaveLength(50);
      expect(result20).toHaveLength(50);
    });

    it("should respect volumePeriod option", () => {
      const candles = createTrendingCandles(50, 100, 1, 1000, 10);

      const result5 = volumeTrend(candles, { volumePeriod: 5 });
      const result20 = volumeTrend(candles, { volumePeriod: 20 });

      expect(result5).toHaveLength(50);
      expect(result20).toHaveLength(50);
    });

    it("should return neutral values before minimum period", () => {
      const candles = createTrendingCandles(30, 100, 1, 1000, 10);
      const result = volumeTrend(candles, { pricePeriod: 10, volumePeriod: 10 });

      // First 9 values (before period) should be neutral
      for (let i = 0; i < 9; i++) {
        expect(result[i].value.priceTrend).toBe("neutral");
        expect(result[i].value.volumeTrend).toBe("neutral");
        expect(result[i].value.confidence).toBe(0);
      }
    });
  });

  describe("minPriceChange threshold", () => {
    it("should require minimum price change for trend detection", () => {
      // Small price change
      const candles = createTrendingCandles(30, 100, 0.1, 1000, 50);

      // With high threshold, should be neutral
      const result = volumeTrend(candles, { minPriceChange: 5 });
      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("neutral");
    });

    it("should detect trend when price change exceeds threshold", () => {
      const candles = createTrendingCandles(30, 100, 2, 1000, 50);

      // With low threshold, should detect trend
      const result = volumeTrend(candles, { minPriceChange: 1 });
      const lastValue = result[result.length - 1].value;
      expect(lastValue.priceTrend).toBe("up");
    });
  });

  describe("edge cases", () => {
    it("should handle single candle", () => {
      const candles = createTrendingCandles(1, 100, 0, 1000, 0);
      const result = volumeTrend(candles);
      expect(result).toHaveLength(1);
      expect(result[0].value.priceTrend).toBe("neutral");
    });

    it("should handle zero volumes", () => {
      const candles = createCandles(
        Array(20)
          .fill(null)
          .map(() => ({ close: 100, volume: 0 })),
      );
      const result = volumeTrend(candles);
      expect(result).toHaveLength(20);
    });

    it("should handle very large price changes", () => {
      const candles = createTrendingCandles(30, 100, 100, 1000, 50);
      const result = volumeTrend(candles);
      expect(result).toHaveLength(30);
    });

    it("should handle alternating volumes", () => {
      const candles = createCandles(
        Array(30)
          .fill(null)
          .map((_, i) => ({
            close: 100 + i,
            volume: i % 2 === 0 ? 2000 : 500,
          })),
      );
      const result = volumeTrend(candles);
      expect(result).toHaveLength(30);
    });
  });

  describe("time preservation", () => {
    it("should preserve candle timestamps", () => {
      const candles = createTrendingCandles(20, 100, 1, 1000, 10);
      const result = volumeTrend(candles);

      for (let i = 0; i < candles.length; i++) {
        expect(result[i].time).toBe(candles[i].time);
      }
    });
  });

  describe("real-world scenarios", () => {
    it("should detect healthy uptrend (price up + volume up)", () => {
      const candles = createCandles([
        { close: 100, volume: 1000 },
        { close: 102, volume: 1100 },
        { close: 104, volume: 1200 },
        { close: 106, volume: 1300 },
        { close: 108, volume: 1400 },
        { close: 110, volume: 1500 },
        { close: 112, volume: 1600 },
        { close: 114, volume: 1700 },
        { close: 116, volume: 1800 },
        { close: 118, volume: 1900 },
        { close: 120, volume: 2000 },
        { close: 122, volume: 2100 },
        { close: 124, volume: 2200 },
        { close: 126, volume: 2300 },
        { close: 128, volume: 2400 },
        { close: 130, volume: 2500 },
        { close: 132, volume: 2600 },
        { close: 134, volume: 2700 },
        { close: 136, volume: 2800 },
        { close: 138, volume: 2900 },
      ]);

      const result = volumeTrend(candles, { minPriceChange: 1 });
      const lastValue = result[result.length - 1].value;

      expect(lastValue.priceTrend).toBe("up");
      expect(lastValue.volumeTrend).toBe("up");
      expect(lastValue.isConfirmed).toBe(true);
    });

    it("should detect potential top (price up + volume down)", () => {
      const candles = createCandles([
        { close: 100, volume: 3000 },
        { close: 102, volume: 2900 },
        { close: 104, volume: 2800 },
        { close: 106, volume: 2700 },
        { close: 108, volume: 2600 },
        { close: 110, volume: 2500 },
        { close: 112, volume: 2400 },
        { close: 114, volume: 2300 },
        { close: 116, volume: 2200 },
        { close: 118, volume: 2100 },
        { close: 120, volume: 2000 },
        { close: 122, volume: 1900 },
        { close: 124, volume: 1800 },
        { close: 126, volume: 1700 },
        { close: 128, volume: 1600 },
        { close: 130, volume: 1500 },
        { close: 132, volume: 1400 },
        { close: 134, volume: 1300 },
        { close: 136, volume: 1200 },
        { close: 138, volume: 1100 },
      ]);

      const result = volumeTrend(candles, { minPriceChange: 1 });
      const lastValue = result[result.length - 1].value;

      expect(lastValue.priceTrend).toBe("up");
      expect(lastValue.volumeTrend).toBe("down");
      expect(lastValue.hasDivergence).toBe(true);
    });
  });
});
