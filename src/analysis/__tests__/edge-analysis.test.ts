/**
 * Edge Analysis Tests
 *
 * Tests for trade analysis functions:
 * - calculateTradeStats
 * - analyzeByExitReason
 * - analyzeByHoldingPeriod
 * - analyzeByTime
 * - analyzeMfeMae
 * - analyzeStreaks
 * - analyzeAllTrades
 */

import { describe, expect, it } from "vitest";
import type { Trade, ExitReason } from "../../types";
import {
  calculateTradeStats,
  analyzeByExitReason,
  analyzeByHoldingPeriod,
  analyzeByTime,
  analyzeMfeMae,
  analyzeStreaks,
  analyzeAllTrades,
} from "../edge-analysis";

// Helper to create trades
const makeTrade = (
  returnPercent: number,
  options: Partial<Trade> = {},
): Trade => ({
  entryTime: options.entryTime ?? Date.now(),
  entryPrice: 100,
  exitTime: options.exitTime ?? Date.now() + 86400000 * (options.holdingDays ?? 5),
  exitPrice: 100 * (1 + returnPercent / 100),
  return: returnPercent,
  returnPercent,
  holdingDays: options.holdingDays ?? 5,
  exitReason: options.exitReason,
  mfe: options.mfe,
  mae: options.mae,
  mfeUtilization: options.mfeUtilization,
  ...options,
});

describe("calculateTradeStats", () => {
  it("should return zero stats for empty array", () => {
    const stats = calculateTradeStats([]);

    expect(stats.tradeCount).toBe(0);
    expect(stats.winCount).toBe(0);
    expect(stats.lossCount).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.avgReturn).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });

  it("should calculate basic win/loss stats", () => {
    const trades = [
      makeTrade(10), // win
      makeTrade(5), // win
      makeTrade(-3), // loss
      makeTrade(-2), // loss
      makeTrade(8), // win
    ];

    const stats = calculateTradeStats(trades);

    expect(stats.tradeCount).toBe(5);
    expect(stats.winCount).toBe(3);
    expect(stats.lossCount).toBe(2);
    expect(stats.winRate).toBe(60);
  });

  it("should calculate average returns", () => {
    const trades = [
      makeTrade(10),
      makeTrade(-5),
      makeTrade(15),
      makeTrade(-10),
    ];

    const stats = calculateTradeStats(trades);

    // Avg return = (10 - 5 + 15 - 10) / 4 = 2.5
    expect(stats.avgReturn).toBe(2.5);
    // Avg win = (10 + 15) / 2 = 12.5
    expect(stats.avgWin).toBe(12.5);
    // Avg loss = (-5 + -10) / 2 = -7.5
    expect(stats.avgLoss).toBe(-7.5);
  });

  it("should calculate expectancy", () => {
    const trades = [
      makeTrade(20), // win
      makeTrade(10), // win
      makeTrade(-5), // loss
      makeTrade(-5), // loss
    ];

    const stats = calculateTradeStats(trades);

    // Win rate = 50%, Avg win = 15%, Avg loss = -5%
    // Expectancy = 0.5 * 15 + 0.5 * (-5) = 7.5 - 2.5 = 5
    expect(stats.expectancy).toBe(5);
  });

  it("should calculate profit factor", () => {
    const trades = [
      makeTrade(20), // gross profit
      makeTrade(10), // gross profit
      makeTrade(-5), // gross loss
      makeTrade(-10), // gross loss
    ];

    const stats = calculateTradeStats(trades);

    // Gross profit = 30, Gross loss = 15
    // Profit factor = 30 / 15 = 2
    expect(stats.profitFactor).toBe(2);
  });

  it("should handle all winning trades", () => {
    const trades = [
      makeTrade(10),
      makeTrade(5),
      makeTrade(15),
    ];

    const stats = calculateTradeStats(trades);

    expect(stats.winRate).toBe(100);
    expect(stats.lossCount).toBe(0);
    // Profit factor should be capped at 999.99
    expect(stats.profitFactor).toBe(999.99);
  });

  it("should handle all losing trades", () => {
    const trades = [
      makeTrade(-10),
      makeTrade(-5),
      makeTrade(-15),
    ];

    const stats = calculateTradeStats(trades);

    expect(stats.winRate).toBe(0);
    expect(stats.winCount).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });

  it("should calculate consecutive streaks", () => {
    const trades = [
      makeTrade(10), // W
      makeTrade(5), // W
      makeTrade(3), // W
      makeTrade(-5), // L
      makeTrade(-2), // L
      makeTrade(8), // W
      makeTrade(-1), // L
      makeTrade(-3), // L
      makeTrade(-2), // L
    ];

    const stats = calculateTradeStats(trades);

    expect(stats.maxConsecutiveWins).toBe(3);
    expect(stats.maxConsecutiveLosses).toBe(3);
  });
});

describe("analyzeByExitReason", () => {
  it("should return empty array for empty trades", () => {
    const result = analyzeByExitReason([]);
    expect(result).toEqual([]);
  });

  it("should group trades by exit reason", () => {
    const trades = [
      makeTrade(10, { exitReason: "signal" }),
      makeTrade(-5, { exitReason: "stopLoss" }),
      makeTrade(8, { exitReason: "signal" }),
      makeTrade(15, { exitReason: "takeProfit" }),
      makeTrade(-3, { exitReason: "stopLoss" }),
    ];

    const result = analyzeByExitReason(trades);

    expect(result.length).toBe(3);

    const signalStats = result.find((r) => r.reason === "signal");
    expect(signalStats?.stats.tradeCount).toBe(2);
    expect(signalStats?.stats.winRate).toBe(100);

    const stopLossStats = result.find((r) => r.reason === "stopLoss");
    expect(stopLossStats?.stats.tradeCount).toBe(2);
    expect(stopLossStats?.stats.winRate).toBe(0);

    const takeProfitStats = result.find((r) => r.reason === "takeProfit");
    expect(takeProfitStats?.stats.tradeCount).toBe(1);
    expect(takeProfitStats?.stats.winRate).toBe(100);
  });

  it("should treat undefined exitReason as 'signal'", () => {
    const trades = [
      makeTrade(10),
      makeTrade(5),
    ];

    const result = analyzeByExitReason(trades);

    expect(result.length).toBe(1);
    expect(result[0].reason).toBe("signal");
    expect(result[0].stats.tradeCount).toBe(2);
  });

  it("should sort by trade count descending", () => {
    const trades = [
      makeTrade(10, { exitReason: "signal" }),
      makeTrade(-5, { exitReason: "stopLoss" }),
      makeTrade(8, { exitReason: "stopLoss" }),
      makeTrade(15, { exitReason: "stopLoss" }),
    ];

    const result = analyzeByExitReason(trades);

    expect(result[0].reason).toBe("stopLoss");
    expect(result[0].stats.tradeCount).toBe(3);
    expect(result[1].reason).toBe("signal");
    expect(result[1].stats.tradeCount).toBe(1);
  });
});

describe("analyzeByHoldingPeriod", () => {
  it("should return empty array for empty trades", () => {
    const result = analyzeByHoldingPeriod([]);
    expect(result).toEqual([]);
  });

  it("should group trades by holding period", () => {
    const trades = [
      makeTrade(10, { holdingDays: 3 }), // 1-5d
      makeTrade(5, { holdingDays: 5 }), // 1-5d
      makeTrade(8, { holdingDays: 10 }), // 6-14d
      makeTrade(-3, { holdingDays: 20 }), // 15-30d
      makeTrade(15, { holdingDays: 45 }), // 31d+
    ];

    const result = analyzeByHoldingPeriod(trades);

    expect(result.length).toBe(4);

    const shortTerm = result.find((r) => r.period === "1-5d");
    expect(shortTerm?.stats.tradeCount).toBe(2);

    const mediumTerm = result.find((r) => r.period === "6-14d");
    expect(mediumTerm?.stats.tradeCount).toBe(1);

    const longTerm = result.find((r) => r.period === "15-30d");
    expect(longTerm?.stats.tradeCount).toBe(1);

    const veryLong = result.find((r) => r.period === "31d+");
    expect(veryLong?.stats.tradeCount).toBe(1);
  });

  it("should maintain period order", () => {
    const trades = [
      makeTrade(10, { holdingDays: 45 }), // 31d+
      makeTrade(5, { holdingDays: 3 }), // 1-5d
      makeTrade(8, { holdingDays: 20 }), // 15-30d
    ];

    const result = analyzeByHoldingPeriod(trades);

    expect(result[0].period).toBe("1-5d");
    expect(result[1].period).toBe("15-30d");
    expect(result[2].period).toBe("31d+");
  });
});

describe("analyzeByTime", () => {
  it("should return empty maps for empty trades", () => {
    const result = analyzeByTime([]);

    expect(result.dayOfWeek.size).toBe(0);
    expect(result.month.size).toBe(0);
  });

  it("should group trades by day of week", () => {
    // Create trades on specific days
    // Monday = 2024-01-01 (day 1)
    // Friday = 2024-01-05 (day 5)
    const monday = new Date("2024-01-01T12:00:00Z").getTime();
    const friday = new Date("2024-01-05T12:00:00Z").getTime();

    const trades = [
      makeTrade(10, { entryTime: monday }),
      makeTrade(-5, { entryTime: monday }),
      makeTrade(8, { entryTime: friday }),
    ];

    const result = analyzeByTime(trades);

    // Monday is day 1
    const mondayStats = result.dayOfWeek.get(1);
    expect(mondayStats?.tradeCount).toBe(2);

    // Friday is day 5
    const fridayStats = result.dayOfWeek.get(5);
    expect(fridayStats?.tradeCount).toBe(1);
  });

  it("should group trades by month", () => {
    const january = new Date("2024-01-15T12:00:00Z").getTime();
    const march = new Date("2024-03-15T12:00:00Z").getTime();
    const december = new Date("2024-12-15T12:00:00Z").getTime();

    const trades = [
      makeTrade(10, { entryTime: january }),
      makeTrade(5, { entryTime: january }),
      makeTrade(-3, { entryTime: march }),
      makeTrade(8, { entryTime: december }),
    ];

    const result = analyzeByTime(trades);

    const janStats = result.month.get(1);
    expect(janStats?.tradeCount).toBe(2);

    const marStats = result.month.get(3);
    expect(marStats?.tradeCount).toBe(1);

    const decStats = result.month.get(12);
    expect(decStats?.tradeCount).toBe(1);
  });
});

describe("analyzeMfeMae", () => {
  it("should return zero stats for empty trades", () => {
    const result = analyzeMfeMae([]);

    expect(result.avgMfe).toBe(0);
    expect(result.avgMae).toBe(0);
    expect(result.avgMfeUtilization).toBe(0);
    expect(result.mfeDistribution).toEqual([]);
    expect(result.maeDistribution).toEqual([]);
  });

  it("should calculate average MFE/MAE", () => {
    const trades = [
      makeTrade(5, { mfe: 10, mae: 3 }),
      makeTrade(8, { mfe: 15, mae: 5 }),
      makeTrade(-2, { mfe: 5, mae: 8 }),
    ];

    const result = analyzeMfeMae(trades);

    // Avg MFE = (10 + 15 + 5) / 3 = 10
    expect(result.avgMfe).toBe(10);
    // Avg MAE = (3 + 5 + 8) / 3 = 5.33
    expect(result.avgMae).toBeCloseTo(5.33, 1);
  });

  it("should calculate average MFE utilization", () => {
    const trades = [
      makeTrade(5, { mfeUtilization: 50 }),
      makeTrade(8, { mfeUtilization: 80 }),
      makeTrade(-2, { mfeUtilization: 0 }),
    ];

    const result = analyzeMfeMae(trades);

    // Avg utilization = (50 + 80 + 0) / 3 = 43.33
    expect(result.avgMfeUtilization).toBeCloseTo(43.33, 1);
  });

  it("should create MFE distribution", () => {
    const trades = [
      makeTrade(1, { mfe: 1 }), // 0-2%
      makeTrade(2, { mfe: 3 }), // 2-5%
      makeTrade(3, { mfe: 7 }), // 5-10%
      makeTrade(4, { mfe: 15 }), // 10-20%
      makeTrade(5, { mfe: 25 }), // 20%+
    ];

    const result = analyzeMfeMae(trades);

    expect(result.mfeDistribution).toContainEqual({ bucket: "0-2%", count: 1 });
    expect(result.mfeDistribution).toContainEqual({ bucket: "2-5%", count: 1 });
    expect(result.mfeDistribution).toContainEqual({ bucket: "5-10%", count: 1 });
    expect(result.mfeDistribution).toContainEqual({ bucket: "10-20%", count: 1 });
    expect(result.mfeDistribution).toContainEqual({ bucket: "20%+", count: 1 });
  });

  it("should handle trades without MFE/MAE data", () => {
    const trades = [
      makeTrade(5), // No MFE/MAE
      makeTrade(8, { mfe: 10 }), // Only MFE
      makeTrade(-2, { mae: 5 }), // Only MAE
    ];

    const result = analyzeMfeMae(trades);

    // Only one trade with MFE
    expect(result.avgMfe).toBe(10);
    // Only one trade with MAE
    expect(result.avgMae).toBe(5);
  });
});

describe("analyzeStreaks", () => {
  it("should return zero stats for empty trades", () => {
    const result = analyzeStreaks([]);

    expect(result.maxWinStreak).toBe(0);
    expect(result.maxLossStreak).toBe(0);
    expect(result.avgWinStreak).toBe(0);
    expect(result.avgLossStreak).toBe(0);
  });

  it("should calculate max streaks", () => {
    const trades = [
      makeTrade(10), // W
      makeTrade(5), // W
      makeTrade(3), // W
      makeTrade(2), // W (max win = 4)
      makeTrade(-5), // L
      makeTrade(-2), // L
      makeTrade(8), // W
      makeTrade(-1), // L
      makeTrade(-3), // L
      makeTrade(-2), // L (max loss = 3)
    ];

    const result = analyzeStreaks(trades);

    expect(result.maxWinStreak).toBe(4);
    expect(result.maxLossStreak).toBe(3);
  });

  it("should calculate average streaks", () => {
    const trades = [
      makeTrade(10), // W streak 1
      makeTrade(5), // W streak 1
      makeTrade(-5), // L streak 1
      makeTrade(8), // W streak 2
      makeTrade(3), // W streak 2
      makeTrade(2), // W streak 2
      makeTrade(-2), // L streak 2
      makeTrade(-1), // L streak 2
    ];

    const result = analyzeStreaks(trades);

    // Win streaks: 2, 3 -> avg = 2.5
    expect(result.avgWinStreak).toBe(2.5);
    // Loss streaks: 1, 2 -> avg = 1.5
    expect(result.avgLossStreak).toBe(1.5);
  });

  it("should handle all wins", () => {
    const trades = [
      makeTrade(10),
      makeTrade(5),
      makeTrade(3),
    ];

    const result = analyzeStreaks(trades);

    expect(result.maxWinStreak).toBe(3);
    expect(result.maxLossStreak).toBe(0);
    expect(result.avgWinStreak).toBe(3);
    expect(result.avgLossStreak).toBe(0);
  });

  it("should handle all losses", () => {
    const trades = [
      makeTrade(-10),
      makeTrade(-5),
    ];

    const result = analyzeStreaks(trades);

    expect(result.maxWinStreak).toBe(0);
    expect(result.maxLossStreak).toBe(2);
    expect(result.avgWinStreak).toBe(0);
    expect(result.avgLossStreak).toBe(2);
  });
});

describe("analyzeAllTrades", () => {
  it("should return all analysis components", () => {
    const trades = [
      makeTrade(10, {
        exitReason: "signal",
        holdingDays: 3,
        mfe: 15,
        mae: 2,
        mfeUtilization: 66.67,
        entryTime: new Date("2024-01-15T12:00:00Z").getTime(),
      }),
      makeTrade(-5, {
        exitReason: "stopLoss",
        holdingDays: 10,
        mfe: 3,
        mae: 8,
        mfeUtilization: 0,
        entryTime: new Date("2024-02-15T12:00:00Z").getTime(),
      }),
      makeTrade(8, {
        exitReason: "takeProfit",
        holdingDays: 20,
        mfe: 10,
        mae: 3,
        mfeUtilization: 80,
        entryTime: new Date("2024-03-15T12:00:00Z").getTime(),
      }),
    ];

    const result = analyzeAllTrades(trades);

    // Overall stats
    expect(result.overall.tradeCount).toBe(3);
    expect(result.overall.winCount).toBe(2);
    expect(result.overall.lossCount).toBe(1);

    // By exit reason
    expect(result.byExitReason.length).toBe(3);

    // By holding period
    expect(result.byHoldingPeriod.length).toBeGreaterThan(0);

    // By time
    expect(result.byTime.dayOfWeek.size).toBeGreaterThan(0);
    expect(result.byTime.month.size).toBe(3); // Jan, Feb, Mar

    // MFE/MAE
    expect(result.mfeMae.avgMfe).toBeGreaterThan(0);
    expect(result.mfeMae.avgMae).toBeGreaterThan(0);

    // Streaks
    expect(result.streaks.maxWinStreak).toBeGreaterThan(0);
  });

  it("should handle empty trades", () => {
    const result = analyzeAllTrades([]);

    expect(result.overall.tradeCount).toBe(0);
    expect(result.byExitReason).toEqual([]);
    expect(result.byHoldingPeriod).toEqual([]);
    expect(result.byTime.dayOfWeek.size).toBe(0);
    expect(result.byTime.month.size).toBe(0);
    expect(result.mfeMae.avgMfe).toBe(0);
    expect(result.streaks.maxWinStreak).toBe(0);
  });
});
