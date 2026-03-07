/**
 * Tests for Short Selling Support (Feature 3)
 */
import { describe, it, expect } from "vitest";
import { runBacktest } from "../engine";
import { createPositionTracker } from "../../streaming/position-manager/position-tracker";
import type { NormalizedCandle, ConditionFn } from "../../types";

const DAY = 86400000;

function makeCandles(prices: number[], startTime = DAY): NormalizedCandle[] {
  return prices.map((close, i) => ({
    time: startTime + i * DAY,
    open: close - 1,
    high: close + 2,
    low: close - 2,
    close,
    volume: 1000,
  }));
}

const alwaysTrue: ConditionFn = () => true;
const alwaysFalse: ConditionFn = () => false;

describe("backtest short selling", () => {
  it("backward compatibility: direction omitted defaults to long", () => {
    const candles = makeCandles([100, 100, 110, 120]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      fillMode: "same-bar-close",
    });
    // Should enter on first candle and hold to end
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].direction).toBeUndefined(); // long is omitted
    expect(result.totalReturnPercent).toBeGreaterThan(0); // price went up
  });

  it("short position profits when price drops", () => {
    const candles = makeCandles([100, 100, 90, 80]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      direction: "short",
      fillMode: "same-bar-close",
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].direction).toBe("short");
    expect(result.totalReturnPercent).toBeGreaterThan(0); // price dropped, short profits
  });

  it("short position loses when price rises", () => {
    const candles = makeCandles([100, 100, 110, 120]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      direction: "short",
      fillMode: "same-bar-close",
    });
    expect(result.trades[0].direction).toBe("short");
    expect(result.totalReturnPercent).toBeLessThan(0); // price rose, short loses
  });

  it("short stop loss triggers when price rises above entry * (1 + sl%)", () => {
    // Price rises significantly
    const candles = makeCandles([100, 100, 100, 106, 110]);
    let entered = false;
    const entryOnce: ConditionFn = () => {
      if (!entered) { entered = true; return true; }
      return false;
    };
    const result = runBacktest(candles, entryOnce, alwaysFalse, {
      capital: 10000,
      direction: "short",
      stopLoss: 5,
      fillMode: "same-bar-close",
      slTpMode: "intraday",
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("stopLoss");
  });

  it("short take profit triggers when price drops below entry * (1 - tp%)", () => {
    const candles = makeCandles([100, 100, 100, 94, 90]);
    // Entry on first bar, then only exit by TP (no re-entry)
    let entered = false;
    const entryOnce: ConditionFn = () => {
      if (!entered) { entered = true; return true; }
      return false;
    };
    const result = runBacktest(candles, entryOnce, alwaysFalse, {
      capital: 10000,
      direction: "short",
      takeProfit: 5,
      fillMode: "same-bar-close",
      slTpMode: "intraday",
    });
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("takeProfit");
  });

  it("short trailing stop triggers from trough", () => {
    // Price drops then bounces significantly
    // Make candles with tight high/low to avoid premature trailing trigger
    const candles: NormalizedCandle[] = [
      { time: DAY, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: DAY * 2, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
      { time: DAY * 3, open: 95, high: 96, low: 88, close: 90, volume: 1000 },
      { time: DAY * 4, open: 90, high: 91, low: 78, close: 80, volume: 1000 },
      { time: DAY * 5, open: 82, high: 90, low: 81, close: 88, volume: 1000 },
    ];
    let entered = false;
    const entryOnce: ConditionFn = () => {
      if (!entered) { entered = true; return true; }
      return false;
    };
    const result = runBacktest(candles, entryOnce, alwaysFalse, {
      capital: 10000,
      direction: "short",
      trailingStop: 10,
      fillMode: "same-bar-close",
      slTpMode: "intraday",
    });
    // Entry at 100, trough drops to 78, trailing = 78 * 1.10 = 85.8
    // On bar 5, high = 90 > 85.8, trailing triggers
    expect(result.trades.length).toBe(1);
    expect(result.trades[0].exitReason).toBe("trailing");
  });

  it("short MFE/MAE are direction-aware", () => {
    const candles = makeCandles([100, 100, 90, 80, 110]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      direction: "short",
      fillMode: "same-bar-close",
    });
    const trade = result.trades[0];
    // MFE: max profit = when price dropped to 78 (low of 80), ~22% from entry
    expect(trade.mfe).toBeGreaterThan(0);
    // MAE: max loss = when price rose to 112 (high of 110), ~12% from entry
    expect(trade.mae).toBeGreaterThan(0);
  });

  it("settings include direction when short", () => {
    const candles = makeCandles([100, 100, 90]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      direction: "short",
      fillMode: "same-bar-close",
    });
    expect(result.settings.direction).toBe("short");
  });

  it("settings omit direction when long (default)", () => {
    const candles = makeCandles([100, 100, 110]);
    const result = runBacktest(candles, alwaysTrue, alwaysFalse, {
      capital: 10000,
      fillMode: "same-bar-close",
    });
    expect(result.settings.direction).toBeUndefined();
  });
});

describe("streaming position tracker short selling", () => {
  it("short position profits when price drops", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
    });

    tracker.openPosition(100, 100, 1000);
    const pos = tracker.getPosition()!;
    expect(pos.direction).toBe("short");

    const { trade } = tracker.closePosition(90, 2000, "exit-signal");
    expect(trade.return).toBeGreaterThan(0);
    expect(trade.direction).toBe("short");
  });

  it("short position loses when price rises", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
    });

    tracker.openPosition(100, 100, 1000);
    const { trade } = tracker.closePosition(110, 2000, "exit-signal");
    expect(trade.return).toBeLessThan(0);
  });

  it("short stop loss triggers on price rise", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
      stopLoss: 5,
    });

    tracker.openPosition(100, 100, 1000);
    const pos = tracker.getPosition()!;
    // SL for short at 5%: 100 * (1 + 0.05) = 105
    expect(pos.stopLossPrice).toBeCloseTo(105, 0);

    const candle: NormalizedCandle = {
      time: 2000,
      open: 103,
      high: 106,
      low: 102,
      close: 104,
      volume: 1000,
    };
    const result = tracker.updatePrice(candle);
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("stop-loss");
  });

  it("short take profit triggers on price drop", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
      takeProfit: 5,
    });

    tracker.openPosition(100, 100, 1000);
    const pos = tracker.getPosition()!;
    // TP for short at 5%: 100 * (1 - 0.05) = 95
    expect(pos.takeProfitPrice).toBeCloseTo(95, 0);

    const candle: NormalizedCandle = {
      time: 2000,
      open: 96,
      high: 97,
      low: 94,
      close: 95,
      volume: 1000,
    };
    const result = tracker.updatePrice(candle);
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("take-profit");
  });

  it("short trailing stop tracks trough price", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
      trailingStop: 10,
    });

    tracker.openPosition(100, 100, 1000);

    // Price drops to 90 (small drop, trough=90, trailing=90*1.10=99, high=92 < 99, no trigger)
    tracker.updatePrice({
      time: 2000, open: 95, high: 92, low: 90, close: 91, volume: 1000,
    });

    // Price drops further to 80 (trough=80, trailing=80*1.10=88, high=82 < 88, no trigger)
    tracker.updatePrice({
      time: 3000, open: 88, high: 82, low: 80, close: 81, volume: 1000,
    });

    const pos = tracker.getPosition()!;
    expect(pos.troughPrice).toBe(80);

    // Price bounces to above trailing level (80 * 1.10 = 88, high=90 > 88)
    const result = tracker.updatePrice({
      time: 4000, open: 85, high: 90, low: 84, close: 89, volume: 1000,
    });
    expect(result.triggered).not.toBeNull();
    expect(result.triggered!.reason).toBe("trailing-stop");
  });

  it("short unrealized P&L is positive when price drops", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      direction: "short",
    });

    tracker.openPosition(100, 100, 1000);
    tracker.updatePrice({
      time: 2000, open: 95, high: 96, low: 93, close: 95, volume: 1000,
    });

    const account = tracker.getAccount();
    // Short: profit when price drops: (100-95) * 100 = 500
    expect(account.unrealizedPnl).toBeCloseTo(500, 0);
  });

  it("long position (default) still works correctly", () => {
    const tracker = createPositionTracker({
      capital: 100000,
      stopLoss: 5,
    });

    tracker.openPosition(100, 100, 1000);
    const pos = tracker.getPosition()!;
    expect(pos.direction).toBe("long");
    expect(pos.stopLossPrice).toBeCloseTo(95, 0);

    const { trade } = tracker.closePosition(110, 2000, "exit-signal");
    expect(trade.return).toBeGreaterThan(0);
    expect(trade.direction).toBeUndefined(); // long is omitted
  });
});
