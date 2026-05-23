import { describe, expect, it } from "vitest";
import type { BacktestSettings, DrawdownPeriod, Trade } from "../../types";
import { calculateStats, emptyResult, MS_PER_DAY } from "../scaled-entry-utils";

const SETTINGS: BacktestSettings = {
  capital: 100_000,
  commission: 0,
  taxRate: 0,
  stopLoss: 0,
  takeProfit: 0,
  trailingStop: 0,
  scaledEntry: false,
  scalingTranches: 1,
  scalingDistribution: "equal",
  slippage: 0,
  fillMode: "close",
};

function makeTrade(
  index: number,
  returnPercent: number,
  holdingDays: number,
  initialCapital: number,
): Trade {
  const entryTime = new Date(2024, 0, 1 + index * 5).getTime();
  const exitTime = entryTime + holdingDays * MS_PER_DAY;
  const entryPrice = 100;
  const exitPrice = 100 + returnPercent;
  return {
    entryTime,
    entryPrice,
    exitTime,
    exitPrice,
    return: (initialCapital * returnPercent) / 100,
    returnPercent,
    holdingDays,
  };
}

describe("extended BacktestResult metrics", () => {
  it("emptyResult includes zero values for new metric fields", () => {
    const result = emptyResult(100_000, SETTINGS);
    expect(result.sortinoRatio).toBe(0);
    expect(result.calmarRatio).toBe(0);
    expect(result.cagrPercent).toBe(0);
    expect(result.expectancyPercent).toBe(0);
    expect(result.exposurePercent).toBe(0);
    expect(result.avgWinPercent).toBe(0);
    expect(result.avgLossPercent).toBe(0);
    expect(result.largestWinPercent).toBe(0);
    expect(result.largestLossPercent).toBe(0);
  });

  it("expectancy equals the arithmetic mean of trade.returnPercent", () => {
    // 3 wins of 5%, 2 losses of 3% → expectancy = (3*5 - 2*3)/5 = 1.8%
    const trades: Trade[] = [
      makeTrade(0, 5, 4, 100_000),
      makeTrade(1, 5, 4, 100_000),
      makeTrade(2, 5, 4, 100_000),
      makeTrade(3, -3, 4, 100_000),
      makeTrade(4, -3, 4, 100_000),
    ];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 109_000, 5, SETTINGS, []);
    expect(result.expectancyPercent).toBe(1.8);
  });

  it("avgWin / avgLoss / largestWin / largestLoss are reported as positive percentages", () => {
    const trades: Trade[] = [
      makeTrade(0, 2, 4, 100_000),
      makeTrade(1, 8, 4, 100_000),
      makeTrade(2, -4, 4, 100_000),
      makeTrade(3, -1, 4, 100_000),
    ];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 105_000, 5, SETTINGS, []);
    expect(result.avgWinPercent).toBe(5); // (2 + 8) / 2
    expect(result.avgLossPercent).toBe(2.5); // |(-4 + -1) / 2|
    expect(result.largestWinPercent).toBe(8);
    expect(result.largestLossPercent).toBe(4); // |min(-4, -1)|
  });

  it("Sortino is 0 when there are no negative returns", () => {
    const trades: Trade[] = [
      makeTrade(0, 2, 4, 100_000),
      makeTrade(1, 3, 4, 100_000),
      makeTrade(2, 1, 4, 100_000),
    ];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 106_000, 0, SETTINGS, []);
    expect(result.sortinoRatio).toBe(0);
    // Sharpe should still be non-zero (stddev of strictly positive returns is non-zero)
    expect(result.sharpeRatio).toBeGreaterThan(0);
  });

  it("Sortino divides by downside deviation only (penalizes losses, ignores upside variance)", () => {
    // 3 wins of +4%, 1 loss of -2%. The wins contribute upside
    // variance Sharpe penalizes but Sortino doesn't — so Sortino
    // should come in higher than Sharpe on this shape.
    const trades: Trade[] = [
      makeTrade(0, 4, 4, 100_000),
      makeTrade(1, 4, 4, 100_000),
      makeTrade(2, 4, 4, 100_000),
      makeTrade(3, -2, 4, 100_000),
    ];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 110_000, 2, SETTINGS, []);
    expect(result.sortinoRatio).toBeGreaterThan(0);
    expect(result.sortinoRatio).toBeGreaterThan(result.sharpeRatio);
  });

  it("exposure is 100% when trades cover the full backtest span", () => {
    // 5 trades, each 20 days, contiguous → 100 days total holding
    // span = 100 days exactly → 100% exposure
    const startTime = new Date(2024, 0, 1).getTime();
    const trades: Trade[] = Array.from({ length: 5 }, (_, i) => {
      const entryTime = startTime + i * 20 * MS_PER_DAY;
      const exitTime = entryTime + 20 * MS_PER_DAY;
      return {
        entryTime,
        entryPrice: 100,
        exitTime,
        exitPrice: 101,
        return: 100,
        returnPercent: 1,
        holdingDays: 20,
      };
    });
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 105_000, 1, SETTINGS, [], {
      firstTime: startTime,
      lastTime: startTime + 100 * MS_PER_DAY,
    });
    expect(result.exposurePercent).toBe(100);
  });

  it("exposure is half when trades cover half the backtest span", () => {
    const startTime = new Date(2024, 0, 1).getTime();
    const trades: Trade[] = [
      {
        entryTime: startTime,
        entryPrice: 100,
        exitTime: startTime + 25 * MS_PER_DAY,
        exitPrice: 101,
        return: 100,
        returnPercent: 1,
        holdingDays: 25,
      },
      {
        entryTime: startTime + 50 * MS_PER_DAY,
        entryPrice: 100,
        exitTime: startTime + 75 * MS_PER_DAY,
        exitPrice: 101,
        return: 100,
        returnPercent: 1,
        holdingDays: 25,
      },
    ];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 102_000, 1, SETTINGS, [], {
      firstTime: startTime,
      lastTime: startTime + 100 * MS_PER_DAY,
    });
    expect(result.exposurePercent).toBe(50);
  });

  it("exposure is 0 when no span info is provided", () => {
    const trades = [makeTrade(0, 5, 4, 100_000)];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 105_000, 1, SETTINGS, []);
    expect(result.exposurePercent).toBe(0);
    expect(result.cagrPercent).toBe(0);
  });

  it("CAGR matches the geometric annualized return for a 1-year backtest", () => {
    // +21% over 365.25 days → CAGR ≈ 21%
    const startTime = new Date(2024, 0, 1).getTime();
    const trade = makeTrade(0, 21, 200, 100_000);
    trade.entryTime = startTime;
    trade.exitTime = startTime + 200 * MS_PER_DAY;
    const trades = [trade];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 121_000, 5, SETTINGS, [], {
      firstTime: startTime,
      lastTime: startTime + Math.round(365.25) * MS_PER_DAY,
    });
    expect(result.cagrPercent).toBeCloseTo(21, 0);
  });

  it("Calmar is CAGR divided by max drawdown when both are positive", () => {
    const startTime = new Date(2024, 0, 1).getTime();
    const trade = makeTrade(0, 20, 100, 100_000);
    trade.entryTime = startTime;
    trade.exitTime = startTime + 100 * MS_PER_DAY;
    const trades = [trade];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 120_000, 10, SETTINGS, [], {
      firstTime: startTime,
      lastTime: startTime + Math.round(365.25) * MS_PER_DAY,
    });
    // CAGR ≈ 20%, DD = 10% → Calmar ≈ 2.0
    expect(result.calmarRatio).toBeCloseTo(2, 0);
  });

  it("Calmar is 0 when max drawdown is 0 (no drawdown observed)", () => {
    const startTime = new Date(2024, 0, 1).getTime();
    const trade = makeTrade(0, 5, 100, 100_000);
    trade.entryTime = startTime;
    trade.exitTime = startTime + 100 * MS_PER_DAY;
    const trades = [trade];
    const returns = trades.map((t) => t.returnPercent / 100);
    const result = calculateStats(trades, returns, 100_000, 105_000, 0, SETTINGS, [], {
      firstTime: startTime,
      lastTime: startTime + Math.round(365.25) * MS_PER_DAY,
    });
    expect(result.calmarRatio).toBe(0);
  });

  it("downstream drawdownPeriods passthrough still works", () => {
    const trades = [makeTrade(0, 5, 4, 100_000)];
    const returns = trades.map((t) => t.returnPercent / 100);
    const periods: DrawdownPeriod[] = [
      {
        startTime: 0,
        peakEquity: 100_000,
        troughTime: 1000,
        troughEquity: 95_000,
        maxDepthPercent: 5,
        durationBars: 10,
      },
    ];
    const result = calculateStats(trades, returns, 100_000, 105_000, 5, SETTINGS, periods);
    expect(result.drawdownPeriods).toBe(periods);
  });
});
