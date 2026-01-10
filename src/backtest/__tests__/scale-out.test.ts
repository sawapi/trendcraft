import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { runBacktest } from "../engine";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Create a condition that triggers entry at a specific index
 */
function entryAtIndex(targetIndex: number) {
  return (_indicators: Record<string, unknown>, _candle: NormalizedCandle, index: number) => {
    return index === targetIndex;
  };
}

/**
 * Never exit condition (for controlled testing)
 */
const neverExit = () => false;

/**
 * Generate candles with controlled price movement for scale-out testing
 */
function generateScaleOutTestCandles(
  entryPrice: number,
  priceSequence: number[],
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - (priceSequence.length + 2) * MS_PER_DAY;

  // Day 0: Starting candle
  candles.push({
    time: baseTime,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Day 1: Entry signal day (entry at close in same-bar-close mode)
  candles.push({
    time: baseTime + MS_PER_DAY,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Following days: Price follows the sequence
  for (let i = 0; i < priceSequence.length; i++) {
    const price = priceSequence[i];
    candles.push({
      time: baseTime + (i + 2) * MS_PER_DAY,
      open: price * 0.99,
      high: price,
      low: price * 0.98,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("Scale Out", () => {
  describe("Single Level", () => {
    it("should execute scale-out at single level", () => {
      // Entry at 100, price rises to 105 (+5%)
      // Scale out at +5% threshold, selling 50%
      const candles = generateScaleOutTestCandles(100, [102, 105, 106, 105, 104]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should have 2 trades: 1 partial (scale-out), 1 final (end of data)
      expect(result.tradeCount).toBe(2);

      const partialTrade = result.trades.find((t) => t.isPartial);
      expect(partialTrade).toBeDefined();
      expect(partialTrade!.exitPrice).toBeCloseTo(105, 0);
      expect(partialTrade!.returnPercent).toBeGreaterThan(0);
    });

    it("should NOT trigger scale-out if threshold not reached", () => {
      // Entry at 100, price rises to 103 (+3%) but threshold is 5%
      const candles = generateScaleOutTestCandles(100, [101, 102, 103, 102, 101]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should have only 1 trade (end of data close), no partial
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].isPartial).toBeFalsy();
    });

    it("should sell 100% at single level and close position", () => {
      // Entry at 100, price rises to 110 (+10%)
      // Scale out at +10% threshold, selling 100%
      const candles = generateScaleOutTestCandles(100, [105, 110, 112, 115]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 10, sellPercent: 100 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should have 1 trade (100% exit)
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].exitPrice).toBeCloseTo(110, 0);
      // Not marked as partial since 100% was sold
      expect(result.trades[0].isPartial).toBeFalsy();
    });
  });

  describe("Multiple Levels", () => {
    it("should execute multiple scale-out levels in order", () => {
      // Entry at 100
      // Level 1: +5% (105) - sell 33%
      // Level 2: +10% (110) - sell 50% of remaining
      // Level 3: +20% (120) - sell 100% of remaining
      const candles = generateScaleOutTestCandles(100, [103, 105, 108, 110, 115, 120, 125]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [
            { threshold: 5, sellPercent: 33 },
            { threshold: 10, sellPercent: 50 },
            { threshold: 20, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should have 3 trades (one for each level)
      expect(result.tradeCount).toBe(3);

      // First trade at 105 (+5%)
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0);
      expect(result.trades[0].isPartial).toBe(true);

      // Second trade at 110 (+10%)
      expect(result.trades[1].exitPrice).toBeCloseTo(110, 0);
      expect(result.trades[1].isPartial).toBe(true);

      // Third trade at 120 (+20%) - final exit
      expect(result.trades[2].exitPrice).toBeCloseTo(120, 0);
      expect(result.trades[2].isPartial).toBe(false); // 100% of remaining
    });

    it("should handle levels triggered on same bar", () => {
      // Entry at 100, price jumps directly to 120
      // Multiple levels should trigger
      const candles = generateScaleOutTestCandles(100, [120, 122]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [
            { threshold: 5, sellPercent: 33 },
            { threshold: 10, sellPercent: 50 },
            { threshold: 15, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // All 3 levels should trigger on the same bar
      expect(result.tradeCount).toBe(3);

      // All trades should have exit prices at their respective thresholds
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0); // +5%
      expect(result.trades[1].exitPrice).toBeCloseTo(110, 0); // +10%
      expect(result.trades[2].exitPrice).toBeCloseTo(115, 0); // +15%
    });

    it("should handle partial levels triggered (not all reached)", () => {
      // Entry at 100, price rises to 112 then falls
      // Only first two levels should trigger
      const candles = generateScaleOutTestCandles(100, [105, 110, 112, 108, 105, 100]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [
            { threshold: 5, sellPercent: 33 },
            { threshold: 10, sellPercent: 50 },
            { threshold: 20, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // 2 scale-out trades + 1 end-of-data close
      expect(result.tradeCount).toBe(3);

      // First two are partial
      expect(result.trades[0].isPartial).toBe(true);
      expect(result.trades[1].isPartial).toBe(true);

      // Third is end-of-data close (not at 20% level)
      expect(result.trades[2].exitPrice).toBeCloseTo(100, 0);
    });
  });

  describe("Interaction with Other Features", () => {
    it("should work with stop loss", () => {
      // Entry at 100, price rises to 105 (+5%), then falls to 90
      // Scale-out at +5% should trigger first, then stop loss
      const candles = generateScaleOutTestCandles(100, [105, 103, 95, 90]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        stopLoss: 8,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // 1 partial scale-out + 1 stop loss
      expect(result.tradeCount).toBe(2);

      // First trade is partial at 105
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0);
      expect(result.trades[0].isPartial).toBe(true);

      // Second trade is stop loss at 92
      expect(result.trades[1].exitPrice).toBeCloseTo(92, 0);
      expect(result.trades[1].returnPercent).toBeLessThan(0);
    });

    it("should work with breakeven stop", () => {
      // Entry at 100, price rises to 106 (+6%), then falls to 99
      // Scale-out at +5% should trigger, then breakeven stop at +3% threshold
      const candles = generateScaleOutTestCandles(100, [103, 106, 104, 99]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // 1 partial scale-out + 1 breakeven exit
      expect(result.tradeCount).toBe(2);

      // First trade is partial at 105
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0);

      // Second trade is breakeven exit at 100
      expect(result.trades[1].exitPrice).toBeCloseTo(100, 0);
    });
  });

  describe("Return Calculation", () => {
    it("should calculate returns correctly for each scale-out level", () => {
      // Entry at 100, scale out at +10% and +20%
      const candles = generateScaleOutTestCandles(100, [105, 110, 115, 120, 122]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [
            { threshold: 10, sellPercent: 50 },
            { threshold: 20, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(2);

      // First trade: +10% return
      expect(result.trades[0].returnPercent).toBeCloseTo(10, 0);

      // Second trade: +20% return (on remaining shares)
      expect(result.trades[1].returnPercent).toBeCloseTo(20, 0);

      // Total return should be positive
      expect(result.totalReturnPercent).toBeGreaterThan(0);
    });
  });

  describe("SlTpMode", () => {
    it("should use close price in close-only mode", () => {
      // In close-only mode, scale-out triggers at close, not high
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 5 * MS_PER_DAY;
      const entryPrice = 100;

      candles.push({
        time: baseTime,
        open: entryPrice,
        high: entryPrice,
        low: entryPrice,
        close: entryPrice,
        volume: 1000000,
      });
      candles.push({
        time: baseTime + MS_PER_DAY,
        open: entryPrice,
        high: entryPrice,
        low: entryPrice,
        close: entryPrice,
        volume: 1000000,
      });

      // High reaches 108 but close is only 103 - should NOT trigger 5% level
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: 101,
        high: 108,
        low: 100,
        close: 103,
        volume: 1000000,
      });

      // Close reaches 106 - should trigger
      candles.push({
        time: baseTime + 3 * MS_PER_DAY,
        open: 104,
        high: 107,
        low: 103,
        close: 106,
        volume: 1000000,
      });

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      // 1 scale-out (triggered by close at 106) + 1 end-of-data
      expect(result.tradeCount).toBe(2);

      // Scale-out should happen at close price (106), not threshold price (105)
      expect(result.trades[0].exitPrice).toBeCloseTo(106, 0);
    });

    it("should use threshold price in intraday mode", () => {
      const candles = generateScaleOutTestCandles(100, [108, 110]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Scale-out should happen at exact threshold price (105)
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty levels array", () => {
      const candles = generateScaleOutTestCandles(100, [105, 110]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should just have end-of-data close
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].isPartial).toBeFalsy();
    });

    it("should handle very small remaining position", () => {
      // Multiple 90% sell levels to create very small remaining position
      const candles = generateScaleOutTestCandles(100, [105, 110, 115, 120]);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [
            { threshold: 5, sellPercent: 90 },
            { threshold: 10, sellPercent: 90 },
            { threshold: 15, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // All 3 levels should trigger
      expect(result.tradeCount).toBe(3);
    });
  });
});
