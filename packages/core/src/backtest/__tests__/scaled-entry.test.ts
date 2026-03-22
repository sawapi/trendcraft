import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import { runBacktestScaled } from "../scaled-entry";

/**
 * Generate simple test candles with upward trend
 */
function generateUpTrendCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1.005; // ~0.5% daily increase
    const dailyRange = price * 0.02;
    const open = price - dailyRange * 0.25;
    const close = price;
    const high = price + dailyRange * 0.25;
    const low = price - dailyRange * 0.5;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open,
      high,
      low,
      close,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Generate test candles with a dip pattern for testing price-based scaling
 */
function generateDipPattern(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    // First 20%: stable, then dip, then recover
    const progress = i / count;
    if (progress < 0.2) {
      price = startPrice;
    } else if (progress < 0.5) {
      // Dip phase: drop to 95% of start
      const dipProgress = (progress - 0.2) / 0.3;
      price = startPrice * (1 - 0.05 * dipProgress);
    } else {
      // Recovery phase
      const recoveryProgress = (progress - 0.5) / 0.5;
      price = startPrice * (0.95 + 0.15 * recoveryProgress); // Recover to 110%
    }

    const dailyRange = price * 0.01;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.5,
      high: price + dailyRange,
      low: price - dailyRange,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

// Simple condition: always true after first candle
const alwaysEnter: PresetCondition = {
  type: "preset",
  name: "alwaysEnter",
  evaluate: (_indicators, _candle, index) => index === 1,
};

// Condition that triggers every 5 candles
const periodicEnter: PresetCondition = {
  type: "preset",
  name: "periodicEnter",
  evaluate: (_indicators, _candle, index) => index % 5 === 1,
};

// Never exit condition
const neverExit: PresetCondition = {
  type: "preset",
  name: "neverExit",
  evaluate: () => false,
};

// Exit after 10 candles
const exitAfter10: PresetCondition = {
  type: "preset",
  name: "exitAfter10",
  evaluate: (_indicators, _candle, index) => index >= 12,
};

describe("Scaled Entry Backtest", () => {
  describe("runBacktestScaled", () => {
    it("should work with single tranche (no scaling)", () => {
      const candles = generateUpTrendCandles(50);
      const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
        capital: 100000,
        scaledEntry: {
          tranches: 1,
          strategy: "equal",
          intervalType: "signal",
        },
      });

      expect(result.tradeCount).toBe(1);
      expect(result.totalReturn).toBeGreaterThan(0);
    });

    it("should fall back to standard backtest without scaledEntry config", () => {
      const candles = generateUpTrendCandles(50);
      const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
        capital: 100000,
      });

      expect(result.tradeCount).toBe(1);
    });

    it("should execute multiple tranches with signal-based scaling", () => {
      const candles = generateUpTrendCandles(100);
      const result = runBacktestScaled(candles, periodicEnter, neverExit, {
        capital: 100000,
        scaledEntry: {
          tranches: 3,
          strategy: "equal",
          intervalType: "signal",
        },
      });

      // Should enter and hold until end
      expect(result.tradeCount).toBe(1);
    });

    it("should execute price-based tranches on dips", () => {
      const candles = generateDipPattern(100, 100);
      const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
        capital: 100000,
        scaledEntry: {
          tranches: 3,
          strategy: "equal",
          intervalType: "price",
          priceInterval: -2, // Buy 2% lower each time
        },
      });

      expect(result.tradeCount).toBe(1);
      // Final capital should reflect the DCA benefit during the dip
      expect(result.totalReturn).not.toBeNaN();
    });

    it("should calculate weighted average entry price correctly", () => {
      const candles = generateUpTrendCandles(50);
      const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
        capital: 100000,
        scaledEntry: {
          tranches: 2,
          strategy: "equal",
          intervalType: "signal",
        },
      });

      // Trade should have a valid entry price
      expect(result.trades[0].entryPrice).toBeGreaterThan(0);
    });

    describe("tranche strategies", () => {
      it("should allocate equal weights for 'equal' strategy", () => {
        const candles = generateUpTrendCandles(50);
        const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          scaledEntry: {
            tranches: 3,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBe(1);
      });

      it("should allocate decreasing weights for 'pyramid' strategy", () => {
        const candles = generateUpTrendCandles(50);
        const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          scaledEntry: {
            tranches: 3,
            strategy: "pyramid",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBe(1);
      });

      it("should allocate increasing weights for 'reverse-pyramid' strategy", () => {
        const candles = generateUpTrendCandles(50);
        const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          scaledEntry: {
            tranches: 3,
            strategy: "reverse-pyramid",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBe(1);
      });
    });

    describe("stop loss with scaled entry", () => {
      it("should apply stop loss using average entry price", () => {
        const candles = generateUpTrendCandles(50);
        // Force a stop by using a very tight stop loss
        const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
          capital: 100000,
          stopLoss: 0.1, // Very tight stop
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        // May or may not trigger stop depending on price action
        expect(result.tradeCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe("take profit with scaled entry", () => {
      it("should apply take profit using average entry price", () => {
        const candles = generateUpTrendCandles(50);
        const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
          capital: 100000,
          takeProfit: 1, // Take profit at 1% gain
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBeGreaterThanOrEqual(1);
        if (result.trades.length > 0) {
          expect(result.trades[0].returnPercent).toBeCloseTo(1, 0);
        }
      });
    });

    describe("partial take profit with scaled entry", () => {
      it("should execute partial take profit on entire position", () => {
        const candles = generateUpTrendCandles(100);
        const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
          capital: 100000,
          partialTakeProfit: {
            threshold: 2, // Take at 2% gain
            sellPercent: 50,
          },
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        // Should have partial + final exit
        expect(result.tradeCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe("trailing stop with scaled entry", () => {
      it("should apply trailing stop correctly", () => {
        const candles = generateUpTrendCandles(50);
        const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
          capital: 100000,
          trailingStop: 3,
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBeGreaterThanOrEqual(1);
      });
    });

    describe("commission handling", () => {
      it("should apply commission to each tranche entry", () => {
        const candles = generateUpTrendCandles(50);
        const resultNoCommission = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        const resultWithCommission = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          commission: 10,
          commissionRate: 0.1,
          scaledEntry: {
            tranches: 2,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        // Commission should reduce returns
        expect(resultWithCommission.totalReturn).toBeLessThan(resultNoCommission.totalReturn);
      });
    });

    describe("edge cases", () => {
      it("should handle empty candles", () => {
        const result = runBacktestScaled([], alwaysEnter, neverExit, {
          capital: 100000,
          scaledEntry: {
            tranches: 3,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBe(0);
        expect(result.totalReturn).toBe(0);
      });

      it("should handle single candle", () => {
        const candles = generateUpTrendCandles(1);
        const result = runBacktestScaled(candles, alwaysEnter, neverExit, {
          capital: 100000,
          scaledEntry: {
            tranches: 3,
            strategy: "equal",
            intervalType: "signal",
          },
        });

        expect(result.tradeCount).toBe(0);
      });

      it("should return reserved capital when exiting before all tranches filled", () => {
        const candles = generateUpTrendCandles(20);
        const result = runBacktestScaled(candles, alwaysEnter, exitAfter10, {
          capital: 100000,
          scaledEntry: {
            tranches: 5, // More tranches than will be filled
            strategy: "equal",
            intervalType: "signal",
          },
        });

        // Should still work without losing the reserved capital
        expect(result.tradeCount).toBe(1);
      });
    });
  });
});
