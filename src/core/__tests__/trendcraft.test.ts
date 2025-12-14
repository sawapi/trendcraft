import { describe, expect, it } from "vitest";
import type { Candle, NormalizedCandle } from "../../types";
import { TrendCraft } from "../trendcraft";

describe("TrendCraft", () => {
  // Helper to create simple candles
  const makeCandles = (closes: number[]): NormalizedCandle[] =>
    closes.map((close, i) => ({
      time: 1700000000000 + i * 86400000, // Daily candles
      open: close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000 + i * 100,
    }));

  describe("from", () => {
    it("should create instance from raw candles", () => {
      const rawCandles: Candle[] = [
        { time: "2023-11-14T00:00:00Z", open: 100, high: 110, low: 90, close: 105, volume: 1000 },
        { time: "2023-11-15T00:00:00Z", open: 105, high: 115, low: 95, close: 110, volume: 1100 },
      ];

      const tc = TrendCraft.from(rawCandles);

      expect(tc.length).toBe(2);
      expect(typeof tc.candles[0].time).toBe("number");
    });

    it("should create instance from normalized candles", () => {
      const candles = makeCandles([100, 101, 102]);
      const tc = TrendCraft.from(candles);

      expect(tc.length).toBe(3);
      expect(tc.candles).toEqual(candles);
    });

    it("should handle empty array", () => {
      const tc = TrendCraft.from([]);
      expect(tc.length).toBe(0);
    });
  });

  describe("resample", () => {
    it("should return new instance with resampled data", () => {
      // Create 10 daily candles
      const candles = makeCandles(Array.from({ length: 10 }, (_, i) => 100 + i));
      const tc = TrendCraft.from(candles);

      // Resample to weekly (should reduce candle count)
      const weekly = tc.resample("weekly");

      expect(weekly).toBeInstanceOf(TrendCraft);
      expect(weekly).not.toBe(tc); // Should be new instance
      expect(weekly.length).toBeLessThan(tc.length);
    });
  });

  describe("sma", () => {
    it("should add SMA to pipeline and compute", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const result = TrendCraft.from(candles).sma(3).compute();

      expect(result.indicators.sma3).toBeDefined();
      expect(result.indicators.sma3).toHaveLength(5);
      expect(result.indicators.sma3[2].value).toBe(20); // (10+20+30)/3
    });

    it("should support custom price source", () => {
      const candles = makeCandles([100, 110, 120]);
      const result = TrendCraft.from(candles).sma(2, "high").compute();

      expect(result.indicators.sma2_high).toBeDefined();
      // high = close + 2, so highs are 102, 112, 122
      expect(result.indicators.sma2_high[1].value).toBe(107); // (102+112)/2
    });
  });

  describe("ema", () => {
    it("should add EMA to pipeline and compute", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const result = TrendCraft.from(candles).ema(3).compute();

      expect(result.indicators.ema3).toBeDefined();
      expect(result.indicators.ema3).toHaveLength(5);
      expect(result.indicators.ema3[2].value).toBe(20); // First EMA = SMA
    });
  });

  describe("rsi", () => {
    it("should add RSI to pipeline and compute", () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const candles = makeCandles(closes);
      const result = TrendCraft.from(candles).rsi(14).compute();

      expect(result.indicators.rsi14).toBeDefined();
      expect(result.indicators.rsi14).toHaveLength(20);
      // First 14 values should be null
      expect(result.indicators.rsi14[13].value).toBeNull();
      // 15th value should have RSI
      expect(result.indicators.rsi14[14].value).not.toBeNull();
    });

    it("should use default period 14", () => {
      const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
      const candles = makeCandles(closes);
      const result = TrendCraft.from(candles).rsi().compute();

      expect(result.indicators.rsi14).toBeDefined();
    });
  });

  describe("chaining", () => {
    it("should support multiple indicators", () => {
      const candles = makeCandles([10, 20, 30, 40, 50, 60, 70]);
      const result = TrendCraft.from(candles).sma(3).sma(5).ema(3).compute();

      expect(result.indicators.sma3).toBeDefined();
      expect(result.indicators.sma5).toBeDefined();
      expect(result.indicators.ema3).toBeDefined();
      expect(result.candles).toBeDefined();
    });

    it("should work with resample and indicators", () => {
      // Create 14 daily candles (2 weeks)
      const candles = makeCandles(Array.from({ length: 14 }, (_, i) => 100 + i));

      const result = TrendCraft.from(candles).resample("weekly").sma(2).compute();

      expect(result.indicators.sma2).toBeDefined();
      expect(result.candles.length).toBeLessThan(14);
    });
  });

  describe("compute", () => {
    it("should include candles in result", () => {
      const candles = makeCandles([100, 101, 102]);
      const result = TrendCraft.from(candles).sma(2).compute();

      expect(result.candles).toEqual(candles);
    });

    it("should cache computed results", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const tc = TrendCraft.from(candles).sma(3);

      const result1 = tc.compute();
      const result2 = tc.compute();

      // Should return same cached results
      expect(result1.indicators.sma3).toBe(result2.indicators.sma3);
    });
  });

  describe("get", () => {
    it("should return specific indicator", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const tc = TrendCraft.from(candles).sma(3).ema(3);

      const sma3 = tc.get("sma3");

      expect(sma3).toBeDefined();
      expect(sma3![2].value).toBe(20);
    });

    it("should return undefined for unknown key", () => {
      const candles = makeCandles([10, 20, 30]);
      const tc = TrendCraft.from(candles).sma(3);

      expect(tc.get("unknown")).toBeUndefined();
    });
  });

  describe("clearCache", () => {
    it("should clear cached results", () => {
      const candles = makeCandles([10, 20, 30, 40, 50]);
      const tc = TrendCraft.from(candles).sma(3);

      const result1 = tc.compute();
      tc.clearCache();
      const result2 = tc.compute();

      // After clearing cache, should compute new results
      expect(result1.indicators.sma3).not.toBe(result2.indicators.sma3);
      // But values should be the same
      expect(result1.indicators.sma3).toEqual(result2.indicators.sma3);
    });
  });
});
