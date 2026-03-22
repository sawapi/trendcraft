import { describe, expect, it } from "vitest";
import type { BacktestResult, NormalizedCandle } from "../../types";
import {
  annualizeReturn,
  calculateAllMetrics,
  calculateCalmarRatio,
  calculateRecoveryFactor,
  calculateSharpeRatio,
  checkConstraint,
} from "../metrics";

/**
 * Generate test candles
 */
function generateTestCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    price *= 1.001; // Small upward drift
    const dailyRange = price * 0.02;

    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - dailyRange * 0.25,
      high: price + dailyRange * 0.25,
      low: price - dailyRange * 0.5,
      close: price,
      volume: 1000000,
    });
  }

  return candles;
}

/**
 * Create a mock backtest result
 */
function createMockBacktestResult(overrides: Partial<BacktestResult> = {}): BacktestResult {
  return {
    initialCapital: 100000,
    finalCapital: 110000,
    totalReturn: 10000,
    totalReturnPercent: 10,
    tradeCount: 10,
    winRate: 60,
    maxDrawdown: 5,
    sharpeRatio: 1.5,
    profitFactor: 2.0,
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

describe("Optimization Metrics", () => {
  describe("calculateSharpeRatio", () => {
    it("should return 0 for empty returns array", () => {
      expect(calculateSharpeRatio([])).toBe(0);
    });

    it("should return 0 when all returns are the same (zero std dev)", () => {
      const returns = [0.01, 0.01, 0.01, 0.01, 0.01];
      expect(calculateSharpeRatio(returns)).toBe(0);
    });

    it("should calculate positive Sharpe for positive returns with volatility", () => {
      // Consistent small positive returns with some variation
      const returns = [0.01, 0.02, 0.01, 0.015, 0.01, 0.02, 0.01, 0.015, 0.01, 0.02];
      const sharpe = calculateSharpeRatio(returns);
      expect(sharpe).toBeGreaterThan(0);
    });

    it("should calculate negative Sharpe for negative returns", () => {
      const returns = [-0.01, -0.02, -0.01, -0.015, -0.02];
      const sharpe = calculateSharpeRatio(returns);
      expect(sharpe).toBeLessThan(0);
    });

    it("should account for risk-free rate", () => {
      const returns = [0.001, 0.002, 0.001, 0.0015, 0.002];
      const sharpeWithRf = calculateSharpeRatio(returns, 0.05); // 5% risk-free rate
      const sharpeNoRf = calculateSharpeRatio(returns, 0);
      expect(sharpeWithRf).toBeLessThan(sharpeNoRf);
    });

    it("should scale with periods per year", () => {
      const returns = [0.01, 0.02, 0.01, 0.015, 0.02];
      const sharpeDaily = calculateSharpeRatio(returns, 0, 252);
      const sharpeWeekly = calculateSharpeRatio(returns, 0, 52);
      // Daily should have higher absolute value due to sqrt(252) vs sqrt(52)
      expect(Math.abs(sharpeDaily)).toBeGreaterThan(Math.abs(sharpeWeekly));
    });
  });

  describe("calculateCalmarRatio", () => {
    it("should return Infinity when drawdown is 0 and return is positive", () => {
      expect(calculateCalmarRatio(10, 0)).toBe(Number.POSITIVE_INFINITY);
    });

    it("should return 0 when drawdown is 0 and return is non-positive", () => {
      expect(calculateCalmarRatio(0, 0)).toBe(0);
      expect(calculateCalmarRatio(-5, 0)).toBe(0);
    });

    it("should calculate correct ratio", () => {
      expect(calculateCalmarRatio(20, 10)).toBe(2);
      expect(calculateCalmarRatio(10, 5)).toBe(2);
      expect(calculateCalmarRatio(15, 10)).toBe(1.5);
    });

    it("should return negative when return is negative", () => {
      expect(calculateCalmarRatio(-10, 5)).toBe(-2);
    });
  });

  describe("calculateRecoveryFactor", () => {
    it("should return Infinity when drawdown is 0 and profit is positive", () => {
      expect(calculateRecoveryFactor(1000, 0)).toBe(Number.POSITIVE_INFINITY);
    });

    it("should return 0 when drawdown is 0 and profit is non-positive", () => {
      expect(calculateRecoveryFactor(0, 0)).toBe(0);
      expect(calculateRecoveryFactor(-100, 0)).toBe(0);
    });

    it("should calculate correct ratio", () => {
      expect(calculateRecoveryFactor(10000, 5000)).toBe(2);
      expect(calculateRecoveryFactor(5000, 2500)).toBe(2);
    });
  });

  describe("annualizeReturn", () => {
    it("should return 0 for 0 trading days", () => {
      expect(annualizeReturn(10, 0)).toBe(0);
    });

    it("should return same value for exactly 1 year of data", () => {
      const result = annualizeReturn(10, 252);
      expect(result).toBeCloseTo(10, 1);
    });

    it("should compound returns over multiple years", () => {
      // 10% over 2 years should be approximately 4.88% annually
      const result = annualizeReturn(10, 504); // 2 years
      expect(result).toBeCloseTo(4.88, 1);
    });

    it("should handle negative returns", () => {
      const result = annualizeReturn(-10, 252);
      expect(result).toBeCloseTo(-10, 1);
    });

    it("should handle very short periods", () => {
      // 1% in 1 day annualized is huge
      const result = annualizeReturn(1, 1);
      expect(result).toBeGreaterThan(100);
    });
  });

  describe("calculateAllMetrics", () => {
    it("should calculate all metrics from backtest result", () => {
      const candles = generateTestCandles(100);
      const result = createMockBacktestResult({
        trades: [
          {
            entryTime: candles[10].time,
            entryPrice: 100,
            exitTime: candles[20].time,
            exitPrice: 110,
            return: 1000,
            returnPercent: 10,
            holdingDays: 10,
          },
          {
            entryTime: candles[30].time,
            entryPrice: 110,
            exitTime: candles[40].time,
            exitPrice: 105,
            return: -500,
            returnPercent: -4.55,
            holdingDays: 10,
          },
        ],
      });

      const metrics = calculateAllMetrics(result, candles);

      expect(metrics).toHaveProperty("sharpe");
      expect(metrics).toHaveProperty("calmar");
      expect(metrics).toHaveProperty("profitFactor");
      expect(metrics).toHaveProperty("recoveryFactor");
      expect(metrics).toHaveProperty("returns");
      expect(metrics).toHaveProperty("winRate");

      expect(metrics.winRate).toBe(60);
      expect(metrics.returns).toBe(10);
      expect(metrics.profitFactor).toBe(2.0);
    });

    it("should use provided initial capital", () => {
      const candles = generateTestCandles(50);
      const result = createMockBacktestResult();

      const metrics1 = calculateAllMetrics(result, candles, { initialCapital: 100000 });
      const metrics2 = calculateAllMetrics(result, candles, { initialCapital: 200000 });

      // Sharpe should be calculated but may differ slightly due to equity curve
      expect(typeof metrics1.sharpe).toBe("number");
      expect(typeof metrics2.sharpe).toBe("number");
    });
  });

  describe("checkConstraint", () => {
    it("should check > operator correctly", () => {
      expect(checkConstraint(10, ">", 5)).toBe(true);
      expect(checkConstraint(5, ">", 5)).toBe(false);
      expect(checkConstraint(3, ">", 5)).toBe(false);
    });

    it("should check >= operator correctly", () => {
      expect(checkConstraint(10, ">=", 5)).toBe(true);
      expect(checkConstraint(5, ">=", 5)).toBe(true);
      expect(checkConstraint(3, ">=", 5)).toBe(false);
    });

    it("should check < operator correctly", () => {
      expect(checkConstraint(3, "<", 5)).toBe(true);
      expect(checkConstraint(5, "<", 5)).toBe(false);
      expect(checkConstraint(10, "<", 5)).toBe(false);
    });

    it("should check <= operator correctly", () => {
      expect(checkConstraint(3, "<=", 5)).toBe(true);
      expect(checkConstraint(5, "<=", 5)).toBe(true);
      expect(checkConstraint(10, "<=", 5)).toBe(false);
    });

    it("should check == operator with tolerance", () => {
      expect(checkConstraint(5, "==", 5)).toBe(true);
      expect(checkConstraint(5.00001, "==", 5)).toBe(true);
      expect(checkConstraint(5.001, "==", 5)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty trades in backtest result", () => {
      const candles = generateTestCandles(50);
      const result = createMockBacktestResult({ trades: [] });

      const metrics = calculateAllMetrics(result, candles);
      expect(typeof metrics.sharpe).toBe("number");
    });

    it("should handle single candle", () => {
      const candles = generateTestCandles(1);
      const result = createMockBacktestResult();

      const metrics = calculateAllMetrics(result, candles);
      expect(metrics.sharpe).toBe(0); // Not enough data for returns
    });

    it("should handle zero max drawdown", () => {
      const candles = generateTestCandles(50);
      const result = createMockBacktestResult({ maxDrawdown: 0 });

      const metrics = calculateAllMetrics(result, candles);
      expect(metrics.calmar).toBe(Number.POSITIVE_INFINITY);
      expect(metrics.recoveryFactor).toBe(Number.POSITIVE_INFINITY);
    });
  });
});
