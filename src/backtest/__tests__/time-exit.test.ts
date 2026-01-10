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
 * Generate candles with controlled price for time exit testing
 */
function generateTimeExitTestCandles(
  entryPrice: number,
  dayCount: number,
  priceAtEnd: number,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - (dayCount + 2) * MS_PER_DAY;

  // Day 0: Starting candle
  candles.push({
    time: baseTime,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Day 1: Entry signal day
  candles.push({
    time: baseTime + MS_PER_DAY,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Following days: gradual price change
  for (let i = 0; i < dayCount; i++) {
    const progress = i / (dayCount - 1);
    const price = entryPrice + (priceAtEnd - entryPrice) * progress;
    candles.push({
      time: baseTime + (i + 2) * MS_PER_DAY,
      open: price * 0.99,
      high: price * 1.01,
      low: price * 0.99,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

describe("Time Exit", () => {
  describe("Basic Functionality", () => {
    it("should exit after maxHoldDays", () => {
      // Entry at 100, hold for 5 days, then time exit
      const candles = generateTimeExitTestCandles(100, 10, 105);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      expect(trade.holdingDays).toBe(5);
    });

    it("should NOT exit before maxHoldDays", () => {
      // Entry at 100, maxHoldDays is 20, but we only have 10 days of data
      const candles = generateTimeExitTestCandles(100, 10, 105);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 20 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should close at end of data, not due to time exit
      expect(result.tradeCount).toBe(1);
      // Holding days should be less than maxHoldDays
      expect(result.trades[0].holdingDays).toBeLessThan(20);
    });

    it("should exit on next bar when maxHoldDays is 0", () => {
      // With maxHoldDays = 0, exit triggers on the first bar AFTER entry
      // (time exit check happens during position management, which is after entry)
      const candles = generateTimeExitTestCandles(100, 5, 105);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 0 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      // Exit happens on first bar after entry, so holdingDays is 1
      expect(result.trades[0].holdingDays).toBe(1);
    });
  });

  describe("onlyIfFlat Option", () => {
    it("should exit when position is flat (within threshold)", () => {
      // Entry at 100, price stays around 101 (+1%), threshold is 2%
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Days with price around 101 (+1%)
      for (let i = 2; i <= 10; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 101,
          high: 102,
          low: 100,
          close: 101, // +1% from entry
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5, onlyIfFlat: { threshold: 2 } },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].holdingDays).toBe(5);
      // Return should be close to +1%
      expect(result.trades[0].returnPercent).toBeCloseTo(1, 0);
    });

    it("should NOT exit when position is NOT flat (outside threshold)", () => {
      // Entry at 100, price rises to 110 (+10%), threshold is 2%
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Days with price at 110 (+10%)
      for (let i = 2; i <= 10; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 110,
          high: 111,
          low: 109,
          close: 110, // +10% from entry
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5, onlyIfFlat: { threshold: 2 } },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should close at end of data, not at day 5
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].holdingDays).toBeGreaterThan(5);
    });

    it("should exit when position is flat on the negative side", () => {
      // Entry at 100, price drops to 99 (-1%), threshold is 2%
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Days with price at 99 (-1%)
      for (let i = 2; i <= 10; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 99,
          high: 100,
          low: 98,
          close: 99, // -1% from entry
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5, onlyIfFlat: { threshold: 2 } },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].holdingDays).toBe(5);
      // Return should be close to -1%
      expect(result.trades[0].returnPercent).toBeCloseTo(-1, 0);
    });

    it("should exit when position returns to flat after being up", () => {
      // Entry at 100, rises to 110, then returns to 101
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Days 2-4: Price rises
      for (let i = 2; i <= 4; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 105 + (i - 2) * 2,
          high: 106 + (i - 2) * 2,
          low: 104 + (i - 2) * 2,
          close: 105 + (i - 2) * 2,
          volume: 1000000,
        });
      }

      // Days 5-8: Price falls back to flat
      for (let i = 5; i <= 8; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 101,
          high: 102,
          low: 100,
          close: 101, // +1% from entry
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5, onlyIfFlat: { threshold: 2 } },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      // Time exit triggers when position is flat AND maxHoldDays reached
      expect(result.trades[0].holdingDays).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Interaction with Other Exit Types", () => {
    it("should stop loss takes priority over time exit", () => {
      // Entry at 100, price drops to 92 (-8%) on day 3
      // Stop loss at 5%, time exit at 10 days
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Day 2-3: Price stays flat
      for (let i = 2; i <= 3; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 100,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000000,
        });
      }

      // Day 4: Price drops sharply
      candles.push({
        time: baseTime + 4 * MS_PER_DAY,
        open: 98,
        high: 98,
        low: 92,
        close: 92,
        volume: 1000000,
      });

      // Days 5-10: Price stays low
      for (let i = 5; i <= 10; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 92,
          high: 93,
          low: 91,
          close: 92,
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        stopLoss: 5,
        timeExit: { maxHoldDays: 10 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      // Should exit via stop loss, not time exit
      expect(result.trades[0].exitPrice).toBeCloseTo(95, 0);
      expect(result.trades[0].holdingDays).toBeLessThan(10);
    });

    it("should work with breakeven stop and time exit", () => {
      // Entry at 100, rises to 105 (activates breakeven), stays at 103
      // Time exit at 10 days
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 20 * MS_PER_DAY;
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

      // Day 2: Price rises to 106
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: 103,
        high: 106,
        low: 102,
        close: 105,
        volume: 1000000,
      });

      // Days 3-12: Price stays at 103 (above breakeven)
      for (let i = 3; i <= 12; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 103,
          high: 104,
          low: 102,
          close: 103,
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        timeExit: { maxHoldDays: 10 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      // Should exit via time exit since price stayed above breakeven
      expect(result.trades[0].holdingDays).toBe(10);
      expect(result.trades[0].exitPrice).toBeCloseTo(103, 0);
    });

    it("should work with scale-out and time exit", () => {
      // Entry at 100, rises to 105 (triggers scale-out), then time exit on remaining
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 15 * MS_PER_DAY;
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

      // Day 2: Price rises to 106
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: 103,
        high: 106,
        low: 102,
        close: 105,
        volume: 1000000,
      });

      // Days 3-10: Price stays at 103
      for (let i = 3; i <= 10; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 103,
          high: 104,
          low: 102,
          close: 103,
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        scaleOut: {
          levels: [{ threshold: 5, sellPercent: 50 }],
        },
        timeExit: { maxHoldDays: 7 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // 1 scale-out + 1 time exit
      expect(result.tradeCount).toBe(2);

      // First is scale-out
      expect(result.trades[0].isPartial).toBe(true);
      expect(result.trades[0].exitPrice).toBeCloseTo(105, 0);

      // Second is time exit
      expect(result.trades[1].holdingDays).toBe(7);
    });
  });

  describe("Edge Cases", () => {
    it("should handle exact threshold boundary", () => {
      // Entry at 100, price at 102 (exactly +2%), threshold is 2%
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 10 * MS_PER_DAY;
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

      // Days with price at exactly 102 (+2%)
      for (let i = 2; i <= 7; i++) {
        candles.push({
          time: baseTime + i * MS_PER_DAY,
          open: 102,
          high: 103,
          low: 101,
          close: 102, // Exactly +2%
          volume: 1000000,
        });
      }

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 5, onlyIfFlat: { threshold: 2 } },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      // Should exit at day 5 since +2% is within ±2% threshold
      expect(result.trades[0].holdingDays).toBe(5);
    });

    it("should handle very large maxHoldDays", () => {
      const candles = generateTimeExitTestCandles(100, 5, 105);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        timeExit: { maxHoldDays: 365 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should close at end of data since maxHoldDays not reached
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].holdingDays).toBeLessThan(365);
    });
  });
});
