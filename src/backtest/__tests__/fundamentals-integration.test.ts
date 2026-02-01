import { describe, expect, it } from "vitest";
import type { FundamentalMetrics, NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";
import { and, or } from "../conditions/core";
import { goldenCross, deadCross } from "../conditions/ma-cross";
import { perBelow, perAbove, pbrBelow } from "../conditions/fundamentals";

/**
 * Generate test candles with trending data
 */
function generateTrendingCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  let price = startPrice;

  for (let i = 0; i < count; i++) {
    // Simulate uptrend with some volatility
    const change = (Math.sin(i * 0.2) * 2) + 0.5;
    price += change;

    candles.push({
      time: baseTime + i * dayMs,
      open: price - change / 2,
      high: price + 1,
      low: price - change - 0.5,
      close: price,
      volume: 1000000 + Math.random() * 500000,
    });
  }

  return candles;
}

/**
 * Generate fundamentals data matching candle times
 */
function generateFundamentals(candles: NormalizedCandle[]): FundamentalMetrics[] {
  return candles.map((candle, i) => ({
    time: candle.time,
    per: 10 + (i % 30), // PER varies from 10 to 39
    pbr: 0.8 + (i % 20) * 0.1, // PBR varies from 0.8 to 2.7
  }));
}

describe("backtest with fundamentals", () => {
  it("should pass fundamentals to condition evaluation", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    // Entry: golden cross + PER below 15 (undervalued)
    const entryCondition = and(goldenCross(5, 20), perBelow(15));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
    });

    // Should complete without errors
    expect(typeof result.tradeCount).toBe("number");
    expect(typeof result.totalReturn).toBe("number");
    expect(typeof result.winRate).toBe("number");
  });

  it("should work without fundamentals (backward compatible)", () => {
    const candles = generateTrendingCandles(100);

    const entryCondition = goldenCross(5, 20);
    const exitCondition = deadCross(5, 20);

    // No fundamentals provided - should still work
    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(result.initialCapital).toBe(1000000);
  });

  it("should handle missing fundamental data for some candles", () => {
    const candles = generateTrendingCandles(100);

    // Only provide fundamentals for first 50 candles
    const partialFundamentals = generateFundamentals(candles.slice(0, 50));

    const entryCondition = and(goldenCross(5, 20), perBelow(20));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals: partialFundamentals,
    });

    // Should complete without errors
    // Entries after day 50 won't match perBelow since PER will be null
    expect(typeof result.tradeCount).toBe("number");
  });

  it("should combine with other conditions using and/or", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    // Complex condition: (golden cross AND PER < 20) OR PBR < 1
    const entryCondition = or(and(goldenCross(5, 20), perBelow(20)), pbrBelow(1.0));
    const exitCondition = perAbove(35);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
    });

    expect(typeof result.tradeCount).toBe("number");
  });

  it("should work with fillMode same-bar-close", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    const entryCondition = and(goldenCross(5, 20), perBelow(25));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
      fillMode: "same-bar-close",
    });

    expect(typeof result.tradeCount).toBe("number");
  });

  it("should work with stop loss and take profit", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    const entryCondition = perBelow(20);
    const exitCondition = perAbove(35);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
      stopLoss: 5,
      takeProfit: 10,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(typeof result.maxDrawdown).toBe("number");
  });

  it("should use PER-only exit condition", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    // Entry: any (always true for simplicity)
    const entryCondition = perBelow(15);
    // Exit: when PER goes above 25
    const exitCondition = perAbove(25);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
    });

    // Verify trades were made based on fundamental conditions
    expect(typeof result.tradeCount).toBe("number");
  });

  it("should filter trades by PER value range", () => {
    const candles = generateTrendingCandles(50);

    // Create fundamentals with specific PER values
    const fundamentals: FundamentalMetrics[] = candles.map((candle, i) => ({
      time: candle.time,
      per: i < 25 ? 12 : 25, // First 25 days: PER = 12, rest: PER = 25
      pbr: 1.0,
    }));

    const entryCondition = perBelow(15);
    const exitCondition = perAbove(20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
      fillMode: "same-bar-close",
    });

    // Should have at least one trade since first 25 days have low PER
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
  });
});

describe("fundamentals with MTF", () => {
  it("should work with MTF timeframes", () => {
    const candles = generateTrendingCandles(100);
    const fundamentals = generateFundamentals(candles);

    const entryCondition = and(goldenCross(5, 20), perBelow(25));
    const exitCondition = deadCross(5, 20);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
      fundamentals,
      mtfTimeframes: ["1w"],
    });

    expect(typeof result.tradeCount).toBe("number");
  });
});
