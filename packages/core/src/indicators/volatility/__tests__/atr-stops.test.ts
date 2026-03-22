import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  atrStops,
  calculateAtrStop,
  calculateAtrTakeProfit,
  calculateAtrTrailingStop,
} from "../atr-stops";

// Helper to create test candles
function createCandles(data: { high: number; low: number; close: number }[]): NormalizedCandle[] {
  return data.map((d, i) => ({
    time: 1000000000000 + i * 86400000,
    open: d.close,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: 1000,
  }));
}

describe("atrStops", () => {
  describe("basic calculation", () => {
    it("should return empty array for empty input", () => {
      const result = atrStops([]);
      expect(result).toEqual([]);
    });

    it("should return null values for insufficient data", () => {
      const candles = createCandles([
        { high: 110, low: 90, close: 100 },
        { high: 112, low: 92, close: 105 },
      ]);

      const result = atrStops(candles, { period: 14 });

      // First few bars should have null values
      expect(result[0].value.atr).toBeNull();
      expect(result[0].value.longStopLevel).toBeNull();
    });

    it("should calculate stop levels correctly", () => {
      // Create enough data for calculation
      const candles = createCandles(
        Array.from({ length: 20 }, (_, i) => ({
          high: 100 + i,
          low: 98 + i,
          close: 99 + i,
        })),
      );

      const result = atrStops(candles, {
        period: 14,
        stopMultiplier: 2.0,
        takeProfitMultiplier: 3.0,
      });

      const lastResult = result[result.length - 1].value;

      expect(lastResult.atr).not.toBeNull();
      expect(lastResult.longStopLevel).not.toBeNull();
      expect(lastResult.shortStopLevel).not.toBeNull();
      expect(lastResult.longTakeProfitLevel).not.toBeNull();
      expect(lastResult.shortTakeProfitLevel).not.toBeNull();
      expect(lastResult.stopDistance).not.toBeNull();
      expect(lastResult.takeProfitDistance).not.toBeNull();
    });

    it("should calculate correct distance relationships", () => {
      const candles = createCandles(
        Array.from({ length: 20 }, (_, i) => ({
          high: 100 + i,
          low: 98 + i,
          close: 99 + i,
        })),
      );

      const result = atrStops(candles, {
        period: 14,
        stopMultiplier: 2.0,
        takeProfitMultiplier: 3.0,
      });

      const lastResult = result[result.length - 1].value;
      const lastCandle = candles[candles.length - 1];

      // Long stop should be below close
      expect(lastResult.longStopLevel!).toBeLessThan(lastCandle.close);

      // Short stop should be above close
      expect(lastResult.shortStopLevel!).toBeGreaterThan(lastCandle.close);

      // Long take profit should be above close
      expect(lastResult.longTakeProfitLevel!).toBeGreaterThan(lastCandle.close);

      // Short take profit should be below close
      expect(lastResult.shortTakeProfitLevel!).toBeLessThan(lastCandle.close);

      // Stop distance should equal ATR * stopMultiplier
      expect(lastResult.stopDistance).toBeCloseTo(lastResult.atr! * 2.0, 5);

      // Take profit distance should equal ATR * takeProfitMultiplier
      expect(lastResult.takeProfitDistance).toBeCloseTo(lastResult.atr! * 3.0, 5);
    });

    it("should respect multiplier parameters", () => {
      const candles = createCandles(
        Array.from({ length: 20 }, (_, i) => ({
          high: 100 + i,
          low: 98 + i,
          close: 99 + i,
        })),
      );

      const result1x = atrStops(candles, {
        period: 14,
        stopMultiplier: 1.0,
        takeProfitMultiplier: 1.0,
      });

      const result2x = atrStops(candles, {
        period: 14,
        stopMultiplier: 2.0,
        takeProfitMultiplier: 2.0,
      });

      const last1x = result1x[result1x.length - 1].value;
      const last2x = result2x[result2x.length - 1].value;

      // 2x multiplier should have wider stops
      expect(last2x.stopDistance!).toBeCloseTo(last1x.stopDistance! * 2, 5);
      expect(last2x.takeProfitDistance!).toBeCloseTo(last1x.takeProfitDistance! * 2, 5);
    });
  });

  describe("options validation", () => {
    it("should use default values when no options provided", () => {
      const candles = createCandles(
        Array.from({ length: 20 }, (_, i) => ({
          high: 100 + i,
          low: 98 + i,
          close: 99 + i,
        })),
      );

      const result = atrStops(candles);

      expect(result.length).toBe(20);
    });

    it("should throw error for invalid period", () => {
      const candles = createCandles([{ high: 100, low: 90, close: 95 }]);

      expect(() => atrStops(candles, { period: 0 })).toThrow();
      expect(() => atrStops(candles, { period: -1 })).toThrow();
    });

    it("should throw error for invalid stop multiplier", () => {
      const candles = createCandles([{ high: 100, low: 90, close: 95 }]);

      expect(() => atrStops(candles, { stopMultiplier: 0 })).toThrow();
      expect(() => atrStops(candles, { stopMultiplier: -1 })).toThrow();
    });

    it("should throw error for invalid take profit multiplier", () => {
      const candles = createCandles([{ high: 100, low: 90, close: 95 }]);

      expect(() => atrStops(candles, { takeProfitMultiplier: 0 })).toThrow();
      expect(() => atrStops(candles, { takeProfitMultiplier: -1 })).toThrow();
    });
  });
});

describe("calculateAtrStop", () => {
  it("should calculate long stop correctly", () => {
    const stop = calculateAtrStop(100, 5, 2.0, "long");
    expect(stop).toBe(90); // 100 - (5 * 2) = 90
  });

  it("should calculate short stop correctly", () => {
    const stop = calculateAtrStop(100, 5, 2.0, "short");
    expect(stop).toBe(110); // 100 + (5 * 2) = 110
  });
});

describe("calculateAtrTakeProfit", () => {
  it("should calculate long take profit correctly", () => {
    const tp = calculateAtrTakeProfit(100, 5, 3.0, "long");
    expect(tp).toBe(115); // 100 + (5 * 3) = 115
  });

  it("should calculate short take profit correctly", () => {
    const tp = calculateAtrTakeProfit(100, 5, 3.0, "short");
    expect(tp).toBe(85); // 100 - (5 * 3) = 85
  });
});

describe("calculateAtrTrailingStop", () => {
  it("should calculate long trailing stop correctly", () => {
    const trail = calculateAtrTrailingStop(120, 5, 2.0, "long");
    expect(trail).toBe(110); // 120 - (5 * 2) = 110
  });

  it("should calculate short trailing stop correctly", () => {
    const trail = calculateAtrTrailingStop(80, 5, 2.0, "short");
    expect(trail).toBe(90); // 80 + (5 * 2) = 90
  });
});
