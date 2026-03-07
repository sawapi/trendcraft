/**
 * Leaderboard — ranking and promotion/demotion logic
 */

import type { Agent } from "../agent/agent.js";
import type { PromotionConfig } from "../config/promotion.js";
import { DEFAULT_PROMOTION_CONFIG } from "../config/promotion.js";
import { type PerformanceSummary, getPerformanceSummary } from "./performance.js";

export type PromotionDecision = {
  agentId: string;
  action: "promote" | "demote" | "hold";
  reason: string;
};

/**
 * Evaluate whether an agent should be promoted, demoted, or held
 */
export function evaluateAgent(
  agent: Agent,
  config: PromotionConfig = DEFAULT_PROMOTION_CONFIG,
): PromotionDecision {
  const summary = getPerformanceSummary(agent);
  const { metrics, evalDays } = summary;

  // Check demotion conditions first
  if (metrics.maxDrawdown > config.demotionDrawdown) {
    return {
      agentId: agent.id,
      action: "demote",
      reason: `Drawdown ${metrics.maxDrawdown.toFixed(1)}% exceeds ${config.demotionDrawdown}%`,
    };
  }

  if (metrics.dailyPnl < config.maxDailyLoss) {
    return {
      agentId: agent.id,
      action: "demote",
      reason: `Daily loss $${metrics.dailyPnl.toFixed(0)} exceeds limit $${config.maxDailyLoss}`,
    };
  }

  // Must have minimum evaluation period
  if (evalDays < config.minEvalDays) {
    return {
      agentId: agent.id,
      action: "hold",
      reason: `Needs ${config.minEvalDays - Math.floor(evalDays)} more days of evaluation`,
    };
  }

  // Check promotion conditions
  if (metrics.totalTrades < config.minTrades) {
    return {
      agentId: agent.id,
      action: "hold",
      reason: `Needs ${config.minTrades - metrics.totalTrades} more trades`,
    };
  }

  const failReasons: string[] = [];
  if (metrics.sharpeRatio < config.minSharpe)
    failReasons.push(`Sharpe ${metrics.sharpeRatio.toFixed(2)} < ${config.minSharpe}`);
  if (metrics.winRate < config.minWinRate)
    failReasons.push(`WR ${metrics.winRate.toFixed(1)}% < ${config.minWinRate}%`);
  if (metrics.maxDrawdown > config.maxDrawdown)
    failReasons.push(`DD ${metrics.maxDrawdown.toFixed(1)}% > ${config.maxDrawdown}%`);
  if (metrics.profitFactor < config.minProfitFactor)
    failReasons.push(`PF ${metrics.profitFactor.toFixed(2)} < ${config.minProfitFactor}`);

  if (failReasons.length > 0) {
    return {
      agentId: agent.id,
      action: "hold",
      reason: failReasons.join("; "),
    };
  }

  return {
    agentId: agent.id,
    action: "promote",
    reason: "All criteria met",
  };
}

/**
 * Get ranked leaderboard of all agents
 */
export function getLeaderboard(agents: Agent[]): PerformanceSummary[] {
  const summaries = agents.map(getPerformanceSummary);

  // Sort by: Sharpe (primary), then return% (secondary)
  summaries.sort((a, b) => {
    const sharpeDiff = b.metrics.sharpeRatio - a.metrics.sharpeRatio;
    if (Math.abs(sharpeDiff) > 0.01) return sharpeDiff;
    return b.metrics.totalReturnPercent - a.metrics.totalReturnPercent;
  });

  return summaries;
}

/**
 * Format live leaderboard for console output
 */
export function formatLiveLeaderboard(summaries: PerformanceSummary[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("=".repeat(95));
  lines.push("  LIVE AGENT LEADERBOARD");
  lines.push("=".repeat(95));
  lines.push(
    `  ${"Rank".padEnd(6)}${"Agent".padEnd(30)}${"Return%".padEnd(10)}` +
      `${"WinRate".padEnd(10)}${"Sharpe".padEnd(9)}${"MaxDD".padEnd(9)}` +
      `${"PF".padEnd(8)}${"Trades".padEnd(8)}${"Days".padEnd(6)}`,
  );
  lines.push("-".repeat(95));

  summaries.forEach((s, i) => {
    const rank = `#${i + 1}`.padEnd(6);
    const agent = s.agentId.padEnd(30);
    const ret = `${s.metrics.totalReturnPercent.toFixed(2)}%`.padEnd(10);
    const wr = `${s.metrics.winRate.toFixed(1)}%`.padEnd(10);
    const sharpe = s.metrics.sharpeRatio.toFixed(2).padEnd(9);
    const dd = `${s.metrics.maxDrawdown.toFixed(1)}%`.padEnd(9);
    const pf =
      s.metrics.profitFactor === Number.POSITIVE_INFINITY
        ? "Inf".padEnd(8)
        : s.metrics.profitFactor.toFixed(2).padEnd(8);
    const trades = String(s.metrics.totalTrades).padEnd(8);
    const days = s.evalDays.toFixed(1).padEnd(6);

    lines.push(`  ${rank}${agent}${ret}${wr}${sharpe}${dd}${pf}${trades}${days}`);
  });

  lines.push("=".repeat(95));
  lines.push("");

  return lines.join("\n");
}
