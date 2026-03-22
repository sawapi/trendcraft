import { describe, expect, it } from "vitest";
import type { BacktestResult } from "../../types";
import { scoreBacktestResult } from "../scoring";

function makeResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    initialCapital: 100_000,
    finalCapital: 120_000,
    totalReturn: 20_000,
    totalReturnPercent: 20,
    tradeCount: 50,
    winRate: 55,
    maxDrawdown: 10,
    sharpeRatio: 1.5,
    profitFactor: 1.8,
    avgHoldingDays: 5,
    trades: [],
    settings: {
      fillMode: "next-bar-open",
      slTpMode: "close-only",
      direction: "long",
      commission: 0,
      commissionRate: 0,
      slippage: 0,
      taxRate: 0,
    },
    drawdownPeriods: [],
    ...overrides,
  };
}

describe("scoreBacktestResult", () => {
  it("should produce a score between 0 and 100", () => {
    const result = makeResult();
    const score = scoreBacktestResult(result);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("should include breakdown for all metrics", () => {
    const score = scoreBacktestResult(makeResult());
    expect(score.breakdown.sharpe).toBeDefined();
    expect(score.breakdown.winRate).toBeDefined();
    expect(score.breakdown.maxDrawdown).toBeDefined();
    expect(score.breakdown.profitFactor).toBeDefined();
    expect(score.breakdown.totalReturn).toBeDefined();
  });

  it("should score a good result higher than a poor result", () => {
    const good = scoreBacktestResult(
      makeResult({
        sharpeRatio: 2.5,
        winRate: 65,
        maxDrawdown: 5,
        profitFactor: 3,
        totalReturnPercent: 50,
      }),
    );
    const poor = scoreBacktestResult(
      makeResult({
        sharpeRatio: 0.3,
        winRate: 35,
        maxDrawdown: 40,
        profitFactor: 0.8,
        totalReturnPercent: -10,
      }),
    );
    expect(good.score).toBeGreaterThan(poor.score);
  });

  it("should respect custom weights", () => {
    const result = makeResult({ sharpeRatio: 3, winRate: 30 });
    const sharpeHeavy = scoreBacktestResult(result, {
      weights: { sharpe: 1, winRate: 0, maxDrawdown: 0, profitFactor: 0, totalReturn: 0 },
    });
    const wrHeavy = scoreBacktestResult(result, {
      weights: { sharpe: 0, winRate: 1, maxDrawdown: 0, profitFactor: 0, totalReturn: 0 },
    });
    // High Sharpe with Sharpe-only weight should score higher
    expect(sharpeHeavy.score).toBeGreaterThan(wrHeavy.score);
  });

  it("should handle zero/negative metrics gracefully", () => {
    const score = scoreBacktestResult(
      makeResult({
        sharpeRatio: -1,
        winRate: 0,
        maxDrawdown: 60,
        profitFactor: 0,
        totalReturnPercent: -50,
      }),
    );
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  it("should normalize weights to sum to 1", () => {
    const score = scoreBacktestResult(makeResult(), {
      weights: { sharpe: 6, winRate: 4, maxDrawdown: 4, profitFactor: 3, totalReturn: 3 },
    });
    const totalWeight = Object.values(score.breakdown).reduce((sum, b) => sum + b.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });

  it("breakdown contributions should sum to score", () => {
    const score = scoreBacktestResult(makeResult());
    const sumContributions = Object.values(score.breakdown).reduce(
      (sum, b) => sum + b.contribution,
      0,
    );
    expect(score.score).toBeCloseTo(sumContributions, 5);
  });
});
