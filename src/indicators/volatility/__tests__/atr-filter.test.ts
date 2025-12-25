import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  calculateAtrPercent,
  atrPercentSeries,
  passesAtrFilter,
  filterStocksByAtr,
  DEFAULT_ATR_THRESHOLD,
} from "../atr-filter";

// Helper to create test candles with varying volatility
function createCandles(
  count: number,
  options: {
    basePrice?: number;
    volatility?: number; // percentage of price for high-low range
  } = {},
): NormalizedCandle[] {
  const { basePrice = 1000, volatility = 2 } = options;
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < count; i++) {
    const price = basePrice + Math.sin(i * 0.1) * (basePrice * 0.1);
    const range = price * (volatility / 100);

    candles.push({
      time: 1000000000000 + i * 86400000,
      open: price,
      high: price + range / 2,
      low: price - range / 2,
      close: price + (Math.random() - 0.5) * range * 0.5,
      volume: 1000000,
    });
  }

  return candles;
}

// Create predictable candles for exact calculation tests
function createPredictableCandles(count: number, atrPct: number, basePrice: number = 1000): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const range = basePrice * (atrPct / 100);

  for (let i = 0; i < count; i++) {
    candles.push({
      time: 1000000000000 + i * 86400000,
      open: basePrice,
      high: basePrice + range / 2,
      low: basePrice - range / 2,
      close: basePrice,
      volume: 1000000,
    });
  }

  return candles;
}

describe("atr-filter", () => {
  describe("DEFAULT_ATR_THRESHOLD", () => {
    it("should be 2.3", () => {
      expect(DEFAULT_ATR_THRESHOLD).toBe(2.3);
    });
  });

  describe("calculateAtrPercent", () => {
    it("should return 0 for empty input", () => {
      const result = calculateAtrPercent([]);
      expect(result).toBe(0);
    });

    it("should return 0 for insufficient data", () => {
      const candles = createCandles(5);
      const result = calculateAtrPercent(candles, { atrPeriod: 14 });
      expect(result).toBe(0);
    });

    it("should calculate ATR% for sufficient data", () => {
      const candles = createCandles(300, { volatility: 3 });
      const result = calculateAtrPercent(candles);

      // Should return a positive value around the volatility level
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(10);
    });

    it("should return higher ATR% for more volatile stocks", () => {
      const lowVolCandles = createCandles(300, { volatility: 1.5 });
      const highVolCandles = createCandles(300, { volatility: 4 });

      const lowVolResult = calculateAtrPercent(lowVolCandles);
      const highVolResult = calculateAtrPercent(highVolCandles);

      expect(highVolResult).toBeGreaterThan(lowVolResult);
    });

    it("should respect lookbackPeriod option", () => {
      const candles = createCandles(500, { volatility: 3 });
      const result252 = calculateAtrPercent(candles, { lookbackPeriod: 252 });
      const result50 = calculateAtrPercent(candles, { lookbackPeriod: 50 });

      // Both should return valid values
      expect(result252).toBeGreaterThan(0);
      expect(result50).toBeGreaterThan(0);
    });

    it("should respect atrPeriod option", () => {
      const candles = createCandles(300, { volatility: 3 });
      const result14 = calculateAtrPercent(candles, { atrPeriod: 14 });
      const result7 = calculateAtrPercent(candles, { atrPeriod: 7 });

      // Both should return valid values
      expect(result14).toBeGreaterThan(0);
      expect(result7).toBeGreaterThan(0);
    });
  });

  describe("atrPercentSeries", () => {
    it("should return empty array for empty input", () => {
      const result = atrPercentSeries([]);
      expect(result).toEqual([]);
    });

    it("should return null values for insufficient data", () => {
      const candles = createCandles(20);
      const result = atrPercentSeries(candles);

      // First 13 values should be null (ATR period - 1)
      expect(result[0].value).toBeNull();
      expect(result[12].value).toBeNull();
    });

    it("should calculate ATR% series correctly", () => {
      const candles = createCandles(50, { volatility: 3 });
      const result = atrPercentSeries(candles);

      expect(result.length).toBe(candles.length);

      // After ATR period, values should be non-null
      const nonNullValues = result.filter((v) => v.value !== null);
      expect(nonNullValues.length).toBeGreaterThan(0);

      // All non-null values should be positive
      for (const v of nonNullValues) {
        expect(v.value).toBeGreaterThan(0);
      }
    });

    it("should have time values matching input candles", () => {
      const candles = createCandles(30);
      const result = atrPercentSeries(candles);

      for (let i = 0; i < candles.length; i++) {
        expect(result[i].time).toBe(candles[i].time);
      }
    });
  });

  describe("passesAtrFilter", () => {
    it("should pass for high volatility stocks", () => {
      const candles = createCandles(300, { volatility: 4 });
      const result = passesAtrFilter(candles);

      expect(result.passes).toBe(true);
      expect(result.atrPercent).toBeGreaterThan(DEFAULT_ATR_THRESHOLD);
      expect(result.threshold).toBe(DEFAULT_ATR_THRESHOLD);
    });

    it("should fail for low volatility stocks", () => {
      const candles = createCandles(300, { volatility: 1 });
      const result = passesAtrFilter(candles);

      expect(result.passes).toBe(false);
      expect(result.atrPercent).toBeLessThan(DEFAULT_ATR_THRESHOLD);
    });

    it("should use custom threshold when provided", () => {
      const candles = createCandles(300, { volatility: 2 });
      const result1 = passesAtrFilter(candles, { threshold: 1 });
      const result2 = passesAtrFilter(candles, { threshold: 5 });

      expect(result1.passes).toBe(true);
      expect(result1.threshold).toBe(1);
      expect(result2.passes).toBe(false);
      expect(result2.threshold).toBe(5);
    });

    it("should return consistent atrPercent regardless of threshold", () => {
      const candles = createCandles(300, { volatility: 3 });
      const result1 = passesAtrFilter(candles, { threshold: 1 });
      const result2 = passesAtrFilter(candles, { threshold: 5 });

      expect(result1.atrPercent).toBe(result2.atrPercent);
    });
  });

  describe("filterStocksByAtr", () => {
    it("should return empty arrays for empty input", () => {
      const result = filterStocksByAtr({});
      expect(result.passing).toEqual([]);
      expect(result.failing).toEqual([]);
    });

    it("should categorize stocks correctly", () => {
      const stocks = {
        "HIGH.T": createCandles(300, { volatility: 4 }),
        "LOW.T": createCandles(300, { volatility: 1 }),
        "MED.T": createCandles(300, { volatility: 2.5 }),
      };

      const result = filterStocksByAtr(stocks);

      // HIGH.T and MED.T should pass (volatility > 2.3%)
      expect(result.passing.map((s) => s.ticker)).toContain("HIGH.T");

      // LOW.T should fail
      expect(result.failing.map((s) => s.ticker)).toContain("LOW.T");
    });

    it("should sort results by ATR% descending", () => {
      const stocks = {
        "A.T": createCandles(300, { volatility: 3 }),
        "B.T": createCandles(300, { volatility: 5 }),
        "C.T": createCandles(300, { volatility: 4 }),
      };

      const result = filterStocksByAtr(stocks);

      // All should pass with high volatility
      expect(result.passing.length).toBe(3);

      // Should be sorted by ATR% descending
      for (let i = 1; i < result.passing.length; i++) {
        expect(result.passing[i - 1].atrPercent).toBeGreaterThanOrEqual(result.passing[i].atrPercent);
      }
    });

    it("should respect custom threshold", () => {
      const stocks = {
        "A.T": createCandles(300, { volatility: 2 }),
        "B.T": createCandles(300, { volatility: 3 }),
      };

      const result1 = filterStocksByAtr(stocks, { threshold: 1 });
      const result2 = filterStocksByAtr(stocks, { threshold: 4 });

      // With low threshold, all pass
      expect(result1.passing.length).toBe(2);
      expect(result1.failing.length).toBe(0);

      // With high threshold, none pass
      expect(result2.passing.length).toBe(0);
      expect(result2.failing.length).toBe(2);
    });

    it("should include correct atrPercent values", () => {
      const stocks = {
        "TEST.T": createCandles(300, { volatility: 3 }),
      };

      const result = filterStocksByAtr(stocks);
      const stock = result.passing.find((s) => s.ticker === "TEST.T") || result.failing.find((s) => s.ticker === "TEST.T");

      expect(stock).toBeDefined();
      expect(stock!.atrPercent).toBeGreaterThan(0);
    });
  });
});
