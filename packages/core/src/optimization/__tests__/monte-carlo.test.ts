import { describe, expect, it } from "vitest";
import type { BacktestResult, Trade } from "../../types";
import {
  calculateStatistics,
  formatMonteCarloResult,
  runMonteCarloSimulation,
  summarizeMonteCarloResult,
} from "../monte-carlo";

/**
 * Create mock trades for testing
 */
function createMockTrades(count: number, winRate = 0.6): Trade[] {
  const trades: Trade[] = [];
  const baseTime = Date.now() - count * 7 * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const isWin = Math.random() < winRate;
    const returnPercent = isWin
      ? 5 + Math.random() * 10 // 5-15% win
      : -(3 + Math.random() * 7); // -3 to -10% loss

    trades.push({
      entryTime: baseTime + i * 7 * 24 * 60 * 60 * 1000,
      entryPrice: 100,
      exitTime: baseTime + (i + 1) * 7 * 24 * 60 * 60 * 1000,
      exitPrice: 100 * (1 + returnPercent / 100),
      return: 1000 * (returnPercent / 100),
      returnPercent,
      holdingDays: 7,
    });
  }

  return trades;
}

/**
 * Create deterministic trades for reproducible tests
 */
function createDeterministicTrades(): Trade[] {
  const baseTime = Date.now();
  return [
    {
      entryTime: baseTime,
      entryPrice: 100,
      exitTime: baseTime + 86400000,
      exitPrice: 110,
      return: 100,
      returnPercent: 10,
      holdingDays: 1,
    },
    {
      entryTime: baseTime + 86400000 * 2,
      entryPrice: 110,
      exitTime: baseTime + 86400000 * 3,
      exitPrice: 105,
      return: -50,
      returnPercent: -4.55,
      holdingDays: 1,
    },
    {
      entryTime: baseTime + 86400000 * 4,
      entryPrice: 105,
      exitTime: baseTime + 86400000 * 5,
      exitPrice: 115,
      return: 100,
      returnPercent: 9.52,
      holdingDays: 1,
    },
    {
      entryTime: baseTime + 86400000 * 6,
      entryPrice: 115,
      exitTime: baseTime + 86400000 * 7,
      exitPrice: 120,
      return: 50,
      returnPercent: 4.35,
      holdingDays: 1,
    },
    {
      entryTime: baseTime + 86400000 * 8,
      entryPrice: 120,
      exitTime: baseTime + 86400000 * 9,
      exitPrice: 112,
      return: -80,
      returnPercent: -6.67,
      holdingDays: 1,
    },
  ];
}

/**
 * Create a mock backtest result
 */
function createMockBacktestResult(
  trades: Trade[],
  overrides: Partial<BacktestResult> = {},
): BacktestResult {
  const totalReturn = trades.reduce((sum, t) => sum + t.return, 0);
  const totalReturnPercent = trades.reduce((sum, t) => sum + t.returnPercent, 0);
  const wins = trades.filter((t) => t.return > 0);
  const losses = trades.filter((t) => t.return <= 0);
  const totalProfit = wins.reduce((sum, t) => sum + t.return, 0);
  const totalLoss = Math.abs(losses.reduce((sum, t) => sum + t.return, 0));

  return {
    initialCapital: 10000,
    finalCapital: 10000 + totalReturn,
    totalReturn,
    totalReturnPercent,
    tradeCount: trades.length,
    winRate: (wins.length / trades.length) * 100,
    maxDrawdown: 10,
    sharpeRatio: 1.2,
    profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 999,
    avgHoldingDays: 7,
    trades,
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

describe("Monte Carlo Simulation", () => {
  describe("calculateStatistics", () => {
    it("should return zeros for empty array", () => {
      const stats = calculateStatistics([]);
      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.stdDev).toBe(0);
    });

    it("should calculate correct mean", () => {
      const stats = calculateStatistics([1, 2, 3, 4, 5]);
      expect(stats.mean).toBe(3);
    });

    it("should calculate correct median for odd count", () => {
      const stats = calculateStatistics([1, 2, 3, 4, 5]);
      expect(stats.median).toBe(3);
    });

    it("should calculate correct median for even count", () => {
      const stats = calculateStatistics([1, 2, 3, 4]);
      expect(stats.median).toBe(2.5);
    });

    it("should calculate correct standard deviation", () => {
      const stats = calculateStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(stats.stdDev).toBeCloseTo(2, 1);
    });

    it("should calculate correct percentiles", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1);
      const stats = calculateStatistics(values);

      expect(stats.percentile5).toBeCloseTo(5.95, 1);
      expect(stats.percentile25).toBeCloseTo(25.75, 1);
      expect(stats.percentile75).toBeCloseTo(75.25, 1);
      expect(stats.percentile95).toBeCloseTo(95.05, 1);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(100);
    });
  });

  describe("runMonteCarloSimulation", () => {
    it("should throw error for less than 2 trades", () => {
      const trades = createDeterministicTrades().slice(0, 1);
      const result = createMockBacktestResult(trades);

      expect(() => runMonteCarloSimulation(result)).toThrow(
        "Need at least 2 trades for Monte Carlo simulation",
      );
    });

    it("should run with default options", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest);

      expect(mcResult.simulationCount).toBe(1000);
      expect(mcResult.assessment.confidenceLevel).toBe(0.95);
      expect(mcResult.statistics.sharpe).toBeDefined();
      expect(mcResult.statistics.maxDrawdown).toBeDefined();
      expect(mcResult.statistics.totalReturnPercent).toBeDefined();
      expect(mcResult.statistics.profitFactor).toBeDefined();
    });

    it("should run with custom simulation count", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest, {
        simulations: 100,
      });

      expect(mcResult.simulationCount).toBe(100);
    });

    it("should be reproducible with seed", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const result1 = runMonteCarloSimulation(backtest, {
        simulations: 100,
        seed: 42,
      });
      const result2 = runMonteCarloSimulation(backtest, {
        simulations: 100,
        seed: 42,
      });

      expect(result1.statistics.sharpe.mean).toBe(result2.statistics.sharpe.mean);
      expect(result1.pValue.sharpe).toBe(result2.pValue.sharpe);
    });

    it("should produce different max drawdown distributions with different seeds", () => {
      // Max drawdown is path-dependent, so different shuffles should produce different values
      const trades: Trade[] = Array.from({ length: 20 }, (_, i) => ({
        entryTime: Date.now() + i * 86400000,
        entryPrice: 100,
        exitTime: Date.now() + (i + 1) * 86400000,
        exitPrice: i % 3 === 0 ? 95 : 110, // Mix of wins and losses
        return: i % 3 === 0 ? -50 : 100,
        returnPercent: i % 3 === 0 ? -5 : 10,
        holdingDays: 1,
      }));
      const backtest = createMockBacktestResult(trades);

      const result1 = runMonteCarloSimulation(backtest, {
        simulations: 500,
        seed: 42,
      });
      const result2 = runMonteCarloSimulation(backtest, {
        simulations: 500,
        seed: 99999,
      });

      // Max drawdown statistics should differ because drawdown is path-dependent
      // At minimum, the percentiles or stdDev should be different
      const maxDDMatch =
        result1.statistics.maxDrawdown.percentile5 === result2.statistics.maxDrawdown.percentile5 &&
        result1.statistics.maxDrawdown.percentile95 === result2.statistics.maxDrawdown.percentile95;
      expect(maxDDMatch).toBe(false);
    });

    it("should preserve original result values", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades, {
        sharpeRatio: 1.5,
        maxDrawdown: 8,
        totalReturnPercent: 15,
        profitFactor: 2.5,
      });

      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      expect(mcResult.originalResult.sharpe).toBe(1.5);
      expect(mcResult.originalResult.maxDrawdown).toBe(8);
      expect(mcResult.originalResult.totalReturnPercent).toBe(15);
      expect(mcResult.originalResult.profitFactor).toBe(2.5);
    });

    it("should calculate p-values between 0 and 1", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      expect(mcResult.pValue.sharpe).toBeGreaterThanOrEqual(0);
      expect(mcResult.pValue.sharpe).toBeLessThanOrEqual(1);
      expect(mcResult.pValue.returns).toBeGreaterThanOrEqual(0);
      expect(mcResult.pValue.returns).toBeLessThanOrEqual(1);
    });

    it("should calculate confidence intervals", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest, {
        simulations: 100,
        confidenceLevel: 0.95,
      });

      expect(mcResult.confidenceInterval.sharpe.lower).toBeDefined();
      expect(mcResult.confidenceInterval.sharpe.upper).toBeDefined();
      expect(mcResult.confidenceInterval.sharpe.lower).toBeLessThanOrEqual(
        mcResult.confidenceInterval.sharpe.upper,
      );
    });

    it("should provide assessment", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      expect(typeof mcResult.assessment.isSignificant).toBe("boolean");
      expect(typeof mcResult.assessment.reason).toBe("string");
      expect(mcResult.assessment.reason.length).toBeGreaterThan(0);
    });

    it("should call progress callback", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);

      let callCount = 0;
      let lastCurrent = 0;

      runMonteCarloSimulation(backtest, {
        simulations: 50,
        progressCallback: (current, total) => {
          callCount++;
          lastCurrent = current;
          expect(total).toBe(50);
          expect(current).toBeGreaterThanOrEqual(1);
          expect(current).toBeLessThanOrEqual(50);
        },
      });

      expect(callCount).toBe(50);
      expect(lastCurrent).toBe(50);
    });
  });

  describe("formatMonteCarloResult", () => {
    it("should format result as string", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);
      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      const formatted = formatMonteCarloResult(mcResult);

      expect(typeof formatted).toBe("string");
      expect(formatted).toContain("Monte Carlo Simulation Results");
      expect(formatted).toContain("Simulations:");
      expect(formatted).toContain("Sharpe:");
      expect(formatted).toContain("Assessment:");
    });

    it("should include significance assessment", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);
      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      const formatted = formatMonteCarloResult(mcResult);

      expect(formatted).toMatch(/SIGNIFICANT|NOT SIGNIFICANT/);
    });
  });

  describe("summarizeMonteCarloResult", () => {
    it("should return summary object", () => {
      const trades = createDeterministicTrades();
      const backtest = createMockBacktestResult(trades);
      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      const summary = summarizeMonteCarloResult(mcResult);

      expect(typeof summary.isSignificant).toBe("boolean");
      expect(typeof summary.pValueSharpe).toBe("number");
      expect(typeof summary.pValueReturns).toBe("number");
      expect(summary.expectedSharpe).toHaveProperty("mean");
      expect(summary.expectedSharpe).toHaveProperty("median");
      expect(summary.sharpe95CI).toHaveProperty("lower");
      expect(summary.sharpe95CI).toHaveProperty("upper");
    });
  });

  describe("edge cases", () => {
    it("should handle trades with all wins", () => {
      const trades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
        entryTime: Date.now() + i * 86400000,
        entryPrice: 100,
        exitTime: Date.now() + (i + 1) * 86400000,
        exitPrice: 110,
        return: 100,
        returnPercent: 10,
        holdingDays: 1,
      }));

      const backtest = createMockBacktestResult(trades);
      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      // All wins shuffled should still be all wins
      expect(mcResult.statistics.totalReturnPercent.mean).toBeGreaterThan(0);
    });

    it("should handle trades with all losses", () => {
      const trades: Trade[] = Array.from({ length: 5 }, (_, i) => ({
        entryTime: Date.now() + i * 86400000,
        entryPrice: 100,
        exitTime: Date.now() + (i + 1) * 86400000,
        exitPrice: 90,
        return: -100,
        returnPercent: -10,
        holdingDays: 1,
      }));

      const backtest = createMockBacktestResult(trades);
      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      expect(mcResult.statistics.totalReturnPercent.mean).toBeLessThan(0);
    });

    it("should handle exactly 2 trades", () => {
      const trades = createDeterministicTrades().slice(0, 2);
      const backtest = createMockBacktestResult(trades);

      const mcResult = runMonteCarloSimulation(backtest, { simulations: 100 });

      expect(mcResult.simulationCount).toBe(100);
    });
  });
});
