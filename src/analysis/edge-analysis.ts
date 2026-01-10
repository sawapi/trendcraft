/**
 * Edge Analysis Functions
 *
 * Provides comprehensive analysis of trading performance:
 * - Basic trade statistics (win rate, expectancy, profit factor)
 * - Exit reason analysis
 * - Holding period analysis
 * - Time-based analysis (day of week, month)
 * - MFE/MAE analysis
 * - Streak analysis (consecutive wins/losses)
 */

import type { ExitReason, Trade } from "../types";

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
function calculateStreaks(wins: boolean[]): {
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

  const avgWin = winStreaks.length > 0 ? winStreaks.reduce((a, b) => a + b, 0) / winStreaks.length : 0;
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

function getPercentBucket(value: number): string {
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

function getHoldingPeriodLabel(days: number): string {
  for (const [threshold, label] of HOLDING_PERIOD_BUCKETS) {
    if (days <= threshold) return label;
  }
  return "31d+";
}

// ============================================
// Main Analysis Functions
// ============================================

/**
 * Calculate basic trade statistics
 *
 * @param trades Array of trades to analyze
 * @returns Trade statistics
 *
 * @example
 * ```ts
 * const stats = calculateTradeStats(result.trades);
 * console.log(`Win rate: ${stats.winRate}%`);
 * console.log(`Expectancy: ${stats.expectancy}%`);
 * ```
 */
export function calculateTradeStats(trades: Trade[]): TradeStats {
  if (trades.length === 0) {
    return {
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      avgReturn: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      profitFactor: 0,
      maxConsecutiveWins: 0,
      maxConsecutiveLosses: 0,
    };
  }

  const winningTrades = trades.filter((t) => t.returnPercent > 0);
  const losingTrades = trades.filter((t) => t.returnPercent <= 0);

  const winCount = winningTrades.length;
  const lossCount = losingTrades.length;
  const winRate = (winCount / trades.length) * 100;
  const lossRate = (lossCount / trades.length) * 100;

  const sumReturns = (arr: Trade[]): number => arr.reduce((sum, t) => sum + t.returnPercent, 0);

  const avgReturn = sumReturns(trades) / trades.length;
  const grossProfit = sumReturns(winningTrades);
  const grossLoss = Math.abs(sumReturns(losingTrades));
  const avgWin = winCount > 0 ? grossProfit / winCount : 0;
  const avgLoss = lossCount > 0 ? -grossLoss / lossCount : 0;

  // Expectancy = (Win% × AvgWin) + (Loss% × AvgLoss)
  const expectancy = (winRate / 100) * avgWin + (lossRate / 100) * avgLoss;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999.99 : 0;

  // Calculate streaks
  const wins = trades.map((t) => t.returnPercent > 0);
  const streaks = calculateStreaks(wins);

  return {
    tradeCount: trades.length,
    winCount,
    lossCount,
    winRate: Math.round(winRate * 100) / 100,
    avgReturn: Math.round(avgReturn * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    expectancy: Math.round(expectancy * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxConsecutiveWins: streaks.maxWin,
    maxConsecutiveLosses: streaks.maxLoss,
  };
}

/**
 * Analyze trades by exit reason
 *
 * @param trades Array of trades to analyze
 * @returns Array of exit reason analysis results
 *
 * @example
 * ```ts
 * const analysis = analyzeByExitReason(result.trades);
 * for (const item of analysis) {
 *   console.log(`${item.reason}: ${item.stats.tradeCount} trades, ${item.stats.winRate}% win rate`);
 * }
 * ```
 */
export function analyzeByExitReason(trades: Trade[]): ExitReasonAnalysis[] {
  // Group trades by exit reason
  const grouped = new Map<ExitReason, Trade[]>();

  for (const trade of trades) {
    const reason = trade.exitReason ?? "signal";
    const existing = grouped.get(reason) ?? [];
    existing.push(trade);
    grouped.set(reason, existing);
  }

  // Calculate stats for each group
  const result: ExitReasonAnalysis[] = [];

  for (const [reason, groupTrades] of grouped) {
    result.push({
      reason,
      stats: calculateTradeStats(groupTrades),
    });
  }

  // Sort by trade count descending
  result.sort((a, b) => b.stats.tradeCount - a.stats.tradeCount);

  return result;
}

/**
 * Analyze trades by holding period
 *
 * @param trades Array of trades to analyze
 * @returns Array of holding period analysis results
 *
 * @example
 * ```ts
 * const analysis = analyzeByHoldingPeriod(result.trades);
 * for (const item of analysis) {
 *   console.log(`${item.period}: ${item.stats.avgReturn}% avg return`);
 * }
 * ```
 */
export function analyzeByHoldingPeriod(trades: Trade[]): HoldingPeriodAnalysis[] {
  // Group trades by holding period
  const grouped = new Map<string, Trade[]>();

  for (const trade of trades) {
    const period = getHoldingPeriodLabel(trade.holdingDays);
    const existing = grouped.get(period) ?? [];
    existing.push(trade);
    grouped.set(period, existing);
  }

  // Calculate stats for each group
  const result: HoldingPeriodAnalysis[] = [];
  const periodOrder = ["1-5d", "6-14d", "15-30d", "31d+"];

  for (const period of periodOrder) {
    const groupTrades = grouped.get(period);
    if (groupTrades && groupTrades.length > 0) {
      result.push({
        period,
        stats: calculateTradeStats(groupTrades),
      });
    }
  }

  return result;
}

/**
 * Analyze trades by time (day of week and month)
 *
 * @param trades Array of trades to analyze
 * @returns Time analysis results
 *
 * @example
 * ```ts
 * const analysis = analyzeByTime(result.trades);
 * const mondayStats = analysis.dayOfWeek.get(1);
 * console.log(`Monday: ${mondayStats?.winRate}% win rate`);
 * ```
 */
export function analyzeByTime(trades: Trade[]): TimeAnalysis {
  // Group by day of week
  const dayGroups = new Map<number, Trade[]>();
  // Group by month
  const monthGroups = new Map<number, Trade[]>();

  for (const trade of trades) {
    const entryDate = new Date(trade.entryTime);
    const dayOfWeek = entryDate.getUTCDay();
    const month = entryDate.getUTCMonth() + 1; // 1-12

    // Day of week
    const dayTrades = dayGroups.get(dayOfWeek) ?? [];
    dayTrades.push(trade);
    dayGroups.set(dayOfWeek, dayTrades);

    // Month
    const monthTrades = monthGroups.get(month) ?? [];
    monthTrades.push(trade);
    monthGroups.set(month, monthTrades);
  }

  // Calculate stats
  const dayOfWeek = new Map<number, TradeStats>();
  for (const [day, groupTrades] of dayGroups) {
    dayOfWeek.set(day, calculateTradeStats(groupTrades));
  }

  const month = new Map<number, TradeStats>();
  for (const [m, groupTrades] of monthGroups) {
    month.set(m, calculateTradeStats(groupTrades));
  }

  return { dayOfWeek, month };
}

/**
 * Analyze MFE/MAE statistics
 *
 * @param trades Array of trades to analyze
 * @returns MFE/MAE analysis results
 *
 * @example
 * ```ts
 * const analysis = analyzeMfeMae(result.trades);
 * console.log(`Average MFE: ${analysis.avgMfe}%`);
 * console.log(`Average MAE: ${analysis.avgMae}%`);
 * console.log(`MFE Utilization: ${analysis.avgMfeUtilization}%`);
 * ```
 */
export function analyzeMfeMae(trades: Trade[]): MfeMaeAnalysis {
  if (trades.length === 0) {
    return {
      avgMfe: 0,
      avgMae: 0,
      avgMfeUtilization: 0,
      mfeDistribution: [],
      maeDistribution: [],
    };
  }

  // Filter trades that have MFE/MAE data
  const tradesWithMfe = trades.filter((t) => t.mfe !== undefined);
  const tradesWithMae = trades.filter((t) => t.mae !== undefined);
  const tradesWithUtilization = trades.filter((t) => t.mfeUtilization !== undefined);

  // Calculate averages
  const avgMfe =
    tradesWithMfe.length > 0
      ? tradesWithMfe.reduce((sum, t) => sum + (t.mfe ?? 0), 0) / tradesWithMfe.length
      : 0;

  const avgMae =
    tradesWithMae.length > 0
      ? tradesWithMae.reduce((sum, t) => sum + (t.mae ?? 0), 0) / tradesWithMae.length
      : 0;

  const avgMfeUtilization =
    tradesWithUtilization.length > 0
      ? tradesWithUtilization.reduce((sum, t) => sum + (t.mfeUtilization ?? 0), 0) /
        tradesWithUtilization.length
      : 0;

  // Calculate distributions
  const mfeBuckets = new Map<string, number>();
  const maeBuckets = new Map<string, number>();

  for (const trade of tradesWithMfe) {
    const bucket = getPercentBucket(trade.mfe ?? 0);
    mfeBuckets.set(bucket, (mfeBuckets.get(bucket) ?? 0) + 1);
  }

  for (const trade of tradesWithMae) {
    const bucket = getPercentBucket(trade.mae ?? 0);
    maeBuckets.set(bucket, (maeBuckets.get(bucket) ?? 0) + 1);
  }

  // Convert to arrays
  const bucketOrder = ["0%", "0-2%", "2-5%", "5-10%", "10-20%", "20%+"];

  const mfeDistribution = bucketOrder
    .map((bucket) => ({ bucket, count: mfeBuckets.get(bucket) ?? 0 }))
    .filter((item) => item.count > 0);

  const maeDistribution = bucketOrder
    .map((bucket) => ({ bucket, count: maeBuckets.get(bucket) ?? 0 }))
    .filter((item) => item.count > 0);

  return {
    avgMfe: Math.round(avgMfe * 100) / 100,
    avgMae: Math.round(avgMae * 100) / 100,
    avgMfeUtilization: Math.round(avgMfeUtilization * 100) / 100,
    mfeDistribution,
    maeDistribution,
  };
}

/**
 * Analyze winning and losing streaks
 *
 * @param trades Array of trades to analyze
 * @returns Streak analysis results
 *
 * @example
 * ```ts
 * const analysis = analyzeStreaks(result.trades);
 * console.log(`Max win streak: ${analysis.maxWinStreak}`);
 * console.log(`Max loss streak: ${analysis.maxLossStreak}`);
 * ```
 */
export function analyzeStreaks(trades: Trade[]): StreakAnalysis {
  if (trades.length === 0) {
    return {
      maxWinStreak: 0,
      maxLossStreak: 0,
      avgWinStreak: 0,
      avgLossStreak: 0,
    };
  }

  const wins = trades.map((t) => t.returnPercent > 0);
  const streaks = calculateStreaks(wins);

  return {
    maxWinStreak: streaks.maxWin,
    maxLossStreak: streaks.maxLoss,
    avgWinStreak: Math.round(streaks.avgWin * 100) / 100,
    avgLossStreak: Math.round(streaks.avgLoss * 100) / 100,
  };
}

/**
 * Perform comprehensive trade analysis
 *
 * @param trades Array of trades to analyze
 * @returns Complete trade analysis results
 *
 * @example
 * ```ts
 * const result = runBacktest(candles, { entry, exit, stopLoss: 5 });
 * const analysis = analyzeAllTrades(result.trades);
 *
 * console.log('Overall:', analysis.overall);
 * console.log('By Exit Reason:', analysis.byExitReason);
 * console.log('By Holding Period:', analysis.byHoldingPeriod);
 * console.log('MFE/MAE:', analysis.mfeMae);
 * console.log('Streaks:', analysis.streaks);
 * ```
 */
export function analyzeAllTrades(trades: Trade[]): TradeAnalysis {
  return {
    overall: calculateTradeStats(trades),
    byExitReason: analyzeByExitReason(trades),
    byHoldingPeriod: analyzeByHoldingPeriod(trades),
    byTime: analyzeByTime(trades),
    mfeMae: analyzeMfeMae(trades),
    streaks: analyzeStreaks(trades),
  };
}
