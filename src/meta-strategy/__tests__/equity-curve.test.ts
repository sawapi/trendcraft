import { describe, it, expect } from "vitest";
import { applyEquityCurveFilter, equityCurveHealth } from "../equity-curve";
import type { BacktestResult, Trade } from "../../types";

function makeTrade(
  i: number,
  returnAmt: number,
  holdingDays = 1,
): Trade {
  const entryPrice = 100;
  const exitPrice = entryPrice + returnAmt / 100;
  return {
    entryTime: 1000000 + i * 86400000 * 2,
    entryPrice,
    exitTime: 1000000 + (i * 2 + 1) * 86400000,
    exitPrice,
    return: returnAmt,
    returnPercent: (returnAmt / 10000) * 100,
    holdingDays,
  };
}

function makeResult(trades: Trade[]): BacktestResult {
  const initial = 10000;
  const totalReturn = trades.reduce((s, t) => s + t.return, 0);
  const wins = trades.filter((t) => t.return > 0);
  const losses = trades.filter((t) => t.return <= 0);
  const grossProfit = wins.reduce((s, t) => s + t.return, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.return, 0));

  return {
    initialCapital: initial,
    finalCapital: initial + totalReturn,
    totalReturn,
    totalReturnPercent: (totalReturn / initial) * 100,
    tradeCount: trades.length,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    maxDrawdown: 0.1,
    sharpeRatio: 1.0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? Infinity : 0),
    avgHoldingDays: trades.length > 0
      ? trades.reduce((s, t) => s + t.holdingDays, 0) / trades.length
      : 0,
    trades,
    settings: { fillMode: "next-bar-open", slTpMode: "close-only", slippage: 0, commission: 0, commissionRate: 0, taxRate: 0 },
    drawdownPeriods: [],
  };
}

describe("applyEquityCurveFilter", () => {
  it("returns original when no trades", () => {
    const result = makeResult([]);
    const analysis = applyEquityCurveFilter(result);
    expect(analysis.tradesSkipped).toBe(0);
    expect(analysis.filtered.tradeCount).toBe(0);
  });

  it("does not skip trades when equity stays above MA", () => {
    // All winning trades → equity always above SMA
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade(i, 200));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });
    // With steadily rising equity, most trades should pass
    expect(analysis.tradesSkipped).toBeLessThanOrEqual(1);
  });

  it("skips trades during losing streak with MA filter", () => {
    // 10 winners, then 10 losers, then 10 winners
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 20; i++) trades.push(makeTrade(i, -300));
    for (let i = 20; i < 30; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });
    expect(analysis.tradesSkipped).toBeGreaterThan(0);
  });

  it("drawdown filter pauses trading when DD exceeds threshold", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 5; i++) trades.push(makeTrade(i, 200));
    // Large losses to trigger drawdown
    for (let i = 5; i < 15; i++) trades.push(makeTrade(i, -400));
    for (let i = 15; i < 25; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "drawdown",
      maxDrawdown: 0.1,
    });
    expect(analysis.tradesSkipped).toBeGreaterThan(0);
  });

  it("filtered result preserves original settings", () => {
    const trades = Array.from({ length: 5 }, (_, i) => makeTrade(i, 100));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result);
    expect(analysis.filtered.settings).toEqual(result.settings);
  });

  it("filteredSizeFactor scales trades instead of skipping", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 5; i++) trades.push(makeTrade(i, 200));
    for (let i = 5; i < 15; i++) trades.push(makeTrade(i, -300));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "ma",
      maPeriod: 3,
      filteredSizeFactor: 0.5,
    });

    // With factor 0.5, skipped trades become half-size
    // filtered should still have all trades
    if (analysis.tradesSkipped > 0) {
      expect(analysis.filtered.tradeCount).toBe(result.tradeCount);
    }
  });

  it("improvement shows correct direction for maxDrawdown", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 20; i++) trades.push(makeTrade(i, -300));
    for (let i = 20; i < 30; i++) trades.push(makeTrade(i, 200));

    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, { type: "ma", maPeriod: 5 });

    if (analysis.tradesSkipped > 0) {
      // DD improvement should be non-negative (filtered DD <= original)
      expect(analysis.improvement.maxDrawdown).toBeGreaterThanOrEqual(0);
    }
  });

  it("all losses → most trades skipped", () => {
    const trades = Array.from({ length: 30 }, (_, i) => makeTrade(i, -200));
    const result = makeResult(trades);
    const analysis = applyEquityCurveFilter(result, {
      type: "ma",
      maPeriod: 5,
    });
    // After initial period, losses should cause equity below MA
    expect(analysis.tradesSkipped).toBeGreaterThan(10);
  });
});

describe("equityCurveHealth", () => {
  it("returns high health for all-winning strategy", () => {
    const trades = Array.from({ length: 20 }, (_, i) => makeTrade(i, 200));
    const result = makeResult(trades);
    const health = equityCurveHealth(result, { maPeriod: 10 });

    expect(health.aboveMa).toBe(true);
    expect(health.currentDrawdown).toBe(0);
    expect(health.rollingWinRate).toBe(1);
    expect(health.healthScore).toBeGreaterThanOrEqual(80);
  });

  it("returns low health for losing strategy", () => {
    const trades: Trade[] = [];
    for (let i = 0; i < 10; i++) trades.push(makeTrade(i, 200));
    for (let i = 10; i < 30; i++) trades.push(makeTrade(i, -200));

    const result = makeResult(trades);
    const health = equityCurveHealth(result, { maPeriod: 10 });

    expect(health.currentDrawdown).toBeGreaterThan(0);
    expect(health.rollingWinRate).toBeLessThan(0.5);
  });

  it("equityCurve has correct length", () => {
    const trades = Array.from({ length: 10 }, (_, i) => makeTrade(i, 100));
    const result = makeResult(trades);
    const health = equityCurveHealth(result);

    // Initial point + one per trade
    expect(health.equityCurve).toHaveLength(11);
  });

  it("health score stays between 0 and 100", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      makeTrade(i, i % 3 === 0 ? -300 : 100),
    );
    const result = makeResult(trades);
    const health = equityCurveHealth(result);

    expect(health.healthScore).toBeGreaterThanOrEqual(0);
    expect(health.healthScore).toBeLessThanOrEqual(100);
  });
});
