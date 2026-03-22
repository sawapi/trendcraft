import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  BENCHMARK_CACHE_KEY,
  mansfieldRSAbove,
  mansfieldRSBelow,
  outperformanceAbove,
  outperformanceBelow,
  rsAbove,
  rsBelow,
  rsFalling,
  rsNewHigh,
  rsNewLow,
  rsRatingAbove,
  rsRatingBelow,
  rsRising,
  setBenchmark,
} from "../relative-strength";

// Fixed base time for consistent alignment between stock and benchmark
const BASE_TIME = new Date(2024, 0, 1).getTime();

/**
 * Generate candles with a specified trend
 */
function generateTrendingCandles(
  count: number,
  startPrice: number,
  dailyReturn: number,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price = price * (1 + dailyReturn);
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.98,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate flat candles (no trend)
 */
function generateFlatCandles(count: number, price: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];

  for (let i = 0; i < count; i++) {
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate accelerating candles (increasing daily returns)
 * This produces RS values that increase over time (for rsRising, rsNewHigh)
 */
function generateAcceleratingCandles(count: number, startPrice: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    // Accelerating return: starts small, grows larger
    const dailyReturn = 0.01 + i * 0.001;
    price = price * (1 + dailyReturn);
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.98,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate decelerating candles (worsening daily returns)
 * This produces RS values that decrease over time (for rsFalling, rsNewLow)
 */
function generateDeceleratingCandles(count: number, startPrice: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    // Decelerating return: starts okay, gets worse
    const dailyReturn = -0.005 - i * 0.0005;
    price = price * (1 + dailyReturn);
    candles.push({
      time: BASE_TIME + i * 24 * 60 * 60 * 1000,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.98,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Helper to evaluate a condition
 */
function evaluateCondition(
  condition: ReturnType<typeof rsAbove>,
  candles: NormalizedCandle[],
  benchmark: NormalizedCandle[],
  index?: number,
): boolean {
  const indicators: Record<string, unknown> = {};
  setBenchmark(indicators, benchmark);
  const idx = index ?? candles.length - 1;
  return condition.evaluate(indicators, candles[idx], idx, candles);
}

describe("RS Backtest Conditions", () => {
  describe("rsAbove / rsBelow", () => {
    it("should return true when RS is above threshold", () => {
      const stock = generateTrendingCandles(100, 100, 0.01);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsAbove(1.0, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should return false when RS is below threshold", () => {
      const stock = generateTrendingCandles(100, 100, -0.01);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsAbove(1.0, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(false);
    });

    it("should return true when RS is below threshold for rsBelow", () => {
      const stock = generateTrendingCandles(100, 100, -0.01);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsBelow(1.0, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should return false when no benchmark is set", () => {
      const stock = generateTrendingCandles(100, 100, 0.01);
      const condition = rsAbove(1.0, { period: 20 });
      const indicators: Record<string, unknown> = {};
      // No benchmark set
      const result = condition.evaluate(indicators, stock[99], 99, stock);

      expect(result).toBe(false);
    });
  });

  describe("rsRising / rsFalling", () => {
    it("should detect rising RS", () => {
      // Use accelerating returns to produce increasing RS values
      const stock = generateAcceleratingCandles(100, 100);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsRising({ period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should detect falling RS", () => {
      // Use decelerating returns to produce decreasing RS values
      const stock = generateDeceleratingCandles(100, 200);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsFalling({ period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("rsRising should return false for falling RS", () => {
      const stock = generateDeceleratingCandles(100, 200);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsRising({ period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(false);
    });
  });

  describe("rsNewHigh / rsNewLow", () => {
    it("should detect RS at new high", () => {
      // Accelerating stock vs flat benchmark = RS making new highs
      const stock = generateAcceleratingCandles(100, 100);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsNewHigh(10, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should detect RS at new low", () => {
      // Decelerating stock vs flat benchmark = RS making new lows
      const stock = generateDeceleratingCandles(100, 200);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsNewLow(10, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("rsNewHigh should return false for declining RS", () => {
      const stock = generateDeceleratingCandles(100, 200);
      const benchmark = generateFlatCandles(100, 100);
      const condition = rsNewHigh(10, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(false);
    });
  });

  describe("rsRatingAbove / rsRatingBelow", () => {
    it("should detect RS Rating above threshold", () => {
      // Accelerating stock produces increasing RS values, high rating
      const stock = generateAcceleratingCandles(150, 100);
      const benchmark = generateFlatCandles(150, 100);
      const condition = rsRatingAbove(50, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should detect RS Rating below threshold", () => {
      // Decelerating stock produces decreasing RS values, low rating
      const stock = generateDeceleratingCandles(150, 200);
      const benchmark = generateFlatCandles(150, 100);
      const condition = rsRatingBelow(50, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });
  });

  describe("mansfieldRSAbove / mansfieldRSBelow", () => {
    it("should detect Mansfield RS above threshold", () => {
      // Accelerating stock: RS > RS SMA, so Mansfield RS > 0
      const stock = generateAcceleratingCandles(150, 100);
      const benchmark = generateFlatCandles(150, 100);
      const condition = mansfieldRSAbove(0, { period: 20, smaPeriod: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should detect Mansfield RS below threshold", () => {
      // Decelerating stock: RS < RS SMA, so Mansfield RS < 0
      const stock = generateDeceleratingCandles(150, 200);
      const benchmark = generateFlatCandles(150, 100);
      const condition = mansfieldRSBelow(0, { period: 20, smaPeriod: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });
  });

  describe("outperformanceAbove / outperformanceBelow", () => {
    it("should detect outperformance above threshold", () => {
      const stock = generateTrendingCandles(100, 100, 0.01);
      const benchmark = generateFlatCandles(100, 100);
      const condition = outperformanceAbove(0, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });

    it("should detect outperformance below threshold", () => {
      const stock = generateTrendingCandles(100, 100, -0.01);
      const benchmark = generateFlatCandles(100, 100);
      const condition = outperformanceBelow(0, { period: 20 });

      expect(evaluateCondition(condition, stock, benchmark)).toBe(true);
    });
  });

  describe("setBenchmark helper", () => {
    it("should set benchmark in indicators cache", () => {
      const indicators: Record<string, unknown> = {};
      const benchmark = generateFlatCandles(100, 100);

      setBenchmark(indicators, benchmark);

      expect(indicators[BENCHMARK_CACHE_KEY]).toBe(benchmark);
    });
  });

  describe("condition names", () => {
    it("should have descriptive names", () => {
      expect(rsAbove(1.05).name).toBe("rsAbove(1.05)");
      expect(rsBelow(0.95).name).toBe("rsBelow(0.95)");
      expect(rsRising().name).toBe("rsRising()");
      expect(rsFalling().name).toBe("rsFalling()");
      expect(rsNewHigh(52).name).toBe("rsNewHigh(52)");
      expect(rsNewLow(52).name).toBe("rsNewLow(52)");
      expect(rsRatingAbove(80).name).toBe("rsRatingAbove(80)");
      expect(rsRatingBelow(20).name).toBe("rsRatingBelow(20)");
      expect(mansfieldRSAbove(5).name).toBe("mansfieldRSAbove(5)");
      expect(mansfieldRSBelow(-5).name).toBe("mansfieldRSBelow(-5)");
      expect(outperformanceAbove(10).name).toBe("outperformanceAbove(10%)");
      expect(outperformanceBelow(-10).name).toBe("outperformanceBelow(-10%)");
    });
  });
});
