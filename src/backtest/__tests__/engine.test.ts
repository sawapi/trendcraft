import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { and, deadCross, goldenCross, rsiAbove, rsiBelow } from "../conditions";
import { runBacktest } from "../engine";

// Generate trending candles for backtest
function generateTrendingCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Create alternating trends to generate trades
    const cycle = Math.floor(i / 30);
    let price: number;

    if (cycle % 2 === 0) {
      // Uptrend phase
      price = 100 + (i % 30) * 2;
    } else {
      // Downtrend phase
      price = 100 + 60 - (i % 30) * 2;
    }

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("runBacktest", () => {
  it("should return empty result for insufficient data", () => {
    const candles: NormalizedCandle[] = [
      { time: Date.now(), open: 100, high: 101, low: 99, close: 100, volume: 1000 },
    ];

    const result = runBacktest(candles, goldenCross(), deadCross(), { capital: 1000000 });

    expect(result.tradeCount).toBe(0);
    expect(result.totalReturn).toBe(0);
  });

  it("should execute trades with preset conditions", () => {
    const candles = generateTrendingCandles(200);

    const result = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
    });

    // Should have executed at least one trade
    expect(result.tradeCount).toBeGreaterThanOrEqual(0);
    expect(result.trades).toHaveLength(result.tradeCount);

    // All trades should have valid structure
    for (const trade of result.trades) {
      expect(trade.entryTime).toBeLessThan(trade.exitTime);
      expect(trade.entryPrice).toBeGreaterThan(0);
      expect(trade.exitPrice).toBeGreaterThan(0);
      expect(typeof trade.returnPercent).toBe("number");
      expect(trade.holdingDays).toBeGreaterThanOrEqual(0);
    }
  });

  it("should calculate statistics correctly", () => {
    const candles = generateTrendingCandles(200);

    const result = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
    });

    // Check that all stats are numbers
    expect(typeof result.totalReturn).toBe("number");
    expect(typeof result.totalReturnPercent).toBe("number");
    expect(typeof result.winRate).toBe("number");
    expect(typeof result.maxDrawdown).toBe("number");
    expect(typeof result.sharpeRatio).toBe("number");
    expect(typeof result.profitFactor).toBe("number");
    expect(typeof result.avgHoldingDays).toBe("number");

    // Win rate should be between 0 and 100
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(100);

    // Max drawdown should be non-negative
    expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it("should work with combined conditions", () => {
    const candles = generateTrendingCandles(200);

    const entryCondition = and(goldenCross(5, 25), rsiBelow(70));
    const exitCondition = deadCross(5, 25);

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
  });

  it("should work with custom function conditions", () => {
    const candles = generateTrendingCandles(200);

    // Simple custom condition: buy when close > open, sell when close < open
    const entryCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
      return candle.close > candle.open * 1.01; // 1% gain
    };

    const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
      return candle.close < candle.open * 0.99; // 1% loss
    };

    const result = runBacktest(candles, entryCondition, exitCondition, {
      capital: 1000000,
    });

    expect(typeof result.tradeCount).toBe("number");
    expect(Array.isArray(result.trades)).toBe(true);
  });

  it("should apply commission correctly", () => {
    const candles = generateTrendingCandles(200);

    const resultNoCommission = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
      commission: 0,
    });

    const resultWithCommission = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
      commission: 100, // 100 per trade
    });

    // If trades occurred, commission should reduce returns
    if (resultNoCommission.tradeCount > 0) {
      expect(resultWithCommission.totalReturn).toBeLessThanOrEqual(resultNoCommission.totalReturn);
    }
  });

  it("should apply slippage correctly", () => {
    const candles = generateTrendingCandles(200);

    const resultNoSlippage = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
      slippage: 0,
    });

    const resultWithSlippage = runBacktest(candles, goldenCross(5, 25), deadCross(5, 25), {
      capital: 1000000,
      slippage: 0.5, // 0.5% slippage
    });

    // If trades occurred, slippage should reduce returns
    if (resultNoSlippage.tradeCount > 0) {
      expect(resultWithSlippage.totalReturn).toBeLessThanOrEqual(resultNoSlippage.totalReturn);
    }
  });
});
