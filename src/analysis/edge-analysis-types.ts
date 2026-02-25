/**
 * Edge Analysis Types and Helpers
 *
 * Type definitions and internal helper functions for edge analysis.
 */

import type { ExitReason } from "../types";

// ============================================
// Type Definitions
// ============================================

/**
 * Basic trade statistics
 */
export type TradeStats = {
  /** Total number of trades */
  tradeCount: number;
  /** Number of winning trades */
  winCount: number;
  /** Number of losing trades */
  lossCount: number;
  /** Win rate percentage (0-100) */
  winRate: number;
  /** Average return percentage */
  avgReturn: number;
  /** Average winning trade return percentage */
  avgWin: number;
  /** Average losing trade return percentage (negative) */
  avgLoss: number;
  /** Expected value per trade (avgWin * winRate + avgLoss * lossRate) */
  expectancy: number;
  /** Profit factor (gross profit / gross loss) */
  profitFactor: number;
  /** Maximum consecutive winning trades */
  maxConsecutiveWins: number;
  /** Maximum consecutive losing trades */
  maxConsecutiveLosses: number;
};

/**
 * Exit reason analysis result
 */
export type ExitReasonAnalysis = {
  /** Exit reason type */
  reason: ExitReason;
  /** Statistics for this exit reason */
  stats: TradeStats;
};

/**
 * Holding period analysis result
 */
export type HoldingPeriodAnalysis = {
  /** Holding period range (e.g., '1-5d', '6-14d', '15-30d', '31d+') */
  period: string;
  /** Statistics for this holding period */
  stats: TradeStats;
};

/**
 * Time-based analysis result
 */
export type TimeAnalysis = {
  /** Statistics by day of week (0=Sunday, 1=Monday, etc.) */
  dayOfWeek: Map<number, TradeStats>;
  /** Statistics by month (1-12) */
  month: Map<number, TradeStats>;
};

/**
 * MFE/MAE analysis result
 */
export type MfeMaeAnalysis = {
  /** Average MFE percentage */
  avgMfe: number;
  /** Average MAE percentage */
  avgMae: number;
  /** Average MFE utilization percentage */
  avgMfeUtilization: number;
  /** MFE distribution by buckets */
  mfeDistribution: { bucket: string; count: number }[];
  /** MAE distribution by buckets */
  maeDistribution: { bucket: string; count: number }[];
};

/**
 * Streak analysis result
 */
export type StreakAnalysis = {
  /** Maximum consecutive wins */
  maxWinStreak: number;
  /** Maximum consecutive losses */
  maxLossStreak: number;
  /** Average consecutive wins */
  avgWinStreak: number;
  /** Average consecutive losses */
  avgLossStreak: number;
};

/**
 * Complete trade analysis result
 */
export type TradeAnalysis = {
  /** Overall statistics */
  overall: TradeStats;
  /** Statistics by exit reason */
  byExitReason: ExitReasonAnalysis[];
  /** Statistics by holding period */
  byHoldingPeriod: HoldingPeriodAnalysis[];
  /** Statistics by time (day of week, month) */
  byTime: TimeAnalysis;
  /** MFE/MAE analysis */
  mfeMae: MfeMaeAnalysis;
  /** Streak analysis */
  streaks: StreakAnalysis;
};

// ============================================
// Helper Functions
// ============================================

/**
 * Calculate consecutive streaks from an array of boolean values
 */
export function calculateStreaks(wins: boolean[]): {
  maxWin: number;
  maxLoss: number;
  avgWin: number;
  avgLoss: number;
} {
  if (wins.length === 0) {
    return { maxWin: 0, maxLoss: 0, avgWin: 0, avgLoss: 0 };
  }

  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWin = 0;
  let maxLoss = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const isWin of wins) {
    if (isWin) {
      currentWinStreak++;
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        currentLossStreak = 0;
      }
    } else {
      currentLossStreak++;
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        currentWinStreak = 0;
      }
    }
    maxWin = Math.max(maxWin, currentWinStreak);
    maxLoss = Math.max(maxLoss, currentLossStreak);
  }

  // Don't forget the last streak
  if (currentWinStreak > 0) {
    winStreaks.push(currentWinStreak);
  }
  if (currentLossStreak > 0) {
    lossStreaks.push(currentLossStreak);
  }

  const avgWin =
    winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
  const avgLoss =
    lossStreaks.length > 0 ? lossStreaks.reduce((a, b) => a + b, 0) / lossStreaks.length : 0;

  return { maxWin, maxLoss, avgWin, avgLoss };
}

/** Bucket thresholds for percentage values */
const PERCENT_BUCKETS: [number, string][] = [
  [0, "0%"],
  [2, "0-2%"],
  [5, "2-5%"],
  [10, "5-10%"],
  [20, "10-20%"],
];

export function getPercentBucket(value: number): string {
  for (const [threshold, label] of PERCENT_BUCKETS) {
    if (value <= threshold) return label;
  }
  return "20%+";
}

/** Bucket thresholds for holding period in days */
const HOLDING_PERIOD_BUCKETS: [number, string][] = [
  [5, "1-5d"],
  [14, "6-14d"],
  [30, "15-30d"],
];

export function getHoldingPeriodLabel(days: number): string {
  for (const [threshold, label] of HOLDING_PERIOD_BUCKETS) {
    if (days <= threshold) return label;
  }
  return "31d+";
}
