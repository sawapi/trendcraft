import { describe, expect, it } from "vitest";
import type { Trade } from "../../types";
import { calculateRuntimeMetrics } from "../runtime-metrics";

function makeTrade(overrides: Partial<Trade> & { return: number; returnPercent: number }): Trade {
  return {
    entryTime: 1000,
    entryPrice: 100,
    exitTime: 2000,
    exitPrice: 100 + overrides.return,
    holdingDays: 5,
    ...overrides,
  };
}

describe("calculateRuntimeMetrics", () => {
  it("should return zeros for empty trades", () => {
    const metrics = calculateRuntimeMetrics([]);
    expect(metrics.tradeCount).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.sortinoRatio).toBe(0);
    expect(metrics.calmarRatio).toBe(0);
    expect(metrics.maxDrawdown).toBe(0);
    expect(metrics.totalReturn).toBe(0);
  });

  it("should calculate basic metrics from trades", () => {
    const trades: Trade[] = [
      makeTrade({ return: 1000, returnPercent: 1 }),
      makeTrade({ return: -500, returnPercent: -0.5 }),
      makeTrade({ return: 2000, returnPercent: 2 }),
      makeTrade({ return: 800, returnPercent: 0.8 }),
    ];

    const metrics = calculateRuntimeMetrics(trades, { initialCapital: 100_000 });

    expect(metrics.tradeCount).toBe(4);
    expect(metrics.winCount).toBe(3);
    expect(metrics.lossCount).toBe(1);
    expect(metrics.totalReturn).toBe(3300);
    expect(metrics.totalReturnPercent).toBeCloseTo(3.3, 1);
    expect(metrics.maxDrawdown).toBeGreaterThan(0);
  });

  it("should calculate drawdown from equity curve", () => {
    const trades: Trade[] = [
      makeTrade({ return: 5000, returnPercent: 5 }),
      makeTrade({ return: -3000, returnPercent: -3 }),
      makeTrade({ return: -2000, returnPercent: -2 }),
      makeTrade({ return: 4000, returnPercent: 4 }),
    ];

    const metrics = calculateRuntimeMetrics(trades, { initialCapital: 100_000 });

    // Peak after trade 1: 105000, trough after trade 3: 100000
    expect(metrics.maxDrawdown).toBe(5000);
    expect(metrics.maxDrawdownPercent).toBeCloseTo(4.76, 1);
  });

  it("should calculate Sharpe and Sortino ratios", () => {
    const trades: Trade[] = [
      makeTrade({ return: 1000, returnPercent: 1 }),
      makeTrade({ return: 1500, returnPercent: 1.5 }),
      makeTrade({ return: -500, returnPercent: -0.5 }),
      makeTrade({ return: 2000, returnPercent: 2 }),
      makeTrade({ return: 800, returnPercent: 0.8 }),
    ];

    const metrics = calculateRuntimeMetrics(trades);

    // All positive on average, so both ratios should be positive
    expect(metrics.sharpeRatio).toBeGreaterThan(0);
    // Sortino should be >= Sharpe when downside is less than total vol
    expect(metrics.sortinoRatio).toBeGreaterThan(0);
  });

  it("should include TradeStats fields", () => {
    const trades: Trade[] = [
      makeTrade({ return: 1000, returnPercent: 1 }),
      makeTrade({ return: -500, returnPercent: -0.5 }),
    ];

    const metrics = calculateRuntimeMetrics(trades);

    expect(metrics.winRate).toBe(50);
    expect(metrics.profitFactor).toBe(2);
    expect(metrics.avgWin).toBe(1);
    expect(metrics.avgLoss).toBe(-0.5);
  });

  it("should calculate average holding days", () => {
    const trades: Trade[] = [
      makeTrade({ return: 1000, returnPercent: 1, holdingDays: 3 }),
      makeTrade({ return: -500, returnPercent: -0.5, holdingDays: 7 }),
    ];

    const metrics = calculateRuntimeMetrics(trades);
    expect(metrics.avgHoldingDays).toBe(5);
  });

  it("should calculate recovery factor", () => {
    const trades: Trade[] = [
      makeTrade({ return: 5000, returnPercent: 5 }),
      makeTrade({ return: -3000, returnPercent: -3 }),
      makeTrade({ return: 4000, returnPercent: 4 }),
    ];

    const metrics = calculateRuntimeMetrics(trades, { initialCapital: 100_000 });
    // totalReturn = 6000, maxDrawdown = 3000
    expect(metrics.recoveryFactor).toBe(2);
  });
});
