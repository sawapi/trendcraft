import { describe, expect, it } from "vitest";
import { runBacktest } from "../../backtest/engine";
import type { DrawdownPeriod } from "../../types";
import type { NormalizedCandle } from "../../types";
import { analyzeDrawdowns } from "../drawdown-analysis";

function makePeriod(overrides: Partial<DrawdownPeriod> = {}): DrawdownPeriod {
  return {
    startTime: 1000,
    peakEquity: 100_000,
    troughTime: 2000,
    troughEquity: 90_000,
    recoveryTime: 3000,
    maxDepthPercent: 10,
    durationBars: 10,
    recoveryBars: 5,
    ...overrides,
  };
}

describe("analyzeDrawdowns", () => {
  it("should return zero values for empty array", () => {
    const summary = analyzeDrawdowns([]);
    expect(summary.count).toBe(0);
    expect(summary.avgDepth).toBe(0);
    expect(summary.maxDepth).toBe(0);
    expect(summary.avgDurationBars).toBe(0);
    expect(summary.maxDurationBars).toBe(0);
    expect(summary.avgRecoveryBars).toBe(0);
    expect(summary.maxRecoveryBars).toBe(0);
    expect(summary.recoveryRate).toBe(0);
    expect(summary.worstDrawdown).toBeNull();
    expect(summary.longestRecovery).toBeNull();
  });

  it("should handle single recovered period", () => {
    const period = makePeriod({
      maxDepthPercent: 15,
      durationBars: 20,
      recoveryBars: 8,
    });
    const summary = analyzeDrawdowns([period]);

    expect(summary.count).toBe(1);
    expect(summary.avgDepth).toBe(15);
    expect(summary.maxDepth).toBe(15);
    expect(summary.avgDurationBars).toBe(20);
    expect(summary.maxDurationBars).toBe(20);
    expect(summary.avgRecoveryBars).toBe(8);
    expect(summary.maxRecoveryBars).toBe(8);
    expect(summary.recoveryRate).toBe(100);
    expect(summary.worstDrawdown).toBe(period);
    expect(summary.longestRecovery).toBe(period);
  });

  it("should handle single unrecovered period", () => {
    const period = makePeriod({
      recoveryTime: undefined,
      recoveryBars: undefined,
      maxDepthPercent: 25,
      durationBars: 30,
    });
    const summary = analyzeDrawdowns([period]);

    expect(summary.count).toBe(1);
    expect(summary.maxDepth).toBe(25);
    expect(summary.avgRecoveryBars).toBe(0);
    expect(summary.maxRecoveryBars).toBe(0);
    expect(summary.recoveryRate).toBe(0);
    expect(summary.longestRecovery).toBeNull();
  });

  it("should calculate avg/max for multiple periods", () => {
    const periods: DrawdownPeriod[] = [
      makePeriod({ maxDepthPercent: 10, durationBars: 20, recoveryBars: 5 }),
      makePeriod({ maxDepthPercent: 20, durationBars: 40, recoveryBars: 15 }),
      makePeriod({
        maxDepthPercent: 5,
        durationBars: 10,
        recoveryTime: undefined,
        recoveryBars: undefined,
      }),
    ];

    const summary = analyzeDrawdowns(periods);

    expect(summary.count).toBe(3);
    expect(summary.avgDepth).toBeCloseTo(11.67, 1);
    expect(summary.maxDepth).toBe(20);
    expect(summary.avgDurationBars).toBeCloseTo(23.33, 1);
    expect(summary.maxDurationBars).toBe(40);
    // Only 2 recovered periods
    expect(summary.avgRecoveryBars).toBe(10);
    expect(summary.maxRecoveryBars).toBe(15);
    expect(summary.recoveryRate).toBeCloseTo(66.67, 1);
    expect(summary.worstDrawdown).toBe(periods[1]);
    expect(summary.longestRecovery).toBe(periods[1]);
  });

  describe("integration with backtest engine", () => {
    function makeCandles(count: number): NormalizedCandle[] {
      const candles: NormalizedCandle[] = [];
      const baseTime = Date.UTC(2024, 0, 1);
      const day = 86400000;

      for (let i = 0; i < count; i++) {
        // Create a price series that goes up, then down, then recovers
        let close: number;
        if (i < 10) {
          close = 100 + i * 2; // Rising to 118
        } else if (i < 20) {
          close = 118 - (i - 10) * 3; // Dropping to 88
        } else if (i < 30) {
          close = 88 + (i - 20) * 4; // Recovery to 128
        } else {
          close = 128 - (i - 30) * 2; // Another drop
        }

        candles.push({
          time: baseTime + i * day,
          open: close - 1,
          high: close + 2,
          low: close - 2,
          close,
          volume: 1000,
        });
      }
      return candles;
    }

    it("should populate drawdownPeriods in BacktestResult", () => {
      const candles = makeCandles(40);

      // Simple entry/exit: buy every 10 bars, sell every 15 bars
      const entryCondition = (
        _indicators: Record<string, unknown>,
        _candle: NormalizedCandle,
        index: number,
      ) => index % 20 === 5;

      const exitCondition = (
        _indicators: Record<string, unknown>,
        _candle: NormalizedCandle,
        index: number,
      ) => index % 20 === 15;

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 100_000,
        fillMode: "same-bar-close",
      });

      // BacktestResult should have drawdownPeriods array
      expect(result.drawdownPeriods).toBeDefined();
      expect(Array.isArray(result.drawdownPeriods)).toBe(true);
    });

    it("should have consistent maxDrawdown and drawdownPeriods", () => {
      const candles = makeCandles(40);

      const entryCondition = (
        _indicators: Record<string, unknown>,
        _candle: NormalizedCandle,
        index: number,
      ) => index === 5;

      const exitCondition = (
        _indicators: Record<string, unknown>,
        _candle: NormalizedCandle,
        index: number,
      ) => index === 25;

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 100_000,
        fillMode: "same-bar-close",
      });

      if (result.drawdownPeriods.length > 0) {
        const maxPeriodDepth = Math.max(...result.drawdownPeriods.map((p) => p.maxDepthPercent));
        // The max depth from drawdown periods should be <= the overall maxDrawdown
        // (they track different things: periods track equity curve, maxDrawdown tracks running max)
        expect(maxPeriodDepth).toBeLessThanOrEqual(result.maxDrawdown + 0.01);
      }
    });

    it("should return empty drawdownPeriods for empty result", () => {
      const candles = makeCandles(3);

      // No trades will happen with these candles
      const entryCondition = () => false;
      const exitCondition = () => false;

      const result = runBacktest(candles, entryCondition, exitCondition, {
        capital: 100_000,
      });

      expect(result.drawdownPeriods).toEqual([]);
    });
  });
});
