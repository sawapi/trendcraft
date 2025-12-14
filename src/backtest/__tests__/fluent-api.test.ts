import { describe, it, expect } from "vitest";
import { TrendCraft } from "../../core/trendcraft";
import { goldenCross, deadCross, and, or, rsiBelow, rsiAbove } from "../conditions";
import type { NormalizedCandle } from "../../types";

// Generate trending candles for testing
function generateTrendingCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // Create alternating trends
    const cycle = Math.floor(i / 30);
    let price: number;

    if (cycle % 2 === 0) {
      price = 100 + (i % 30) * 2;
    } else {
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

describe("TrendCraft Fluent API - Strategy Builder", () => {
  const candles = generateTrendingCandles(200);

  describe("strategy()", () => {
    it("should return a StrategyBuilder instance", () => {
      const builder = TrendCraft.from(candles).strategy();
      expect(builder).toBeDefined();
      expect(typeof builder.entry).toBe("function");
      expect(typeof builder.exit).toBe("function");
      expect(typeof builder.backtest).toBe("function");
    });

    it("should chain entry and exit conditions", () => {
      const builder = TrendCraft.from(candles)
        .strategy()
        .entry(goldenCross())
        .exit(deadCross());

      expect(builder).toBeDefined();
    });
  });

  describe("backtest()", () => {
    it("should throw error if entry condition is missing", () => {
      expect(() => {
        TrendCraft.from(candles)
          .strategy()
          .exit(deadCross())
          .backtest({ capital: 1000000 });
      }).toThrow("Entry condition is required");
    });

    it("should throw error if exit condition is missing", () => {
      expect(() => {
        TrendCraft.from(candles)
          .strategy()
          .entry(goldenCross())
          .backtest({ capital: 1000000 });
      }).toThrow("Exit condition is required");
    });

    it("should run backtest with simple preset conditions", () => {
      const result = TrendCraft.from(candles)
        .strategy()
        .entry(goldenCross())
        .exit(deadCross())
        .backtest({ capital: 1000000 });

      expect(result).toBeDefined();
      expect(typeof result.totalReturn).toBe("number");
      expect(typeof result.totalReturnPercent).toBe("number");
      expect(typeof result.tradeCount).toBe("number");
      expect(typeof result.winRate).toBe("number");
      expect(Array.isArray(result.trades)).toBe(true);
    });

    it("should run backtest with AND combined conditions", () => {
      const result = TrendCraft.from(candles)
        .strategy()
        .entry(and(goldenCross(), rsiBelow(70)))
        .exit(or(deadCross(), rsiAbove(80)))
        .backtest({ capital: 1000000 });

      expect(result).toBeDefined();
      expect(typeof result.tradeCount).toBe("number");
    });

    it("should run backtest with custom function conditions", () => {
      const result = TrendCraft.from(candles)
        .strategy()
        .entry((_indicators, candle) => candle.close > candle.open)
        .exit((_indicators, candle) => candle.close < candle.open)
        .backtest({ capital: 1000000 });

      expect(result).toBeDefined();
      expect(typeof result.tradeCount).toBe("number");
    });

    it("should respect backtest options", () => {
      const result = TrendCraft.from(candles)
        .strategy()
        .entry(goldenCross())
        .exit(deadCross())
        .backtest({
          capital: 500000,
          commission: 50,
          slippage: 0.1,
        });

      expect(result).toBeDefined();
    });
  });

  describe("Integration with indicators", () => {
    it("should work after resampling", () => {
      // Generate more candles for resampling
      const manyCandles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 500 * 24 * 60 * 60 * 1000;

      for (let i = 0; i < 500; i++) {
        const cycle = Math.floor(i / 50);
        const price = 100 + (cycle % 2 === 0 ? (i % 50) : 50 - (i % 50));

        manyCandles.push({
          time: baseTime + i * 24 * 60 * 60 * 1000,
          open: price - 0.5,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 1000000,
        });
      }

      const result = TrendCraft.from(manyCandles)
        .resample("weekly")
        .strategy()
        .entry(goldenCross(2, 10))
        .exit(deadCross(2, 10))
        .backtest({ capital: 1000000 });

      expect(result).toBeDefined();
      expect(typeof result.tradeCount).toBe("number");
    });
  });
});
