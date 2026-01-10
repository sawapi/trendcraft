/**
 * Exit Reason Tests
 *
 * Verifies that exitReason is correctly set for each type of exit:
 * - signal: Exit signal condition triggered
 * - stopLoss: Stop loss (fixed or ATR-based)
 * - takeProfit: Take profit (fixed or ATR-based)
 * - trailing: Trailing stop (fixed or ATR-based)
 * - breakeven: Breakeven stop triggered
 * - scaleOut: Scale-out partial exit
 * - partialTakeProfit: Partial take profit exit
 * - timeExit: Time-based exit (maxHoldDays)
 * - endOfData: Position closed at end of backtest data
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle, ExitReason } from "../../types";
import { runBacktest } from "../engine";

// Helper to create candles
const makeCandles = (
  data: Array<{ o: number; h: number; l: number; c: number }>,
  startTime = 1700000000000,
  intervalMs = 86400000,
): NormalizedCandle[] =>
  data.map((d, i) => ({
    time: startTime + i * intervalMs,
    open: d.o,
    high: d.h,
    low: d.l,
    close: d.c,
    volume: 1000,
  }));

// Always true condition (for entry)
const alwaysTrue = () => true;
// Always false condition (for exit)
const alwaysFalse = () => false;

describe("Exit Reason Tracking", () => {
  describe("Signal Exit", () => {
    it("should set exitReason to 'signal' for signal-based exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0: skipped (index 0)
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry
        { o: 105, h: 110, l: 104, c: 108 }, // 2
        { o: 108, h: 112, l: 107, c: 110 }, // 3: exit signal
      ]);

      let entryCount = 0;
      let exitSignalFired = false;

      const entryCondition = () => {
        entryCount++;
        return entryCount === 1; // Only enter on first evaluation
      };

      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        if (candle.close >= 110) {
          exitSignalFired = true;
          return true;
        }
        return false;
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("signal");
      expect(exitSignalFired).toBe(true);
    });
  });

  describe("Stop Loss Exit", () => {
    it("should set exitReason to 'stopLoss' for stop loss exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 106, l: 95, c: 96 }, // 2: drops below 5% stop loss
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        stopLoss: 5, // 5% stop loss
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("stopLoss");
    });

    it("should set exitReason to 'stopLoss' for intraday stop loss exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 106, l: 95, c: 104 }, // 2: low hits stop, but close recovers
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        stopLoss: 5, // 5% stop loss
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("stopLoss");
    });
  });

  describe("Take Profit Exit", () => {
    it("should set exitReason to 'takeProfit' for take profit exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 120, l: 104, c: 118 }, // 2: rises above 10% take profit
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        takeProfit: 10, // 10% take profit
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("takeProfit");
    });
  });

  describe("Trailing Stop Exit", () => {
    it("should set exitReason to 'trailing' for trailing stop exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 120, l: 104, c: 118 }, // 2: peak at 120
        { o: 118, h: 119, l: 110, c: 112 }, // 3: drops 6.67% from peak (120 to 112)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        trailingStop: 5, // 5% trailing stop (120 * 0.95 = 114)
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("trailing");
    });
  });

  describe("Breakeven Stop Exit", () => {
    it("should set exitReason to 'breakeven' for breakeven stop exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 115, l: 104, c: 112 }, // 2: activates breakeven (threshold 5% = 110.25)
        { o: 112, h: 113, l: 103, c: 104 }, // 3: drops below entry price
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        breakevenStop: { threshold: 5 }, // Activate at 5% gain
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("breakeven");
    });
  });

  describe("Scale Out Exit", () => {
    it("should set exitReason to 'scaleOut' for scale-out exits", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 118, l: 104, c: 116 }, // 2: hits 10% scale-out level
        { o: 116, h: 130, l: 115, c: 128 }, // 3: hits 20% scale-out level
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        scaleOut: {
          levels: [
            { threshold: 10, sellPercent: 50 },
            { threshold: 20, sellPercent: 100 },
          ],
        },
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(2);
      expect(result.trades[0].exitReason).toBe("scaleOut");
      expect(result.trades[0].isPartial).toBe(true);
      expect(result.trades[1].exitReason).toBe("scaleOut");
      expect(result.trades[1].isPartial).toBe(false); // Last scale-out closes position
    });
  });

  describe("Partial Take Profit Exit", () => {
    it("should set exitReason to 'partialTakeProfit' for partial take profit exits", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 118, l: 104, c: 116 }, // 2: hits partial take profit threshold (105 * 1.1 = 115.5)
        { o: 116, h: 117, l: 115, c: 116 }, // 3: signal exit fires here
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      // Exit after partial take profit has triggered
      const exitCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
        return candle.close === 116 && candle.high === 117; // Exit on bar 3
      };

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 10000,
        partialTakeProfit: { threshold: 10, sellPercent: 50 },
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(2);
      expect(result.trades[0].exitReason).toBe("partialTakeProfit");
      expect(result.trades[0].isPartial).toBe(true);
      expect(result.trades[1].exitReason).toBe("signal");
    });
  });

  describe("Time Exit", () => {
    it("should set exitReason to 'timeExit' for time-based exit", () => {
      // Create candles spanning multiple days
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // Day 0
        { o: 102, h: 107, l: 101, c: 105 }, // Day 1: entry
        { o: 105, h: 108, l: 104, c: 106 }, // Day 2
        { o: 106, h: 109, l: 105, c: 107 }, // Day 3
        { o: 107, h: 110, l: 106, c: 108 }, // Day 4: time exit (3 days held)
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        timeExit: { maxHoldDays: 3 },
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("timeExit");
    });
  });

  describe("End of Data Exit", () => {
    it("should set exitReason to 'endOfData' when position is open at end", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry
        { o: 105, h: 108, l: 104, c: 106 }, // 2
        { o: 106, h: 109, l: 105, c: 107 }, // 3: end of data
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        fillMode: "same-bar-close",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("endOfData");
    });
  });

  describe("Next-Bar-Open Fill Mode", () => {
    it("should preserve exitReason in next-bar-open mode", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry signal
        { o: 105, h: 108, l: 104, c: 106 }, // 2: entry executed at open (105)
        { o: 106, h: 109, l: 90, c: 92 }, // 3: stop loss triggered (105 * 0.9 = 94.5, close 92 < 94.5)
        { o: 92, h: 95, l: 90, c: 93 }, // 4: exit executed at open
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      const result = runBacktest(candles, entryCondition, alwaysFalse, {
        capital: 10000,
        stopLoss: 10, // 10% stop loss
        fillMode: "next-bar-open",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      expect(result.trades[0].exitReason).toBe("stopLoss");
    });
  });

  describe("Exit Reason Priority", () => {
    it("should prioritize stop loss over signal exit", () => {
      const candles = makeCandles([
        { o: 100, h: 105, l: 99, c: 102 }, // 0
        { o: 102, h: 107, l: 101, c: 105 }, // 1: entry at 105
        { o: 105, h: 106, l: 95, c: 96 }, // 2: stop loss triggered, exit signal also true
      ]);

      let entryCount = 0;
      const entryCondition = () => {
        entryCount++;
        return entryCount === 1;
      };

      // Exit signal always true
      const result = runBacktest(candles, entryCondition, alwaysTrue, {
        capital: 10000,
        stopLoss: 5, // 5% stop loss
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.trades.length).toBe(1);
      // Stop loss should take priority over signal exit
      expect(result.trades[0].exitReason).toBe("stopLoss");
    });
  });
});
