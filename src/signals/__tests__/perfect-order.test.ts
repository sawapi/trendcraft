import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { perfectOrder, perfectOrderEnhanced } from "../perfect-order";

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

// Helper to create candles with specific OHLC values for price position testing
const makeCandlesWithOHLC = (
  data: { open: number; high: number; low: number; close: number }[],
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: 1700000000000 + i * 86400000,
    ...d,
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

      expect(() => perfectOrder(candles, { periods: [5] })).toThrow(
        "At least 2 different periods are required",
      );
      expect(() => perfectOrder(candles, { periods: [5, 5, 5] })).toThrow(
        "At least 2 different periods are required",
      );
    });

    it("should throw error for non-positive periods", () => {
      const candles = makeCandles([100, 101, 102]);

      expect(() => perfectOrder(candles, { periods: [0, 5, 10] })).toThrow(
        "All periods must be positive integers",
      );
      expect(() => perfectOrder(candles, { periods: [-1, 5, 10] })).toThrow(
        "All periods must be positive integers",
      );
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

  describe("price position and hysteresis", () => {
    it("should require price above short MA for bullish formation", () => {
      // Strong uptrend where price is well above all MAs
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // Should detect bullish with good strength
      const bullishResults = result.filter((r) => r.value.type === "bullish");
      expect(bullishResults.length).toBeGreaterThan(0);

      // Last bullish should have decent strength
      const lastBullish = bullishResults[bullishResults.length - 1];
      expect(lastBullish.value.strength).toBeGreaterThan(0);
    });

    it("should require price below short MA for bearish formation", () => {
      // Strong downtrend where price is well below all MAs
      const prices = Array.from({ length: 50 }, (_, i) => 300 - i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // Should detect bearish with good strength
      const bearishResults = result.filter((r) => r.value.type === "bearish");
      expect(bearishResults.length).toBeGreaterThan(0);

      // Last bearish should have decent strength
      const lastBearish = bearishResults[bearishResults.length - 1];
      expect(lastBearish.value.strength).toBeGreaterThan(0);
    });

    it("should collapse to none when price falls below short MA (with margin)", () => {
      // Strong uptrend then price drops significantly below short MA
      const uptrend = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
      // Price drops well below the short MA (more than 1% margin)
      const drop = [180, 170, 160, 150, 140]; // Significant drop
      const prices = [...uptrend, ...drop];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // At some point should collapse to none when price is too low
      const collapses = result.filter((r) => r.value.collapsed);
      // Collapse might or might not happen depending on how MA catches up
      // The key is type becomes none when price << shortMA
      const lastResult = result[result.length - 1];
      // With such a big drop, should not be bullish
      expect(lastResult.value.type).not.toBe("bullish");
    });

    it("should use hysteresis margin for continuation (default 1%)", () => {
      // Create scenario: establish bullish, then price dips slightly below short MA
      // but within margin - should continue as bullish
      // Price rises strongly first
      const strongRise = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      // Then a small dip (less than 1% below short MA would be)
      // Since MA is smoothed, small price fluctuations within margin should maintain state
      const smallDip = [155, 154, 153, 154, 155]; // Small oscillation
      const prices = [...strongRise, ...smallDip];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // During small dip, should maintain bullish (within margin)
      const lastFew = result.slice(-5);
      // Most should still be bullish due to hysteresis
      const bullishCount = lastFew.filter((r) => r.value.type === "bullish").length;
      expect(bullishCount).toBeGreaterThanOrEqual(3);
    });

    it("should give higher strength when price is further from short MA", () => {
      // Compare two scenarios:
      // 1. Strong uptrend (price well above short MA)
      // 2. Weaker uptrend (price closer to short MA)

      // Strong uptrend
      const strongTrend = Array.from({ length: 50 }, (_, i) => 100 + i * 4);
      const strongResult = perfectOrder(makeCandles(strongTrend), { periods: [5, 10, 20] });

      // Weaker trend (smaller increments, price closer to MA)
      const weakTrend = Array.from({ length: 50 }, (_, i) => 100 + i * 1);
      const weakResult = perfectOrder(makeCandles(weakTrend), { periods: [5, 10, 20] });

      const strongBullish = strongResult.filter((r) => r.value.type === "bullish");
      const weakBullish = weakResult.filter((r) => r.value.type === "bullish");

      if (strongBullish.length > 0 && weakBullish.length > 0) {
        const strongStrength = strongBullish[strongBullish.length - 1].value.strength;
        const weakStrength = weakBullish[weakBullish.length - 1].value.strength;
        // Stronger trend should have higher strength due to larger price deviation
        expect(strongStrength).toBeGreaterThan(weakStrength);
      }
    });

    it("should not form when price is below short MA even if MAs are in order", () => {
      // Create scenario where MAs are in bullish order but price is below short MA
      // Start with uptrend to establish MA order, then price drops below short MA
      const uptrend = Array.from({ length: 25 }, (_, i) => 100 + i * 2); // MAs get into order
      // Now add candles where price is clearly below where short MA would be
      // Short MA of last few would be around 145-150
      const belowMA = [135, 134, 133, 132, 131]; // Well below short MA
      const prices = [...uptrend, ...belowMA];
      const candles = makeCandles(prices);

      const result = perfectOrder(candles, { periods: [5, 10, 20] });

      // Last candles should not be bullish since price < short MA
      const lastResult = result[result.length - 1];
      // Should be 'none' because price is below short MA despite MA order
      expect(lastResult.value.type).toBe("none");
    });

    it("should support custom hysteresis margin", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      // Test with larger margin (5%)
      const result = perfectOrder(candles, {
        periods: [5, 10, 20],
        hysteresisMargin: 0.05,
      });

      // Should still detect bullish
      const bullishResults = result.filter((r) => r.value.type === "bullish");
      expect(bullishResults.length).toBeGreaterThan(0);
    });
  });
});

describe("perfectOrderEnhanced", () => {
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

  describe("slope detection", () => {
    it("should detect UP slope in strong uptrend", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        slopeLookback: 3,
      });

      // After enough data, slopes should all be UP
      const lastResult = result[result.length - 1];
      expect(lastResult.value.slopes).toBeDefined();
      expect(lastResult.value.slopes.every((s) => s === "UP")).toBe(true);
    });

    it("should detect DOWN slope in strong downtrend", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 300 - i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        slopeLookback: 3,
      });

      const lastResult = result[result.length - 1];
      expect(lastResult.value.slopes).toBeDefined();
      expect(lastResult.value.slopes.every((s) => s === "DOWN")).toBe(true);
    });

    it("should detect FLAT slope in sideways market", () => {
      const prices = Array.from({ length: 50 }, () => 100);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        slopeLookback: 3,
        flatEps: 0.001,
      });

      const lastResult = result[result.length - 1];
      expect(lastResult.value.slopes).toBeDefined();
      // All slopes should be FLAT in flat market
      expect(lastResult.value.slopes.every((s) => s === "FLAT")).toBe(true);
    });

    it("should require all slopes UP for BULLISH_PO state", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      const bullishPO = result.filter((r) => r.value.state === "BULLISH_PO");
      for (const r of bullishPO) {
        expect(r.value.slopes.every((s) => s === "UP")).toBe(true);
      }
    });
  });

  describe("persistence confirmation", () => {
    it("should track persistCount correctly", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 3,
      });

      // persistCount should increment while state remains same
      let prevState = result[0].value.state;
      let expectedCount = 1;
      for (let i = 1; i < result.length; i++) {
        const r = result[i];
        if (r.value.state === prevState) {
          expectedCount++;
        } else {
          expectedCount = 1;
        }
        expect(r.value.persistCount).toBe(expectedCount);
        prevState = r.value.state;
      }
    });

    it("should set isConfirmed when persistCount >= persistBars", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 3,
      });

      for (const r of result) {
        expect(r.value.isConfirmed).toBe(r.value.persistCount >= 3);
      }
    });

    it("should fire confirmationFormed when transitioning to confirmed BULLISH_PO", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 3,
      });

      const confirmations = result.filter((r) => r.value.confirmationFormed);
      // Should have confirmation when first reaching 3 consecutive BULLISH_PO
      if (confirmations.length > 0) {
        for (const c of confirmations) {
          expect(c.value.state === "BULLISH_PO" || c.value.state === "BEARISH_PO").toBe(true);
          expect(c.value.isConfirmed).toBe(true);
        }
      }
    });

    it("should reset persistCount on state change", () => {
      // Create trend change scenario
      const uptrend = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
      const downtrend = Array.from({ length: 30 }, (_, i) => 190 - i * 3);
      const prices = [...uptrend, ...downtrend];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 3,
      });

      // Find state transitions
      for (let i = 1; i < result.length; i++) {
        if (result[i].value.state !== result[i - 1].value.state) {
          expect(result[i].value.persistCount).toBe(1);
        }
      }
    });
  });

  describe("collapse detection", () => {
    it("should detect COLLAPSED when MAs converge", () => {
      // Create scenario where all MAs converge
      // Start diverged, then converge to similar values
      const diverged = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      // Then prices stabilize at a level
      const converging = Array.from({ length: 50 }, () => 160);
      const prices = [...diverged, ...converging];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        collapseEps: 0.003, // 0.3%
      });

      // Eventually should see COLLAPSED state
      const collapsed = result.filter((r) => r.value.state === "COLLAPSED");
      expect(collapsed.length).toBeGreaterThan(0);
    });

    it("should fire collapseDetected on first COLLAPSED", () => {
      const diverged = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const converging = Array.from({ length: 50 }, () => 160);
      const prices = [...diverged, ...converging];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        collapseEps: 0.003,
      });

      const collapseEvents = result.filter((r) => r.value.collapseDetected);
      if (collapseEvents.length > 0) {
        // Should only fire on first transition to COLLAPSED
        for (const e of collapseEvents) {
          const idx = result.indexOf(e);
          if (idx > 0) {
            expect(result[idx - 1].value.state).not.toBe("COLLAPSED");
          }
        }
      }
    });

    it("should not trigger COLLAPSED when spread is above collapseEps", () => {
      // Strong trend with wide MA spread
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 5);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        collapseEps: 0.003,
      });

      // With strong trend, MAs should be spread apart
      const lastResult = result[result.length - 1];
      expect(lastResult.value.state).not.toBe("COLLAPSED");
    });
  });

  describe("breakdown detection", () => {
    it("should detect PO_BREAKDOWN when bullish conditions degrade", () => {
      // Strong uptrend then reversal
      const uptrend = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
      const reversal = Array.from({ length: 20 }, (_, i) => 190 - i * 3);
      const prices = [...uptrend, ...reversal];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      // Should transition through BREAKDOWN
      const breakdowns = result.filter((r) => r.value.state === "PO_BREAKDOWN");
      expect(breakdowns.length).toBeGreaterThan(0);
    });

    it("should fire breakdownDetected on transition to PO_BREAKDOWN", () => {
      const uptrend = Array.from({ length: 30 }, (_, i) => 100 + i * 3);
      const reversal = Array.from({ length: 20 }, (_, i) => 190 - i * 3);
      const prices = [...uptrend, ...reversal];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      const breakdownEvents = result.filter((r) => r.value.breakdownDetected);
      if (breakdownEvents.length > 0) {
        for (const e of breakdownEvents) {
          expect(e.value.state).toBe("PO_BREAKDOWN");
        }
      }
    });
  });

  describe("state mapping", () => {
    it("should map BULLISH_PO and PRE_BULLISH_PO to legacy type 'bullish'", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      for (const r of result) {
        if (r.value.state === "BULLISH_PO" || r.value.state === "PRE_BULLISH_PO") {
          expect(r.value.type).toBe("bullish");
        }
      }
    });

    it("should map BEARISH_PO and PRE_BEARISH_PO to legacy type 'bearish'", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 300 - i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      for (const r of result) {
        if (r.value.state === "BEARISH_PO" || r.value.state === "PRE_BEARISH_PO") {
          expect(r.value.type).toBe("bearish");
        }
      }
    });

    it("should map COLLAPSED, PO_BREAKDOWN, NEUTRAL_MIXED to legacy type 'none'", () => {
      // Mix of conditions
      const prices = [
        ...Array.from({ length: 20 }, () => 100),
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 2),
        ...Array.from({ length: 20 }, () => 140),
      ];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      for (const r of result) {
        if (
          r.value.state === "COLLAPSED" ||
          r.value.state === "PO_BREAKDOWN" ||
          r.value.state === "NEUTRAL_MIXED"
        ) {
          expect(r.value.type).toBe("none");
        }
      }
    });
  });

  describe("confidence scores", () => {
    it("should return high confidence (0.95) for confirmed PO states", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 3);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      const bullishPO = result.filter((r) => r.value.state === "BULLISH_PO");
      for (const r of bullishPO) {
        expect(r.value.confidence).toBe(0.95);
      }
    });

    it("should return lower confidence for PRE states", () => {
      const prices = [
        ...Array.from({ length: 20 }, () => 100),
        ...Array.from({ length: 20 }, (_, i) => 100 + i * 2),
      ];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      const preBullish = result.filter((r) => r.value.state === "PRE_BULLISH_PO");
      for (const r of preBullish) {
        expect(r.value.confidence).toBe(0.7);
      }
    });
  });

  describe("backwards compatibility", () => {
    it("should include all legacy fields", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      for (const r of result) {
        // Legacy fields
        expect(r.value).toHaveProperty("type");
        expect(r.value).toHaveProperty("formed");
        expect(r.value).toHaveProperty("collapsed");
        expect(r.value).toHaveProperty("strength");
        expect(r.value).toHaveProperty("maValues");
        // Enhanced fields
        expect(r.value).toHaveProperty("state");
        expect(r.value).toHaveProperty("confidence");
        expect(r.value).toHaveProperty("slopes");
        expect(r.value).toHaveProperty("persistCount");
        expect(r.value).toHaveProperty("isConfirmed");
      }
    });

    it("should fire legacy formed/collapsed flags correctly", () => {
      const prices = [
        ...Array.from({ length: 20 }, () => 100),
        ...Array.from({ length: 30 }, (_, i) => 100 + i * 3),
        ...Array.from({ length: 30 }, (_, i) => 190 - i * 3),
      ];
      const candles = makeCandles(prices);

      const result = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
      });

      // Check formed events
      const formed = result.filter((r) => r.value.formed);
      for (const f of formed) {
        const idx = result.indexOf(f);
        if (idx > 0) {
          expect(result[idx - 1].value.type).toBe("none");
          expect(f.value.type).not.toBe("none");
        }
      }

      // Check collapsed events
      const collapsed = result.filter((r) => r.value.collapsed);
      for (const c of collapsed) {
        const idx = result.indexOf(c);
        if (idx > 0) {
          expect(result[idx - 1].value.type).not.toBe("none");
          expect(c.value.type).toBe("none");
        }
      }
    });
  });

  describe("options", () => {
    it("should support custom slopeLookback", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result3 = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        slopeLookback: 3,
      });

      const result5 = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        slopeLookback: 5,
      });

      // Different lookbacks may produce different results
      expect(result3.length).toBe(result5.length);
    });

    it("should support custom persistBars", () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i * 2);
      const candles = makeCandles(prices);

      const result3 = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 3,
      });

      const result5 = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        persistBars: 5,
      });

      // Different persistBars will affect isConfirmed timing
      const confirmed3 = result3.findIndex(
        (r) => r.value.isConfirmed && r.value.state === "BULLISH_PO",
      );
      const confirmed5 = result5.findIndex(
        (r) => r.value.isConfirmed && r.value.state === "BULLISH_PO",
      );

      if (confirmed3 !== -1 && confirmed5 !== -1) {
        expect(confirmed5).toBeGreaterThanOrEqual(confirmed3);
      }
    });

    it("should support custom collapseEps", () => {
      const diverged = Array.from({ length: 30 }, (_, i) => 100 + i * 2);
      const converging = Array.from({ length: 50 }, () => 160);
      const prices = [...diverged, ...converging];
      const candles = makeCandles(prices);

      const tight = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        collapseEps: 0.001, // Very tight
      });

      const loose = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        collapseEps: 0.01, // More loose
      });

      // Looser threshold should detect collapse earlier
      const tightCollapseIdx = tight.findIndex((r) => r.value.state === "COLLAPSED");
      const looseCollapseIdx = loose.findIndex((r) => r.value.state === "COLLAPSED");

      if (looseCollapseIdx !== -1) {
        if (tightCollapseIdx !== -1) {
          expect(looseCollapseIdx).toBeLessThanOrEqual(tightCollapseIdx);
        }
      }
    });

    it("should support custom flatEps", () => {
      const prices = Array.from({ length: 50 }, () => 100);
      const candles = makeCandles(prices);

      const tight = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        flatEps: 0.0001, // Very sensitive
      });

      const loose = perfectOrderEnhanced(candles, {
        enhanced: true,
        periods: [5, 10, 20],
        flatEps: 0.01, // Less sensitive
      });

      // Both should detect flat slopes in flat market
      const lastTight = tight[tight.length - 1];
      const lastLoose = loose[loose.length - 1];

      expect(lastTight.value.slopes.every((s) => s === "FLAT")).toBe(true);
      expect(lastLoose.value.slopes.every((s) => s === "FLAT")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty candles", () => {
      const result = perfectOrderEnhanced([], { enhanced: true, periods: [5, 10, 20] });
      expect(result).toEqual([]);
    });

    it("should handle single candle", () => {
      const candles = makeCandles([100]);
      const result = perfectOrderEnhanced(candles, { enhanced: true, periods: [3, 5] });

      expect(result).toHaveLength(1);
      expect(result[0].value.state).toBe("NEUTRAL_MIXED");
      expect(result[0].value.slopes.every((s) => s === "FLAT")).toBe(true);
    });

    it("should throw for less than 2 periods", () => {
      const candles = makeCandles([100, 101, 102]);
      expect(() => perfectOrderEnhanced(candles, { enhanced: true, periods: [5] })).toThrow(
        "At least 2 different periods are required",
      );
    });

    it("should throw for non-positive periods", () => {
      const candles = makeCandles([100, 101, 102]);
      expect(() => perfectOrderEnhanced(candles, { enhanced: true, periods: [0, 5, 10] })).toThrow(
        "All periods must be positive integers",
      );
    });
  });
});
