/**
 * Daily Report Generator
 *
 * Collects agent metrics, market context, and historical trends
 * to produce a daily review report in both JSON and Markdown formats.
 */

import { existsSync, readFileSync } from "node:fs";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Agent } from "../agent/agent.js";
import type { AgentState } from "../agent/types.js";
import type { ScoredResult } from "../backtest/scorer.js";
import { getPalette } from "../strategy/palette.js";
import type { ParameterOverride } from "../strategy/template.js";
import { evaluateAgent } from "../tracker/leaderboard.js";
import type {
  AgentReport,
  BacktestEntry,
  BuyAndHoldBenchmark,
  DailyReport,
  HistoricalMetric,
  LeaderboardEntry,
  MarketContext,
  TradeRecord,
} from "./types.js";

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const REVIEWS_DIR = resolve(DATA_DIR, "reviews");

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * Generate a report from backtest results (no live agents needed)
 */
export function generateBacktestReport(opts: {
  rankings: ScoredResult[];
  marketContext?: MarketContext[];
  activeOverrides?: ParameterOverride[];
  buyAndHold?: BuyAndHoldBenchmark[];
  date?: string;
}): DailyReport {
  const date = opts.date ?? new Date().toISOString().split("T")[0];
  const palette = getPalette();

  const backtestResults: BacktestEntry[] = opts.rankings.map((r) => ({
    strategyId: r.strategyId,
    symbol: r.symbol,
    score: r.score,
    totalReturnPercent: r.result.totalReturnPercent,
    winRate: r.result.winRate,
    sharpeRatio: r.result.sharpeRatio,
    maxDrawdown: r.result.maxDrawdown,
    profitFactor: r.result.profitFactor,
    tradeCount: r.result.tradeCount,
  }));

  const leaderboard: LeaderboardEntry[] = backtestResults.map((b, i) => ({
    rank: i + 1,
    agentId: `${b.strategyId}:${b.symbol}`,
    strategyId: b.strategyId,
    score: b.score,
    metrics: {
      totalTrades: b.tradeCount,
      winRate: b.winRate,
      sharpeRatio: b.sharpeRatio,
      maxDrawdown: b.maxDrawdown,
      profitFactor: b.profitFactor,
      totalReturn: 0,
      totalReturnPercent: b.totalReturnPercent,
      dailyPnl: 0,
      startedAt: Date.now(),
      grossReturn: 0,
      totalCommission: 0,
      estimatedTax: 0,
    },
  }));

  const historicalTrend = loadHistoricalTrend(date, 7);

  return {
    date,
    generatedAt: Date.now(),
    mode: "backtest",
    agents: [],
    leaderboard,
    backtestResults,
    marketContext: opts.marketContext ?? [],
    historicalTrend,
    activeOverrides: opts.activeOverrides ?? [],
    palette: {
      indicators: palette.indicators,
      conditions: palette.conditions,
    },
    buyAndHold: opts.buyAndHold,
  };
}

/**
 * Generate a daily report from current agent states
 */
export function generateDailyReport(opts: {
  agents: Agent[];
  agentStates: AgentState[];
  marketContext?: MarketContext[];
  activeOverrides?: ParameterOverride[];
  buyAndHold?: BuyAndHoldBenchmark[];
  date?: string;
}): DailyReport {
  const date = opts.date ?? new Date().toISOString().split("T")[0];
  const palette = getPalette();

  // Build agent reports
  const agentReports: AgentReport[] = opts.agents.map((agent) => {
    const state = opts.agentStates.find((s) => s.id === agent.id);
    const metrics = agent.getMetrics();
    const decision = evaluateAgent(agent);

    // Get recent trades from session
    const recentTrades = extractRecentTrades(agent);

    return {
      agentId: agent.id,
      strategyId: agent.strategyId,
      symbol: agent.symbol,
      tier: agent.tier,
      active: state ? (state as AgentState & { active?: boolean }).active !== false : true,
      metrics,
      recentTrades,
      promotionDecision: decision,
    };
  });

  // Build leaderboard
  const leaderboard: LeaderboardEntry[] = agentReports
    .map((a, _i) => ({
      rank: 0,
      agentId: a.agentId,
      strategyId: a.strategyId,
      score: computeAgentScore(a),
      metrics: a.metrics,
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  // Load historical trend from past reports
  const historicalTrend = loadHistoricalTrend(date, 7);

  return {
    date,
    generatedAt: Date.now(),
    mode: "live",
    agents: agentReports,
    leaderboard,
    marketContext: opts.marketContext ?? [],
    historicalTrend,
    activeOverrides: opts.activeOverrides ?? [],
    palette: {
      indicators: palette.indicators,
      conditions: palette.conditions,
    },
    buyAndHold: opts.buyAndHold,
  };
}

/**
 * Save report as JSON and Markdown
 */
export function saveReport(report: DailyReport): { jsonPath: string; mdPath: string } {
  ensureDir(REVIEWS_DIR);

  const jsonPath = resolve(REVIEWS_DIR, `${report.date}.json`);
  const mdPath = resolve(REVIEWS_DIR, `${report.date}.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  writeFileSync(mdPath, formatReportMarkdown(report), "utf-8");

  return { jsonPath, mdPath };
}

/**
 * Extract recent trades from an agent (last 10)
 */
function extractRecentTrades(agent: Agent): TradeRecord[] {
  try {
    const trades = agent.getTrades();
    if (trades.length === 0) return [];

    return trades.slice(-10).map((t) => ({
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      shares: 0,
      side: (t.direction ?? "long") === "long" ? ("buy" as const) : ("sell" as const),
      pnl: t.return,
      returnPercent: t.returnPercent,
      reason: t.exitReason ?? "signal",
      direction: t.direction ?? "long",
      exitReason: t.exitReason,
      mfe: t.mfe,
      mae: t.mae,
      mfeUtilization: t.mfeUtilization,
      holdingBars: t.holdingDays,
    }));
  } catch {
    return [];
  }
}

/**
 * Compute a simple composite score for ranking
 */
function computeAgentScore(report: AgentReport): number {
  const m = report.metrics;
  const sharpeNorm = Math.min(Math.max(m.sharpeRatio, 0) / 2, 1) * 100;
  const winRateNorm = Math.min(m.winRate, 100);
  const ddNorm = Math.max(0, 1 - m.maxDrawdown / 50) * 100;
  const pfNorm =
    Math.min(Math.max(m.profitFactor === Number.POSITIVE_INFINITY ? 3 : m.profitFactor, 0) / 3, 1) *
    100;
  const retNorm = Math.min(Math.max((m.totalReturnPercent + 50) / 150, 0), 1) * 100;

  return sharpeNorm * 0.3 + winRateNorm * 0.15 + ddNorm * 0.2 + pfNorm * 0.2 + retNorm * 0.15;
}

/**
 * Load metrics from past N days of reports
 */
function loadHistoricalTrend(currentDate: string, days: number): HistoricalMetric[] {
  ensureDir(REVIEWS_DIR);
  const results: HistoricalMetric[] = [];

  try {
    const files = readdirSync(REVIEWS_DIR)
      .filter((f) => f.endsWith(".json") && !f.includes("-review"))
      .sort()
      .slice(-days);

    for (const file of files) {
      const path = resolve(REVIEWS_DIR, file);
      try {
        const data = JSON.parse(readFileSync(path, "utf-8")) as DailyReport;
        if (data.date === currentDate) continue;
        for (const agent of data.agents) {
          results.push({
            date: data.date,
            agentId: agent.agentId,
            metrics: agent.metrics,
          });
        }
      } catch {
        // Skip corrupted files
      }
    }
  } catch {
    // Reviews dir may not exist yet
  }

  return results;
}

/**
 * Format report as human-readable Markdown
 */
function formatReportMarkdown(report: DailyReport): string {
  const lines: string[] = [];

  lines.push(`# Daily Review: ${report.date}`);
  lines.push("");
  lines.push(`Generated at: ${new Date(report.generatedAt).toISOString()}`);
  lines.push("");

  // Market Context
  if (report.marketContext.length > 0) {
    lines.push("## Market Context");
    lines.push("");
    lines.push("| Symbol | Close | Change% | Volume |");
    lines.push("|--------|-------|---------|--------|");
    for (const mc of report.marketContext) {
      lines.push(
        `| ${mc.symbol} | $${mc.close.toFixed(2)} | ${mc.dailyChangePercent >= 0 ? "+" : ""}${mc.dailyChangePercent.toFixed(2)}% | ${formatVolume(mc.volume)} |`,
      );
    }
    lines.push("");
  }

  // Leaderboard
  lines.push("## Agent Leaderboard");
  lines.push("");
  lines.push("| Rank | Agent | Score | Return% | WinRate | Sharpe | MaxDD | PF | Trades |");
  lines.push("|------|-------|-------|---------|---------|--------|-------|----|--------|");
  for (const entry of report.leaderboard) {
    const m = entry.metrics;
    lines.push(
      `| #${entry.rank} | ${entry.agentId} | ${entry.score.toFixed(1)} | ${m.totalReturnPercent.toFixed(2)}% | ${m.winRate.toFixed(1)}% | ${m.sharpeRatio.toFixed(2)} | ${m.maxDrawdown.toFixed(1)}% | ${m.profitFactor === Number.POSITIVE_INFINITY ? "Inf" : m.profitFactor.toFixed(2)} | ${m.totalTrades} |`,
    );
  }
  lines.push("");

  // Agent Details
  lines.push("## Agent Details");
  lines.push("");
  for (const agent of report.agents) {
    const status = agent.active ? "Active" : "Inactive";
    lines.push(`### ${agent.agentId} (${status})`);
    lines.push("");
    lines.push(`- **Strategy**: ${agent.strategyId}`);
    lines.push(`- **Symbol**: ${agent.symbol}`);
    lines.push(`- **Tier**: ${agent.tier}`);
    lines.push(
      `- **Total Return**: $${agent.metrics.totalReturn.toFixed(2)} (${agent.metrics.totalReturnPercent.toFixed(2)}%)`,
    );
    lines.push(`- **Daily P&L**: $${agent.metrics.dailyPnl.toFixed(2)}`);
    lines.push(
      `- **Promotion**: ${agent.promotionDecision.action} — ${agent.promotionDecision.reason}`,
    );
    lines.push("");
  }

  // Backtest Results
  if (report.backtestResults && report.backtestResults.length > 0) {
    lines.push("## Backtest Results");
    lines.push("");
    lines.push(
      "| Rank | Strategy | Symbol | Score | Return% | WinRate | Sharpe | MaxDD | PF | Trades |",
    );
    lines.push(
      "|------|----------|--------|-------|---------|---------|--------|-------|----|--------|",
    );
    report.backtestResults.forEach((b, i) => {
      lines.push(
        `| #${i + 1} | ${b.strategyId} | ${b.symbol} | ${b.score.toFixed(1)} | ${b.totalReturnPercent.toFixed(2)}% | ${b.winRate.toFixed(1)}% | ${b.sharpeRatio.toFixed(2)} | ${b.maxDrawdown.toFixed(1)}% | ${b.profitFactor === Number.POSITIVE_INFINITY ? "Inf" : b.profitFactor.toFixed(2)} | ${b.tradeCount} |`,
      );
    });
    lines.push("");
  }

  // Buy & Hold Benchmark
  if (report.buyAndHold && report.buyAndHold.length > 0) {
    lines.push("## Buy & Hold Benchmark");
    lines.push("");
    lines.push("| Symbol | Start | End | Return% | Period |");
    lines.push("|--------|-------|-----|---------|--------|");
    for (const bh of report.buyAndHold) {
      lines.push(
        `| ${bh.symbol} | $${bh.startPrice.toFixed(2)} | $${bh.endPrice.toFixed(2)} | ${bh.returnPercent >= 0 ? "+" : ""}${bh.returnPercent.toFixed(2)}% | ${bh.period} |`,
      );
    }
    lines.push("");
  }

  // Active Overrides
  if (report.activeOverrides.length > 0) {
    lines.push("## Active Parameter Overrides");
    lines.push("");
    for (const override of report.activeOverrides) {
      lines.push(
        `- **${override.strategyId}** (applied ${new Date(override.appliedAt).toISOString()}): ${override.reasoning}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return String(vol);
}
