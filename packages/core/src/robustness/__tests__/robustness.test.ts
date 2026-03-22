import { describe, expect, it } from "vitest";
import type { BacktestResult, DrawdownPeriod, Trade } from "../../types";
import type { RobustnessGrade } from "../../types/robustness";
import { scoreToGrade } from "../grade";
import { quickRobustnessScore } from "../quick";

/**
 * Helper to create a mock Trade
 */
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

/**
 * Helper to create a mock BacktestResult
 */
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

describe("scoreToGrade", () => {
  it("returns correct grades for boundary scores", () => {
    const cases: [number, RobustnessGrade][] = [
      [100, "A+"],
      [90, "A+"],
      [89.9, "A"],
      [80, "A"],
      [79.9, "B+"],
      [70, "B+"],
      [69.9, "B"],
      [60, "B"],
      [59.9, "C+"],
      [50, "C+"],
      [49.9, "C"],
      [40, "C"],
      [39.9, "D"],
      [25, "D"],
      [24.9, "F"],
      [0, "F"],
    ];
    for (const [score, expected] of cases) {
      expect(scoreToGrade(score)).toBe(expected);
    }
  });
});

describe("quickRobustnessScore", () => {
  it("returns valid result structure", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: i % 3 === 0 ? -2 : 4,
        return: i % 3 === 0 ? -200 : 400,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: trades.length,
      winRate: 66.7,
      profitFactor: 2.0,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Structure checks
    expect(robustness).toHaveProperty("compositeScore");
    expect(robustness).toHaveProperty("grade");
    expect(robustness).toHaveProperty("dimensions");
    expect(robustness).toHaveProperty("assessment");
    expect(robustness).toHaveProperty("recommendations");

    expect(robustness.dimensions).toHaveProperty("monteCarlo");
    expect(robustness.dimensions).toHaveProperty("tradeConsistency");
    expect(robustness.dimensions).toHaveProperty("drawdownResilience");

    // Score in valid range
    expect(robustness.compositeScore).toBeGreaterThanOrEqual(0);
    expect(robustness.compositeScore).toBeLessThanOrEqual(100);

    // Grade is valid
    const validGrades: RobustnessGrade[] = ["A+", "A", "B+", "B", "C+", "C", "D", "F"];
    expect(validGrades).toContain(robustness.grade);

    // Each dimension has expected fields
    for (const dim of Object.values(robustness.dimensions)) {
      expect(dim).toHaveProperty("name");
      expect(dim).toHaveProperty("score");
      expect(dim).toHaveProperty("weight");
      expect(dim).toHaveProperty("detail");
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it("gives good grade for high win rate and low drawdown", () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      mockTrade({
        returnPercent: i % 5 === 0 ? -1 : 3,
        return: i % 5 === 0 ? -100 : 300,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: trades.length,
      winRate: 80,
      maxDrawdown: 5,
      profitFactor: 3.0,
      totalReturnPercent: 40,
      sharpeRatio: 2.0,
      drawdownPeriods: [
        {
          startTime: 1000,
          peakEquity: 110000,
          troughTime: 2000,
          troughEquity: 104500,
          recoveryTime: 3000,
          maxDepthPercent: 5,
          durationBars: 10,
        } as DrawdownPeriod,
      ],
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // High win rate, low drawdown, good profit factor should yield decent grade
    expect(robustness.compositeScore).toBeGreaterThan(40);
    expect(robustness.dimensions.tradeConsistency.score).toBeGreaterThan(50);
    expect(robustness.dimensions.drawdownResilience.score).toBeGreaterThan(50);
  });

  it("gives low grade for poor trades", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: i % 5 === 0 ? 10 : -3,
        return: i % 5 === 0 ? 1000 : -300,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: trades.length,
      winRate: 20,
      maxDrawdown: 35,
      profitFactor: 0.7,
      totalReturnPercent: -15,
      sharpeRatio: -0.5,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Poor metrics should produce a low score
    expect(robustness.compositeScore).toBeLessThan(50);
    expect(robustness.dimensions.tradeConsistency.score).toBeLessThan(30);
  });

  it("handles insufficient trades gracefully", () => {
    const trades = [
      mockTrade({ returnPercent: 5, return: 500 }),
      mockTrade({ returnPercent: -2, return: -200 }),
    ];
    const result = mockBacktestResult({
      trades,
      tradeCount: 2,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Monte Carlo and trade consistency should report low scores due to few trades
    expect(robustness.dimensions.monteCarlo.score).toBe(0);
    expect(robustness.dimensions.monteCarlo.detail).toContain("Too few trades");
    expect(robustness.dimensions.tradeConsistency.score).toBe(0);
  });

  it("generates recommendations for weak dimensions", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: i % 5 === 0 ? 8 : -2.5,
        return: i % 5 === 0 ? 800 : -250,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: trades.length,
      winRate: 20,
      maxDrawdown: 35,
      profitFactor: 0.65,
      totalReturnPercent: -10,
      sharpeRatio: -0.3,
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Should generate at least one recommendation since metrics are poor
    expect(robustness.recommendations.length).toBeGreaterThan(0);
    // Recommendations should be strings
    for (const rec of robustness.recommendations) {
      expect(typeof rec).toBe("string");
      expect(rec.length).toBeGreaterThan(0);
    }
  });

  it("generates positive recommendation when all dimensions pass", () => {
    const trades = Array.from({ length: 30 }, (_, i) =>
      mockTrade({
        returnPercent: i % 4 === 0 ? -0.5 : 3,
        return: i % 4 === 0 ? -50 : 300,
      }),
    );
    const result = mockBacktestResult({
      trades,
      tradeCount: trades.length,
      winRate: 75,
      maxDrawdown: 3,
      profitFactor: 4.0,
      totalReturnPercent: 50,
      sharpeRatio: 2.5,
      drawdownPeriods: [
        {
          startTime: 1000,
          peakEquity: 110000,
          troughTime: 2000,
          troughEquity: 106700,
          recoveryTime: 3000,
          maxDepthPercent: 3,
          durationBars: 10,
        } as DrawdownPeriod,
      ],
    });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // When all dimensions are high, should get the "passes all" recommendation
    if (
      robustness.dimensions.monteCarlo.score >= 50 &&
      robustness.dimensions.tradeConsistency.score >= 50 &&
      robustness.dimensions.drawdownResilience.score >= 50
    ) {
      expect(robustness.recommendations).toContain(
        "Strategy passes all robustness checks. Consider walk-forward analysis for additional confidence.",
      );
    }
  });

  it("dimension weights sum correctly", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: i % 3 === 0 ? -2 : 4,
        return: i % 3 === 0 ? -200 : 400,
      }),
    );
    const result = mockBacktestResult({ trades });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    const totalWeight =
      robustness.dimensions.monteCarlo.weight +
      robustness.dimensions.tradeConsistency.weight +
      robustness.dimensions.drawdownResilience.weight;

    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("assessment text matches grade", () => {
    const trades = Array.from({ length: 20 }, (_, i) =>
      mockTrade({
        returnPercent: i % 3 === 0 ? -2 : 4,
        return: i % 3 === 0 ? -200 : 400,
      }),
    );
    const result = mockBacktestResult({ trades });

    const robustness = quickRobustnessScore(result, { seed: 42 });

    // Assessment should contain the grade
    expect(robustness.assessment).toContain(robustness.grade);
  });
});
