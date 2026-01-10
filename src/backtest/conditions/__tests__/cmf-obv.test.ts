import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { cmfAbove, cmfBelow, obvRising, obvFalling, obvCrossUp, obvCrossDown } from "../volume-advanced";
import { and } from "../core";
import { runBacktest } from "../../engine";
import { goldenCross, deadCross } from "../ma-cross";

/**
 * Generate candles with accumulation pattern
 * - Price relatively flat
 * - Volume increasing
 * - Closes near highs (positive CMF)
 */
function generateAccumulationCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const basePrice = 100;

  for (let i = 0; i < count; i++) {
    // Slight upward drift
    const price = basePrice + i * 0.1;
    // Close near highs (positive CMF)
    const high = price + 2;
    const low = price - 1;
    const close = price + 1.5; // Close near high

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price,
      high,
      low,
      close,
      volume: 1000000 + i * 50000, // Increasing volume
    });
  }

  return candles;
}

/**
 * Generate candles with distribution pattern
 * - Price relatively flat or declining
 * - Closes near lows (negative CMF)
 */
function generateDistributionCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  const basePrice = 100;

  for (let i = 0; i < count; i++) {
    // Slight downward drift
    const price = basePrice - i * 0.1;
    // Close near lows (negative CMF)
    const high = price + 1;
    const low = price - 2;
    const close = price - 1.5; // Close near low

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price,
      high,
      low,
      close,
      volume: 1000000 + i * 50000,
    });
  }

  return candles;
}

/**
 * Generate candles with rising OBV (more up closes than down)
 */
function generateRisingObvCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = 100;

  for (let i = 0; i < count; i++) {
    // 70% up days, 30% down days
    const isUp = i % 10 < 7;
    const change = isUp ? 1 : -0.5;
    price += change;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - change,
      high: price + 0.5,
      low: price - change - 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate candles with falling OBV (more down closes than up)
 */
function generateFallingObvCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = 100;

  for (let i = 0; i < count; i++) {
    // 30% up days, 70% down days
    const isUp = i % 10 < 3;
    const change = isUp ? 0.5 : -1;
    price += change;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - change,
      high: price + 0.5,
      low: price - change - 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("CMF Conditions", () => {
  describe("cmfAbove", () => {
    it("should return true when CMF is above threshold", () => {
      const candles = generateAccumulationCandles(30);
      const condition = cmfAbove(0, 20);
      const indicators: Record<string, unknown> = {};

      // Check the last candle
      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      // Accumulation pattern should have positive CMF
      expect(result).toBe(true);
    });

    it("should return false when CMF is below threshold", () => {
      const candles = generateDistributionCandles(30);
      const condition = cmfAbove(0, 20);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      // Distribution pattern should have negative CMF
      expect(result).toBe(false);
    });

    it("should cache CMF data", () => {
      const candles = generateAccumulationCandles(30);
      const condition = cmfAbove(0, 20);
      const indicators: Record<string, unknown> = {};

      // First call
      condition.evaluate(indicators, candles[29], 29, candles);
      expect(indicators["cmf_20"]).toBeDefined();

      // Second call should use cached data
      const cachedData = indicators["cmf_20"];
      condition.evaluate(indicators, candles[29], 29, candles);
      expect(indicators["cmf_20"]).toBe(cachedData);
    });

    it("should work with different thresholds", () => {
      const candles = generateAccumulationCandles(30);
      const indicators: Record<string, unknown> = {};

      // Strong accumulation threshold
      const strongCondition = cmfAbove(0.1, 20);
      const result = strongCondition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      // Result depends on actual CMF value
      expect(typeof result).toBe("boolean");
    });
  });

  describe("cmfBelow", () => {
    it("should return true when CMF is below threshold", () => {
      const candles = generateDistributionCandles(30);
      const condition = cmfBelow(0, 20);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      // Distribution pattern should have negative CMF
      expect(result).toBe(true);
    });

    it("should return false when CMF is above threshold", () => {
      const candles = generateAccumulationCandles(30);
      const condition = cmfBelow(0, 20);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      // Accumulation pattern should have positive CMF
      expect(result).toBe(false);
    });
  });
});

describe("OBV Conditions", () => {
  describe("obvRising", () => {
    it("should return true when OBV is rising", () => {
      const candles = generateRisingObvCandles(30);
      const condition = obvRising(10);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(true);
    });

    it("should return false when OBV is falling", () => {
      const candles = generateFallingObvCandles(30);
      const condition = obvRising(10);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(false);
    });

    it("should return false for insufficient data", () => {
      const candles = generateRisingObvCandles(5);
      const condition = obvRising(10);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(false);
    });

    it("should cache OBV data", () => {
      const candles = generateRisingObvCandles(30);
      const condition = obvRising(10);
      const indicators: Record<string, unknown> = {};

      condition.evaluate(indicators, candles[29], 29, candles);
      expect(indicators["obv"]).toBeDefined();
    });
  });

  describe("obvFalling", () => {
    it("should return true when OBV is falling", () => {
      const candles = generateFallingObvCandles(30);
      const condition = obvFalling(10);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(true);
    });

    it("should return false when OBV is rising", () => {
      const candles = generateRisingObvCandles(30);
      const condition = obvFalling(10);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(false);
    });
  });

  describe("obvCrossUp", () => {
    it("should return condition with correct name", () => {
      const condition = obvCrossUp(5, 20);
      expect(condition.name).toBe("obvCrossUp(5,20)");
    });

    it("should return false for insufficient data", () => {
      const candles = generateRisingObvCandles(5);
      const condition = obvCrossUp(5, 20);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(
        indicators,
        candles[candles.length - 1],
        candles.length - 1,
        candles
      );

      expect(result).toBe(false);
    });

    it("should cache OBV MA data", () => {
      const candles = generateRisingObvCandles(50);
      const condition = obvCrossUp(5, 20);
      const indicators: Record<string, unknown> = {};

      condition.evaluate(indicators, candles[49], 49, candles);
      expect(indicators["obvMa_5_20"]).toBeDefined();
    });
  });

  describe("obvCrossDown", () => {
    it("should return condition with correct name", () => {
      const condition = obvCrossDown(5, 20);
      expect(condition.name).toBe("obvCrossDown(5,20)");
    });

    it("should return false at index 0", () => {
      const candles = generateFallingObvCandles(50);
      const condition = obvCrossDown(5, 20);
      const indicators: Record<string, unknown> = {};

      const result = condition.evaluate(indicators, candles[0], 0, candles);
      expect(result).toBe(false);
    });
  });
});

describe("CMF + OBV Combined Strategy", () => {
  it("should work in backtest with CMF condition", () => {
    const candles = generateAccumulationCandles(100);

    const entryCondition = and(goldenCross(5, 20), cmfAbove(0, 20));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(typeof result.totalReturn).toBe("number");
  });

  it("should work in backtest with OBV condition", () => {
    const candles = generateRisingObvCandles(100);

    const entryCondition = and(goldenCross(5, 20), obvRising(10));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(typeof result.totalReturn).toBe("number");
  });

  it("should work with full accumulation strategy", () => {
    const candles = generateAccumulationCandles(100);

    // Full accumulation detection strategy
    const entryCondition = and(cmfAbove(0, 20), obvRising(10));
    const exitCondition = cmfBelow(0, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(typeof result.totalReturn).toBe("number");
    expect(typeof result.winRate).toBe("number");
  });
});
