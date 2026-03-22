/**
 * Behavior Insights
 *
 * Transforms raw edge-analysis metrics into human-readable behavioral feedback.
 * Identifies strengths, weaknesses, and informational patterns from trade history.
 *
 * @example
 * ```ts
 * import { generateBehaviorInsights } from "trendcraft";
 *
 * const insights = generateBehaviorInsights(result.trades, result.equityCurve);
 * // [{ type: "strength", title: "Good profit capture", ... }, ...]
 * ```
 */

import type { Trade } from "../types";
import {
  analyzeByHoldingPeriod,
  analyzeMfeMae,
  analyzeStreaks,
  calculateTradeStats,
} from "./edge-analysis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single behavioral insight derived from trade analysis.
 */
export type BehaviorInsight = {
  /** Classification of the insight */
  type: "strength" | "weakness" | "info";
  /** Short headline */
  title: string;
  /** Detailed explanation */
  description: string;
  /** Optional numeric label for dashboards */
  metric?: string;
};

/**
 * Equity curve data point for drawdown analysis.
 * Extends the base EquityPoint with drawdown information.
 */
export type BehaviorEquityPoint = {
  /** Timestamp */
  time: number;
  /** Equity value */
  equity: number;
  /** Drawdown percentage (0 = no drawdown) */
  drawdownPercent: number;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Generate behavioral insights from trade history.
 *
 * Analyzes win rate, profit factor, MFE utilization, holding period patterns,
 * streaks, and drawdowns to produce actionable feedback.
 *
 * @param trades - Array of completed trades
 * @param equityCurve - Optional equity curve for drawdown analysis
 * @returns Array of behavioral insights, ordered by relevance
 *
 * @example
 * ```ts
 * const insights = generateBehaviorInsights(result.trades, result.equityCurve);
 * for (const insight of insights) {
 *   console.log(`[${insight.type}] ${insight.title}: ${insight.description}`);
 * }
 * ```
 */
export function generateBehaviorInsights(
  trades: Trade[],
  equityCurve?: BehaviorEquityPoint[],
): BehaviorInsight[] {
  if (trades.length === 0) return [];

  const insights: BehaviorInsight[] = [];

  addOverallStats(trades, equityCurve, insights);
  addMfeInsight(trades, insights);
  addHoldingPeriodInsight(trades, insights);
  addStreakInsight(trades, insights);

  return insights;
}

// ---------------------------------------------------------------------------
// Individual analyzers
// ---------------------------------------------------------------------------

function addOverallStats(
  trades: Trade[],
  equityCurve: BehaviorEquityPoint[] | undefined,
  insights: BehaviorInsight[],
): void {
  if (trades.length < 2) return;

  const stats = calculateTradeStats(trades);

  // Win rate
  if (stats.winRate >= 55) {
    insights.push({
      type: "strength",
      title: "Above-average win rate",
      description: `${stats.winRate.toFixed(0)}% win rate across ${stats.tradeCount} trades.`,
      metric: `${stats.winRate.toFixed(0)}% (${stats.winCount}W / ${stats.lossCount}L)`,
    });
  } else if (stats.winRate < 40 && stats.tradeCount >= 5) {
    insights.push({
      type: "weakness",
      title: "Low win rate",
      description: `${stats.winRate.toFixed(0)}% win rate. Review your entry criteria and consider being more selective.`,
      metric: `${stats.winRate.toFixed(0)}% (${stats.winCount}W / ${stats.lossCount}L)`,
    });
  }

  // Profit factor
  if (stats.profitFactor >= 1.5 && stats.profitFactor < Number.POSITIVE_INFINITY) {
    insights.push({
      type: "strength",
      title: "Positive profit factor",
      description: `Profit factor of ${stats.profitFactor.toFixed(2)} — your wins outpace your losses.`,
      metric: `PF: ${stats.profitFactor.toFixed(2)}`,
    });
  } else if (stats.profitFactor < 1 && stats.profitFactor > 0 && stats.tradeCount >= 5) {
    insights.push({
      type: "weakness",
      title: "Negative edge",
      description: `Profit factor of ${stats.profitFactor.toFixed(2)} — losses exceed wins. Consider reviewing your strategy.`,
      metric: `PF: ${stats.profitFactor.toFixed(2)}`,
    });
  }

  // Drawdown
  if (equityCurve && equityCurve.length > 0) {
    const maxDD = Math.max(...equityCurve.map((p) => p.drawdownPercent));
    if (maxDD > 10) {
      insights.push({
        type: "weakness",
        title: "Significant drawdown",
        description: `Maximum drawdown of ${maxDD.toFixed(1)}%. Consider tighter risk management to protect capital.`,
        metric: `Max DD: ${maxDD.toFixed(1)}%`,
      });
    }
  }
}

function addMfeInsight(trades: Trade[], insights: BehaviorInsight[]): void {
  const tradesWithMfe = trades.filter(
    (t) => t.mfeUtilization != null && t.mfe != null && t.mfe > 0,
  );
  if (tradesWithMfe.length < 2) return;

  const mfeAnalysis = analyzeMfeMae(tradesWithMfe);

  if (mfeAnalysis.avgMfeUtilization >= 60) {
    insights.push({
      type: "strength",
      title: "Good profit capture",
      description: `You capture ${mfeAnalysis.avgMfeUtilization.toFixed(0)}% of maximum favorable excursion on average. You're letting winners run effectively.`,
      metric: `${mfeAnalysis.avgMfeUtilization.toFixed(0)}% MFE utilization`,
    });
  } else if (mfeAnalysis.avgMfeUtilization < 40) {
    insights.push({
      type: "weakness",
      title: "Low profit capture",
      description: `You only capture ${mfeAnalysis.avgMfeUtilization.toFixed(0)}% of the maximum profit available. Consider adjusting your exit strategy to hold winners longer.`,
      metric: `${mfeAnalysis.avgMfeUtilization.toFixed(0)}% MFE utilization`,
    });
  }
}

function addHoldingPeriodInsight(trades: Trade[], insights: BehaviorInsight[]): void {
  if (trades.length < 4) return;

  const byPeriod = analyzeByHoldingPeriod(trades);
  if (byPeriod.length < 2) return;

  // Find best and worst win rate (with enough samples)
  const significant = byPeriod.filter((p) => p.stats.tradeCount >= 2);
  if (significant.length < 2) return;

  significant.sort((a, b) => b.stats.winRate - a.stats.winRate);
  const best = significant[0];
  const worst = significant[significant.length - 1];

  const diff = best.stats.winRate - worst.stats.winRate;
  if (diff < 10) return;

  insights.push({
    type: "info",
    title: "Holding period pattern",
    description: `Your ${best.period} trades have ${best.stats.winRate.toFixed(0)}% win rate vs ${worst.stats.winRate.toFixed(0)}% for ${worst.period}. Consider focusing on your stronger timeframe.`,
    metric: `${best.period}: ${best.stats.winRate.toFixed(0)}% WR`,
  });
}

function addStreakInsight(trades: Trade[], insights: BehaviorInsight[]): void {
  if (trades.length < 5) return;

  const streaks = analyzeStreaks(trades);

  if (streaks.maxLossStreak >= 4) {
    insights.push({
      type: "weakness",
      title: "Extended losing streak",
      description: `You had a losing streak of ${streaks.maxLossStreak} trades. Consider pausing after 3 consecutive losses to reassess.`,
      metric: `Max loss streak: ${streaks.maxLossStreak}`,
    });
  }

  if (streaks.maxWinStreak >= 5) {
    insights.push({
      type: "strength",
      title: "Strong winning streaks",
      description: `Your best winning streak was ${streaks.maxWinStreak} trades. You maintain discipline when things are working.`,
      metric: `Max win streak: ${streaks.maxWinStreak}`,
    });
  }
}
