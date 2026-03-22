/**
 * Behavior Analyzer
 *
 * Analyzes trading behavior patterns and produces feedback cards
 * for the Performance Review screen.
 */

import type { EquityPoint, Trade } from "../types";

export interface BehaviorInsight {
  title: string;
  description: string;
  type: "strength" | "weakness" | "info";
  metric?: string;
}

/**
 * Analyze MFE utilization (how well profits are captured)
 */
function analyzeMfeUtilization(trades: Trade[]): BehaviorInsight | null {
  const sellTrades = trades.filter(
    (t) => t.type === "SELL" && t.mfeUtilization != null && t.mfe != null && t.mfe > 0,
  );
  if (sellTrades.length < 2) return null;

  const avgUtil =
    sellTrades.reduce((sum, t) => sum + (t.mfeUtilization || 0), 0) / sellTrades.length;

  if (avgUtil >= 60) {
    return {
      title: "Good profit capture",
      description: `You capture ${avgUtil.toFixed(0)}% of maximum favorable excursion on average. You're letting winners run effectively.`,
      type: "strength",
      metric: `${avgUtil.toFixed(0)}% MFE utilization`,
    };
  }
  return {
    title: "Low profit capture",
    description: `You only capture ${avgUtil.toFixed(0)}% of the maximum profit available. Consider adjusting your exit strategy to hold winners longer.`,
    type: "weakness",
    metric: `${avgUtil.toFixed(0)}% MFE utilization`,
  };
}

/**
 * Analyze holding period vs win rate
 */
function analyzeHoldingPeriod(trades: Trade[]): BehaviorInsight | null {
  const pairs: { holdingDays: number; won: boolean }[] = [];

  let lastBuy: Trade | null = null;
  for (const t of trades) {
    if (t.type === "BUY") {
      lastBuy = t;
    } else if (t.type === "SELL" && lastBuy) {
      const days = Math.round((t.date - lastBuy.date) / (1000 * 60 * 60 * 24));
      pairs.push({ holdingDays: days, won: (t.pnlPercent || 0) > 0 });
      lastBuy = null;
    }
  }

  if (pairs.length < 4) return null;

  const shortTrades = pairs.filter((p) => p.holdingDays <= 5);
  const longTrades = pairs.filter((p) => p.holdingDays > 5);

  if (shortTrades.length < 2 || longTrades.length < 2) return null;

  const shortWinRate = (shortTrades.filter((p) => p.won).length / shortTrades.length) * 100;
  const longWinRate = (longTrades.filter((p) => p.won).length / longTrades.length) * 100;

  if (Math.abs(shortWinRate - longWinRate) < 10) return null;

  const betterPeriod = shortWinRate > longWinRate ? "short-term" : "longer-term";
  const betterRate = Math.max(shortWinRate, longWinRate);
  const worseRate = Math.min(shortWinRate, longWinRate);

  return {
    title: "Holding period pattern",
    description: `Your ${betterPeriod} trades have ${betterRate.toFixed(0)}% win rate vs ${worseRate.toFixed(0)}% for the other. Consider focusing on your stronger timeframe.`,
    type: "info",
    metric: `${betterPeriod}: ${betterRate.toFixed(0)}% WR`,
  };
}

/**
 * Analyze regime performance (uptrend vs downtrend entries)
 */
function analyzeRegimePerformance(trades: Trade[]): BehaviorInsight | null {
  const sellTrades = trades.filter((t) => t.type === "SELL" && t.marketContext);

  const upEntries = sellTrades.filter((t) => t.marketContext?.regime === "TREND_UP");
  const downEntries = sellTrades.filter((t) => t.marketContext?.regime === "TREND_DOWN");

  if (upEntries.length < 2 && downEntries.length < 2) return null;

  const upWinRate =
    upEntries.length > 0
      ? (upEntries.filter((t) => (t.pnlPercent || 0) > 0).length / upEntries.length) * 100
      : 0;
  const downWinRate =
    downEntries.length > 0
      ? (downEntries.filter((t) => (t.pnlPercent || 0) > 0).length / downEntries.length) * 100
      : 0;

  if (downEntries.length > upEntries.length && upWinRate > downWinRate + 15) {
    return {
      title: "Counter-trend trading",
      description: `${((downEntries.length / sellTrades.length) * 100).toFixed(0)}% of your entries are in downtrends, but your win rate is ${upWinRate.toFixed(0)}% in uptrends vs ${downWinRate.toFixed(0)}% in downtrends. Consider being more selective in downtrends.`,
      type: "weakness",
      metric: `Uptrend WR: ${upWinRate.toFixed(0)}% vs Down: ${downWinRate.toFixed(0)}%`,
    };
  }

  if (upEntries.length >= 2 && upWinRate > 60) {
    return {
      title: "Strong trend-following",
      description: `Your uptrend entries have ${upWinRate.toFixed(0)}% win rate. You trade well with the trend.`,
      type: "strength",
      metric: `${upWinRate.toFixed(0)}% WR in uptrends`,
    };
  }

  return null;
}

/**
 * Analyze win/loss streaks
 */
function analyzeStreaks(trades: Trade[]): BehaviorInsight | null {
  const sellTrades = trades.filter((t) => t.type === "SELL");
  if (sellTrades.length < 5) return null;

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentStreak = 0;
  let prevWon: boolean | null = null;

  for (const t of sellTrades) {
    const won = (t.pnlPercent || 0) > 0;
    if (prevWon === null || won === prevWon) {
      currentStreak++;
    } else {
      currentStreak = 1;
    }
    if (won) maxWinStreak = Math.max(maxWinStreak, currentStreak);
    else maxLossStreak = Math.max(maxLossStreak, currentStreak);
    prevWon = won;
  }

  if (maxLossStreak >= 4) {
    return {
      title: "Extended losing streak",
      description: `You had a losing streak of ${maxLossStreak} trades. Consider pausing after 3 consecutive losses to reassess.`,
      type: "weakness",
      metric: `Max loss streak: ${maxLossStreak}`,
    };
  }

  if (maxWinStreak >= 5) {
    return {
      title: "Strong winning streaks",
      description: `Your best winning streak was ${maxWinStreak} trades. You maintain discipline when things are working.`,
      type: "strength",
      metric: `Max win streak: ${maxWinStreak}`,
    };
  }

  return null;
}

/**
 * Analyze overall statistics
 */
function analyzeOverallStats(trades: Trade[], equityCurve: EquityPoint[]): BehaviorInsight[] {
  const insights: BehaviorInsight[] = [];
  const sellTrades = trades.filter((t) => t.type === "SELL" && t.pnlPercent != null);

  if (sellTrades.length === 0) return insights;

  const winCount = sellTrades.filter((t) => (t.pnlPercent || 0) > 0).length;
  const winRate = (winCount / sellTrades.length) * 100;

  // Win rate assessment
  if (winRate >= 55) {
    insights.push({
      title: "Above-average win rate",
      description: `${winRate.toFixed(0)}% win rate across ${sellTrades.length} trades.`,
      type: "strength",
      metric: `${winRate.toFixed(0)}% (${winCount}W / ${sellTrades.length - winCount}L)`,
    });
  } else if (winRate < 40 && sellTrades.length >= 5) {
    insights.push({
      title: "Low win rate",
      description: `${winRate.toFixed(0)}% win rate. Review your entry criteria and consider being more selective.`,
      type: "weakness",
      metric: `${winRate.toFixed(0)}% (${winCount}W / ${sellTrades.length - winCount}L)`,
    });
  }

  // Profit factor
  const grossProfit = sellTrades
    .filter((t) => (t.pnlPercent || 0) > 0)
    .reduce((sum, t) => sum + (t.pnlPercent || 0), 0);
  const grossLoss = Math.abs(
    sellTrades
      .filter((t) => (t.pnlPercent || 0) < 0)
      .reduce((sum, t) => sum + (t.pnlPercent || 0), 0),
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Number.POSITIVE_INFINITY : 0;

  if (profitFactor >= 1.5 && profitFactor < Number.POSITIVE_INFINITY) {
    insights.push({
      title: "Positive profit factor",
      description: `Profit factor of ${profitFactor.toFixed(2)} — your wins outpace your losses.`,
      type: "strength",
      metric: `PF: ${profitFactor.toFixed(2)}`,
    });
  }

  // Max drawdown from equity curve
  const maxDD = equityCurve.reduce((max, p) => Math.max(max, p.drawdown), 0);
  if (maxDD > 10) {
    insights.push({
      title: "Significant drawdown",
      description: `Maximum drawdown of ${maxDD.toFixed(1)}%. Consider tighter risk management to protect capital.`,
      type: "weakness",
      metric: `Max DD: ${maxDD.toFixed(1)}%`,
    });
  }

  return insights;
}

/**
 * Run all behavior analyses and return a list of insights.
 */
export function analyzeBehavior(trades: Trade[], equityCurve: EquityPoint[]): BehaviorInsight[] {
  const insights: BehaviorInsight[] = [];

  insights.push(...analyzeOverallStats(trades, equityCurve));

  const mfeInsight = analyzeMfeUtilization(trades);
  if (mfeInsight) insights.push(mfeInsight);

  const holdingInsight = analyzeHoldingPeriod(trades);
  if (holdingInsight) insights.push(holdingInsight);

  const regimeInsight = analyzeRegimePerformance(trades);
  if (regimeInsight) insights.push(regimeInsight);

  const streakInsight = analyzeStreaks(trades);
  if (streakInsight) insights.push(streakInsight);

  return insights;
}
