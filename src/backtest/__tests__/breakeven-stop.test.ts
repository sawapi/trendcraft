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
 * Generate candles with controlled price movement for breakeven testing
 * Day 0: Initial candle
 * Day 1: Entry signal (entry at close in same-bar-close mode)
 * Day 2: Price rises to peak
 * Day 3: Price falls below entry (or to specific level)
 */
function generateBreakevenTestCandles(
  entryPrice: number,
  risePercent: number,
  fallToPrice: number,
): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - 20 * MS_PER_DAY;

  // Day 0: Starting candle
  candles.push({
    time: baseTime,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Day 1: Entry signal day (entry executes at close in same-bar-close mode)
  candles.push({
    time: baseTime + MS_PER_DAY,
    open: entryPrice,
    high: entryPrice * 1.01,
    low: entryPrice * 0.99,
    close: entryPrice,
    volume: 1000000,
  });

  // Day 2: Price rises to peak
  const peakPrice = entryPrice * (1 + risePercent / 100);
  candles.push({
    time: baseTime + 2 * MS_PER_DAY,
    open: entryPrice * 1.01,
    high: peakPrice,
    low: entryPrice * 1.005, // Low above entry to avoid triggering breakeven on same bar
    close: peakPrice,
    volume: 1000000,
  });

  // Day 3: Price falls
  candles.push({
    time: baseTime + 3 * MS_PER_DAY,
    open: peakPrice * 0.99,
    high: peakPrice * 0.99,
    low: fallToPrice,
    close: fallToPrice,
    volume: 1000000,
  });

  // Day 4-9: Price stays at fallen level
  for (let i = 4; i < 10; i++) {
    candles.push({
      time: baseTime + i * MS_PER_DAY,
      open: fallToPrice,
      high: fallToPrice * 1.01,
      low: fallToPrice * 0.99,
      close: fallToPrice,
      volume: 1000000,
    });
  }

  return candles;
}

describe("Breakeven Stop", () => {
  describe("Basic Functionality", () => {
    it("should activate breakeven when profit threshold is reached", () => {
      // Entry at 100, rises to 105 (+5%), falls to 98
      // Breakeven threshold at 3%, so should activate at 103
      // After activation, stop at entry price (100)
      // Price falls to 98, should exit at 100 (intraday mode)
      const candles = generateBreakevenTestCandles(100, 5, 98);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Should exit at entry price (breakeven)
      expect(trade.exitPrice).toBeCloseTo(100, 0);
      expect(trade.returnPercent).toBeCloseTo(0, 1);
    });

    it("should NOT activate breakeven if threshold is not reached", () => {
      // Entry at 100, rises to 102 (+2%), falls to 95
      // Breakeven threshold at 5%, so should NOT activate
      // Position closes at end of data (at last candle's close price)
      const candles = generateBreakevenTestCandles(100, 2, 95);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 5 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Position closes at end of data (not via breakeven)
      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Exit at last candle's close (95), NOT at breakeven (100)
      expect(trade.exitPrice).toBeCloseTo(95, 0);
      expect(trade.returnPercent).toBeLessThan(0);
    });

    it("should NOT exit if breakeven activated but price stays above entry", () => {
      // Entry at 100, rises to 108 (+8%), falls to 103 (+3%)
      // Breakeven threshold at 5%, activates at 105
      // Stop at entry (100), but price stays at 103 (above stop), so no early exit
      // Position closes at end of data at 103
      const entryPrice = 100;
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 10 * MS_PER_DAY;

      // Day 0: Setup
      candles.push({
        time: baseTime,
        open: entryPrice,
        high: entryPrice * 1.01,
        low: entryPrice * 0.99,
        close: entryPrice,
        volume: 1000000,
      });

      // Day 1: Entry day
      candles.push({
        time: baseTime + MS_PER_DAY,
        open: entryPrice,
        high: entryPrice * 1.01,
        low: entryPrice * 0.99,
        close: entryPrice,
        volume: 1000000,
      });

      // Day 2: Price rises to 108 (activates breakeven at threshold 5% = 105)
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: entryPrice * 1.01,
        high: 108,
        low: entryPrice * 1.01,
        close: 108,
        volume: 1000000,
      });

      // Day 3-5: Price stays at 103 (above entry, so breakeven stop NOT triggered)
      for (let i = 3; i <= 5; i++) {
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
        breakevenStop: { threshold: 5 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Position closes at end of data (not via breakeven)
      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Exit at last candle's close (103), NOT at breakeven (100)
      expect(trade.exitPrice).toBeCloseTo(103, 0);
      expect(trade.returnPercent).toBeGreaterThan(0); // +3% gain
    });
  });

  describe("Buffer Option", () => {
    it("should apply buffer above entry price", () => {
      // Entry at 100, rises to 106 (+6%), falls to 99
      // Breakeven threshold at 3% (activates at 103)
      // Buffer at 1% (stop at 101)
      // Price falls to 99, should exit at 101
      const candles = generateBreakevenTestCandles(100, 6, 99);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3, buffer: 1 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Should exit at entry price + buffer (101)
      expect(trade.exitPrice).toBeCloseTo(101, 0);
      expect(trade.returnPercent).toBeGreaterThan(0);
    });

    it("should work with zero buffer (default)", () => {
      const candles = generateBreakevenTestCandles(100, 5, 95);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].exitPrice).toBeCloseTo(100, 0);
    });
  });

  describe("Interaction with Other Stop Types", () => {
    it("should work alongside regular stop loss", () => {
      // Entry at 100, price immediately drops to 90
      // Regular stop loss at 5% (95), breakeven threshold 3%
      // Should hit regular stop loss since breakeven never activated
      const entryPrice = 100;
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 5 * MS_PER_DAY;

      candles.push({
        time: baseTime,
        open: entryPrice,
        high: entryPrice * 1.01,
        low: entryPrice * 0.99,
        close: entryPrice,
        volume: 1000000,
      });
      candles.push({
        time: baseTime + MS_PER_DAY,
        open: entryPrice,
        high: entryPrice * 1.01,
        low: entryPrice * 0.99,
        close: entryPrice,
        volume: 1000000,
      });

      // Day 2: Entry executed, price drops immediately
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: entryPrice,
        high: entryPrice,
        low: 90,
        close: 90,
        volume: 1000000,
      });

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        stopLoss: 5,
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Should hit regular stop loss at 95
      expect(trade.exitPrice).toBeCloseTo(95, 0);
      expect(trade.returnPercent).toBeLessThan(0);
    });

    it("should allow breakeven stop to protect gains even with regular stop", () => {
      // Entry at 100, rises to 105 (+5%), falls to 96
      // Regular stop loss at 10% (90), breakeven threshold at 3%
      // Breakeven activates at 103, stop moves to 100
      // Falls to 96 -> should exit at 100 (breakeven), not wait for 90 (regular stop)
      const candles = generateBreakevenTestCandles(100, 5, 96);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        stopLoss: 10,
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Should exit at breakeven (100), not wait for regular stop (90)
      expect(trade.exitPrice).toBeCloseTo(100, 0);
    });
  });

  describe("SlTpMode", () => {
    it("should use close price in close-only mode", () => {
      // Entry at 100, rises to 106, then close at 98 (but low touches 96)
      // In close-only mode, should check close price for activation and stop
      const entryPrice = 100;
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 5 * MS_PER_DAY;

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

      // Day 2: Entry executed, close at 106 (activates breakeven)
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: entryPrice,
        high: 108,
        low: entryPrice,
        close: 106,
        volume: 1000000,
      });

      // Day 3: Close at 98 (triggers breakeven exit in close-only mode)
      candles.push({
        time: baseTime + 3 * MS_PER_DAY,
        open: 104,
        high: 105,
        low: 96,
        close: 98,
        volume: 1000000,
      });

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 5 },
        fillMode: "same-bar-close",
        slTpMode: "close-only",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // In close-only mode, exit at close price (98), not breakeven price (100)
      expect(trade.exitPrice).toBeCloseTo(98, 0);
    });

    it("should use exact stop price in intraday mode", () => {
      const candles = generateBreakevenTestCandles(100, 6, 90);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // In intraday mode, exit at exact breakeven price (100)
      expect(trade.exitPrice).toBeCloseTo(100, 0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle threshold of 0 (immediate activation)", () => {
      // Threshold 0 means breakeven activates immediately when price >= entry
      // Buffer 0.1% means stop at 100.1
      const candles = generateBreakevenTestCandles(100, 2, 99);

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 0, buffer: 0.1 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should activate immediately and exit when price drops below stop
      expect(result.tradeCount).toBe(1);
      expect(result.trades[0].exitPrice).toBeCloseTo(100.1, 0);
    });

    it("should work with partial take profit", () => {
      // Entry at 100, rises to 110 (+10%), falls to 95
      // Partial TP at +5% (sells 50%), Breakeven at +3%
      const entryPrice = 100;
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 5 * MS_PER_DAY;

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

      // Day 2: Entry executed, price rises to 110
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: entryPrice,
        high: 110,
        low: entryPrice * 1.01, // Low above entry
        close: 110,
        volume: 1000000,
      });

      // Day 3: Price drops to 95
      candles.push({
        time: baseTime + 3 * MS_PER_DAY,
        open: 108,
        high: 108,
        low: 95,
        close: 95,
        volume: 1000000,
      });

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        partialTakeProfit: { threshold: 5, sellPercent: 50 },
        breakevenStop: { threshold: 3 },
        fillMode: "same-bar-close",
        slTpMode: "intraday",
      });

      // Should have 2 trades: 1 partial, 1 final (breakeven exit)
      expect(result.tradeCount).toBe(2);

      // First trade should be partial at +5%
      const partialTrade = result.trades.find((t) => t.isPartial);
      expect(partialTrade).toBeDefined();
      expect(partialTrade?.returnPercent).toBeGreaterThan(0);

      // Second trade should be breakeven exit
      const finalTrade = result.trades.find((t) => !t.isPartial);
      expect(finalTrade).toBeDefined();
      expect(finalTrade?.exitPrice).toBeCloseTo(100, 0);
    });

    it("should work with next-bar-open fill mode", () => {
      // With next-bar-open:
      // - Entry signal at index 1 → entry executes at index 2's open
      // - Breakeven triggered at index 3 → exit executes at index 4's open
      const entryPrice = 100;
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.now() - 10 * MS_PER_DAY;

      // Index 0: Setup
      candles.push({
        time: baseTime,
        open: entryPrice,
        high: entryPrice,
        low: entryPrice,
        close: entryPrice,
        volume: 1000000,
      });

      // Index 1: Entry signal fires here
      candles.push({
        time: baseTime + MS_PER_DAY,
        open: entryPrice,
        high: entryPrice,
        low: entryPrice,
        close: entryPrice,
        volume: 1000000,
      });

      // Index 2: Entry executes at open (100), price rises to 106 (activates breakeven)
      // Breakeven threshold 3% = 103, high 106 >= 103 → activated
      // Low = 100 <= 100 (breakeven stop) → exit triggered, pendingExit set
      candles.push({
        time: baseTime + 2 * MS_PER_DAY,
        open: entryPrice,
        high: 106,
        low: entryPrice,
        close: 106,
        volume: 1000000,
      });

      // Index 3: Exit executes at this bar's open (102)
      candles.push({
        time: baseTime + 3 * MS_PER_DAY,
        open: 102,
        high: 104,
        low: 95,
        close: 95,
        volume: 1000000,
      });

      const result = runBacktest(candles, entryAtIndex(1), neverExit, {
        capital: 1000000,
        breakevenStop: { threshold: 3 },
        fillMode: "next-bar-open",
        slTpMode: "intraday",
      });

      expect(result.tradeCount).toBe(1);
      const trade = result.trades[0];
      // Exit happens at index 3's open (102), not at breakeven stop price (100)
      expect(trade.exitPrice).toBeCloseTo(102, 0);
      expect(trade.returnPercent).toBeGreaterThan(0); // Small profit due to gap up at open
    });
  });
});
