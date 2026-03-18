import { describe, expect, it } from "vitest";
import type { BacktestResult, Trade } from "../../types";
import { quickRobustnessScore } from "../quick";

function mockTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    entryTime: Date.now(),
    entryPrice: 100,
    exitTime: Date.now() + 86400000,
    exitPrice: 105,
    return: 500,
    returnPercent: 5,
    holdingDays: 1,
    ...overrides,
  };
}

function mockBacktestResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    initialCapital: 100000,
    finalCapital: 120000,
    totalReturn: 20000,
    totalReturnPercent: 20,
    tradeCount: 20,
    winRate: 60,
    maxDrawdown: 10,
    sharpeRatio: 1.5,
    profitFactor: 1.8,
    avgHoldingDays: 5,
    trades: [],
    settings: {
      fillMode: "next-bar-open",
      slTpMode: "close-only",
      slippage: 0,
      commission: 0,
      commissionRate: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
    ...overrides,
  };
}

describe("quickRobustnessScore (edge cases & branch coverage)", () => {
  it("handles zero trades gracefully", () => {
    const result = mockBacktestResult({
      trades: [],
      tradeCount: 0,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Monte Carlo and trade consistency should be 0
    expect(robustness.dimensions.monteCarlo.score).toBe(0);
    expect(robustness.dimensions.monteCarlo.detail).toContain("Too few trades");
    expect(robustness.dimensions.tradeConsistency.score).toBe(0);
    expect(robustness.dimensions.tradeConsistency.detail).toContain("Too few trades");
    expect(robustness.compositeScore).toBeGreaterThanOrEqual(0);
  });

  it("handles all losing trades", () => {
    const trades = Array.from({ length: 20 }, () =>
      mockTrade({
        exitPrice: 95,
        return: -500,
        returnPercent: -5,
      }),
    );

    const result = mockBacktestResult({
      trades,
      tradeCount: 20,
      winRate: 0,
      profitFactor: 0,
      totalReturnPercent: -50,
      maxDrawdown: 50,
      sharpeRatio: -2,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    expect(robustness.dimensions.tradeConsistency.score).toBeLessThanOrEqual(20);
    expect(robustness.compositeScore).toBeLessThan(50);
  });

  it("handles maxDrawdown=0 (never in drawdown)", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: 2 + i * 0.1,
        return: 200 + i * 10,
      }),
    );

    const result = mockBacktestResult({
      trades,
      tradeCount: 20,
      winRate: 100,
      maxDrawdown: 0,
      profitFactor: Infinity,
      totalReturnPercent: 60,
      sharpeRatio: 3,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Drawdown resilience should be very high
    expect(robustness.dimensions.drawdownResilience.score).toBeGreaterThanOrEqual(80);
  });

  it("handles totalReturnPercent=0 (ciScore else branch)", () => {
    // Triggers originalReturn === 0 → ciScore = 50
    const trades = Array.from({ length: 10 }, (_, i) =>
      mockTrade({
        returnPercent: i % 2 === 0 ? 5 : -5,
        return: i % 2 === 0 ? 500 : -500,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: 10,
      winRate: 50,
      profitFactor: 1.0,
      totalReturnPercent: 0,
      maxDrawdown: 5,
      sharpeRatio: 0,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });
    expect(robustness.compositeScore).toBeGreaterThanOrEqual(0);
  });

  it("handles negative totalReturnPercent with maxDrawdown > 0 (recoveryFactor negative)", () => {
    const trades = Array.from({ length: 10 }, () =>
      mockTrade({ returnPercent: -3, return: -300 }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: 10,
      winRate: 0,
      profitFactor: 0,
      totalReturnPercent: -30,
      maxDrawdown: 30,
      sharpeRatio: -2,
      drawdownPeriods: [],
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });
    // recoveryFactor = -30/30 = -1 → recoveryScore = max(0, -1*20) = 0
    expect(robustness.dimensions.drawdownResilience.score).toBeGreaterThanOrEqual(0);
  });

  it("handles drawdownPeriods with unrecovered periods", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mockTrade({ returnPercent: i % 3 === 0 ? -5 : 3 }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: 10,
      winRate: 60,
      maxDrawdown: 15,
      profitFactor: 1.5,
      totalReturnPercent: 10,
      drawdownPeriods: [
        {
          startTime: 1000,
          peakEquity: 110000,
          troughTime: 2000,
          troughEquity: 93500,
          maxDepthPercent: 15,
          durationBars: 20,
          // No recoveryTime → unrecovered
        } as never,
      ],
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });
    // recoveryRate = 0/1 = 0 → recoveryRateScore = 0
    expect(robustness.dimensions.drawdownResilience.score).toBeLessThan(80);
  });

  it("handles maxDrawdown=0 with negative returns (recoveryFactor else branch)", () => {
    const trades = Array.from({ length: 10 }, () =>
      mockTrade({ returnPercent: -1, return: -100 }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: 10,
      winRate: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      totalReturnPercent: -10,
      sharpeRatio: -1,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });
    // maxDrawdown=0, totalReturnPercent <= 0 → recoveryFactor = 0
    expect(robustness.dimensions.drawdownResilience.score).toBeGreaterThanOrEqual(0);
  });

  it("score is always in range 0-100", () => {
    // Extreme scenarios
    const scenarios = [
      { winRate: 0, maxDrawdown: 100, profitFactor: 0, totalReturnPercent: -100, sharpeRatio: -5 },
      { winRate: 100, maxDrawdown: 0, profitFactor: 999, totalReturnPercent: 500, sharpeRatio: 10 },
    ];

    for (const scenario of scenarios) {
      const trades = Array.from({ length: 20 }, () =>
        mockTrade({ returnPercent: scenario.winRate > 50 ? 5 : -5 }),
      );
      const result = mockBacktestResult({ trades, ...scenario });
      const robustness = quickRobustnessScore(result, { seed: 42 });

      expect(robustness.compositeScore).toBeGreaterThanOrEqual(0);
      expect(robustness.compositeScore).toBeLessThanOrEqual(100);

      for (const dim of Object.values(robustness.dimensions)) {
        expect(dim.score).toBeGreaterThanOrEqual(0);
        expect(dim.score).toBeLessThanOrEqual(100);
      }
    }
  });
});
