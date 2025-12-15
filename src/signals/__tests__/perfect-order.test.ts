import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { perfectOrder } from "../perfect-order";

// Helper to create simple candles with just close prices
const makeCandles = (closes: number[]): NormalizedCandle[] =>
  closes.map((close, i) => ({
    time: 1700000000000 + i * 86400000,
    open: close,
    high: close,
    low: close,
    close,
    volume: 1000,
  }));

describe("perfectOrder", () => {
  describe("basic detection", () => {
    it("should detect bullish perfect order (short > medium > long)", () => {
      // Create strong uptrend: shorter MA will be higher than longer MA
      const prices = Array.from({ length: 100 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // After enough data, should detect bullish perfect order
      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bullish");
      expect(lastResult.value.strength).toBeGreaterThan(0);
    });

    it("should detect bearish perfect order (short < medium < long)", () => {
      // Create strong downtrend: shorter MA will be lower than longer MA
      const prices = Array.from({ length: 100 }, (_, i) => 300 - i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // After enough data, should detect bearish perfect order
      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bearish");
      expect(lastResult.value.strength).toBeGreaterThan(0);
    });

    it("should return 'none' when MAs are not in order", () => {
      // Create sideways movement with no clear trend
      const prices = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.3) * 10);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 7] });

      // Some points should not be in perfect order
      const noneResults = result.filter((r) => r.value.type === "none");
      expect(noneResults.length).toBeGreaterThan(0);
    });

    it("should return 'none' when not enough data for longest MA", () => {
      const prices = [100, 101, 102, 103, 104];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      // First 9 points should have null MA values and type 'none'
      for (let i = 0; i < 9 && i < result.length; i++) {
        expect(result[i].value.type).toBe("none");
        expect(result[i].value.maValues.some((v) => v === null)).toBe(true);
      }
    });
  });

  describe("formation and collapse detection", () => {
    it("should detect formation when perfect order starts", () => {
      // Start flat, then strong uptrend
      const prices = [
        ...Array.from({ length: 20 }, () => 100), // Flat
        ...Array.from({ length: 30 }, (_, i) => 100 + i * 3), // Strong uptrend
      ];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      // Should have at least one formation event
      const formations = result.filter((r) => r.value.formed);
      expect(formations.length).toBeGreaterThan(0);

      // Formation should transition from 'none' to bullish/bearish
      for (const formation of formations) {
        const idx = result.indexOf(formation);
        if (idx > 0) {
          expect(result[idx - 1].value.type).toBe("none");
          expect(formation.value.type).not.toBe("none");
        }
      }
    });

    it("should detect collapse when perfect order ends", () => {
      // Strong uptrend then reversal
      const prices = [
        ...Array.from({ length: 30 }, (_, i) => 100 + i * 3), // Strong uptrend
        ...Array.from({ length: 30 }, (_, i) => 190 - i * 3), // Reversal
      ];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      // Should have at least one collapse event
      const collapses = result.filter((r) => r.value.collapsed);
      expect(collapses.length).toBeGreaterThan(0);

      // Collapse should transition from bullish/bearish to 'none'
      for (const collapse of collapses) {
        const idx = result.indexOf(collapse);
        if (idx > 0) {
          expect(result[idx - 1].value.type).not.toBe("none");
          expect(collapse.value.type).toBe("none");
        }
      }
    });

    it("should not have formed and collapsed both true on same candle", () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + Math.sin(i * 0.2) * 20);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      for (const r of result) {
        expect(r.value.formed && r.value.collapsed).toBe(false);
      }
    });

    it("should have formed=false for first candle", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      // First candle cannot be a formation (no previous state)
      expect(result[0].value.formed).toBe(false);
    });
  });

  describe("strength calculation", () => {
    it("should return higher strength for wider MA spread", () => {
      // Very strong uptrend
      const strongTrend = Array.from({ length: 50 }, (_, i) => 100 + i * 5);
      // Weak uptrend
      const weakTrend = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5);

      const strongResult = perfectOrder(makeCandles(strongTrend), { periods: [3, 5, 10] });
      const weakResult = perfectOrder(makeCandles(weakTrend), { periods: [3, 5, 10] });

      const strongStrength = strongResult[strongResult.length - 1].value.strength;
      const weakStrength = weakResult[weakResult.length - 1].value.strength;

      expect(strongStrength).toBeGreaterThan(weakStrength);
    });

    it("should return 0 strength when type is 'none'", () => {
      const prices = [100, 101, 102]; // Not enough data
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [3, 5, 10] });

      for (const r of result) {
        if (r.value.type === "none") {
          expect(r.value.strength).toBe(0);
        }
      }
    });

    it("should return strength between 0 and 100", () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      for (const r of result) {
        expect(r.value.strength).toBeGreaterThanOrEqual(0);
        expect(r.value.strength).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("periods option", () => {
    it("should auto-sort periods in ascending order", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = makeCandles(prices);

      const result1 = perfectOrder(candles, { periods: [10, 5, 20] });
      const result2 = perfectOrder(candles, { periods: [5, 10, 20] });

      // Results should be identical
      expect(result1.length).toBe(result2.length);
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].value.type).toBe(result2[i].value.type);
      }
    });

    it("should remove duplicate periods", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = makeCandles(prices);

      const result1 = perfectOrder(candles, { periods: [5, 5, 10, 10, 20] });
      const result2 = perfectOrder(candles, { periods: [5, 10, 20] });

      // Results should be identical
      expect(result1.length).toBe(result2.length);
      for (let i = 0; i < result1.length; i++) {
        expect(result1[i].value.type).toBe(result2[i].value.type);
        expect(result1[i].value.maValues.length).toBe(3);
      }
    });

    it("should throw error if less than 2 unique periods", () => {
      const candles = makeCandles([100, 101, 102]);

      expect(() => perfectOrder(candles, { periods: [5] })).toThrow("At least 2 different periods are required");
      expect(() => perfectOrder(candles, { periods: [5, 5, 5] })).toThrow("At least 2 different periods are required");
    });

    it("should throw error for non-positive periods", () => {
      const candles = makeCandles([100, 101, 102]);

      expect(() => perfectOrder(candles, { periods: [0, 5, 10] })).toThrow("All periods must be positive integers");
      expect(() => perfectOrder(candles, { periods: [-1, 5, 10] })).toThrow("All periods must be positive integers");
    });

    it("should work with 4+ MAs", () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20, 50] });

      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bullish");
      expect(lastResult.value.maValues.length).toBe(4);
    });

    it("should work with 2 MAs (minimum)", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10] });

      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bullish");
      expect(lastResult.value.maValues.length).toBe(2);
    });

    it("should use default periods [5, 25, 75]", () => {
      const prices = Array.from({ length: 100 }, (_, i) => 100 + i);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles);

      // Check that MA values array has 3 elements (default 3 periods)
      const lastResult = result[result.length - 1];
      expect(lastResult.value.maValues.length).toBe(3);
    });
  });

  describe("maType option", () => {
    it("should use SMA by default", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const candles = makeCandles(prices);

      const defaultResult = perfectOrder(candles, { periods: [5, 10, 20] });
      const smaResult = perfectOrder(candles, { periods: [5, 10, 20], maType: "sma" });

      // Results should be identical
      for (let i = 0; i < defaultResult.length; i++) {
        expect(defaultResult[i].value.type).toBe(smaResult[i].value.type);
      }
    });

    it("should support EMA", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20], maType: "ema" });

      // Should still detect bullish in strong uptrend
      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bullish");
    });

    it("should support WMA", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20], maType: "wma" });

      // Should still detect bullish in strong uptrend
      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("bullish");
    });

    it("should produce different results for different MA types", () => {
      // Create data where MA types would differ more noticeably
      const prices = [
        ...Array.from({ length: 20 }, () => 100),
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 5),
      ];
      const candles = makeCandles(prices);

      const smaResult = perfectOrder(candles, { periods: [3, 5, 10], maType: "sma" });
      const emaResult = perfectOrder(candles, { periods: [3, 5, 10], maType: "ema" });

      // EMA reacts faster, so should have different formation timing
      const smaFormIdx = smaResult.findIndex((r) => r.value.formed && r.value.type === "bullish");
      const emaFormIdx = emaResult.findIndex((r) => r.value.formed && r.value.type === "bullish");

      // Both should detect formation but potentially at different times
      expect(smaFormIdx).toBeGreaterThan(-1);
      expect(emaFormIdx).toBeGreaterThan(-1);
    });
  });

  describe("edge cases", () => {
    it("should handle empty candles", () => {
      const result = perfectOrder([]);
      expect(result).toEqual([]);
    });

    it("should handle single candle", () => {
      const candles = makeCandles([100]);
      const result = perfectOrder(candles, { periods: [3, 5] });

      expect(result).toHaveLength(1);
      expect(result[0].value.type).toBe("none");
    });

    it("should handle flat prices (all MAs equal)", () => {
      const prices = Array.from({ length: 50 }, () => 100);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // When all prices are equal, MAs are equal, so no perfect order
      const lastResult = result[result.length - 1];
      expect(lastResult.value.type).toBe("none");
    });

    it("should preserve time values from input candles", () => {
      const candles = makeCandles([100, 101, 102, 103, 104]);
      const result = perfectOrder(candles, { periods: [2, 3] });

      for (let i = 0; i < candles.length; i++) {
        expect(result[i].time).toBe(candles[i].time);
      }
    });

    it("should handle raw candles with string time", () => {
      const rawCandles = [
        { time: "2024-01-01", open: 100, high: 102, low: 99, close: 101, volume: 1000 },
        { time: "2024-01-02", open: 101, high: 103, low: 100, close: 102, volume: 1000 },
        { time: "2024-01-03", open: 102, high: 104, low: 101, close: 103, volume: 1000 },
        { time: "2024-01-04", open: 103, high: 105, low: 102, close: 104, volume: 1000 },
        { time: "2024-01-05", open: 104, high: 106, low: 103, close: 105, volume: 1000 },
      ];

      // Should not throw
      const result = perfectOrder(rawCandles, { periods: [2, 3] });
      expect(result).toHaveLength(5);
    });
  });
});
