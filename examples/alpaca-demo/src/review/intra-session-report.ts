/**
 * Intra-Session Report Builder
 *
 * Builds a lightweight report from in-memory agent state for mid-session LLM review.
 * Only includes today's trades and current position state.
 */

import type { AgentManager } from "../agent/manager.js";
import type { MarketState } from "../agent/market-state.js";
import type {
  IntraSessionAgentReport,
  IntraSessionReport,
  MarketContext,
  TradeRecord,
} from "./types.js";

/**
 * Build a lightweight intra-session report from live agent state.
 *
 * @param manager - Agent manager with live agents
 * @param sessionStartTime - Timestamp when the trading session started
 * @param reviewNumber - Sequential review number for this session
 * @param marketState - Optional market state for snapshots
 */
export function buildIntraSessionReport(
  manager: AgentManager,
  sessionStartTime: number,
  reviewNumber: number,
  marketState?: MarketState,
): IntraSessionReport {
  const agents = manager.getAgents();
  const agentReports: IntraSessionAgentReport[] = [];

  for (const agent of agents) {
    const metrics = agent.getMetrics();
    const allTrades = agent.getTrades();

    // Filter to today's trades only (since session start)
    const sessionTrades = allTrades.filter((t) => t.exitTime >= sessionStartTime);

    const wins = sessionTrades.filter((t) => t.return > 0).length;
    const winRate = sessionTrades.length > 0 ? (wins / sessionTrades.length) * 100 : 0;

    // Determine current position state from session state
    const state = agent.getState();
    const position = state.sessionState?.trackerState?.position ?? null;
    const hasPosition = position != null && position.shares > 0;
    const unrealizedPnl = state.sessionState?.trackerState?.account?.unrealizedPnl ?? 0;

    // Convert session trades to TradeRecord format
    const recentTrades: TradeRecord[] = sessionTrades.slice(-5).map((t) => ({
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      entryPrice: t.entryPrice,
      exitPrice: t.exitPrice,
      shares: 0, // Not available from Trade type
      side: "buy" as const,
      pnl: t.return,
      returnPercent: t.returnPercent,
      reason: t.exitReason ?? "signal",
      direction: t.direction,
      exitReason: t.exitReason,
      mfe: t.mfe,
      mae: t.mae,
      mfeUtilization: t.mfeUtilization,
    }));

    agentReports.push({
      agentId: agent.id,
      strategyId: agent.strategyId,
      symbol: agent.symbol,
      active: true,
      sessionPnl: metrics.dailyPnl,
      unrealizedPnl,
      tradesThisSession: sessionTrades.length,
      winRate,
      currentPosition: hasPosition ? "long" : "flat",
      recentTrades,
    });
  }

  // Build market snapshots from market state
  const marketSnapshots: MarketContext[] = [];
  if (marketState) {
    const symbols = [...new Set(agents.map((a) => a.symbol))];
    for (const symbol of symbols) {
      const snapshot = marketState.getSnapshot(symbol);
      if (snapshot) {
        marketSnapshots.push({
          symbol,
          dailyChangePercent: snapshot.dailyChangePercent,
          close: snapshot.lastPrice,
          volume: 0,
          volatilityRegime: snapshot.volatilityRegime,
          trendDirection: snapshot.trendDirection,
        });
      }
    }
  }

  // Aggregate regime summary for the report
  const regimeSummary = buildRegimeSummary(marketSnapshots);

  return {
    timestamp: Date.now(),
    sessionStartTime,
    reviewNumber,
    agents: agentReports,
    marketSnapshots,
    regimeSummary,
  };
}

/**
 * Build a regime summary from market snapshots.
 */
function buildRegimeSummary(
  snapshots: MarketContext[],
): { dominantTrend: string; dominantVolatility: string; description: string } | undefined {
  if (snapshots.length === 0) return undefined;

  const trends: Record<string, number> = {};
  const volatilities: Record<string, number> = {};

  for (const s of snapshots) {
    if (s.trendDirection) {
      trends[s.trendDirection] = (trends[s.trendDirection] ?? 0) + 1;
    }
    if (s.volatilityRegime) {
      volatilities[s.volatilityRegime] = (volatilities[s.volatilityRegime] ?? 0) + 1;
    }
  }

  const dominantTrend = Object.entries(trends).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
  const dominantVolatility =
    Object.entries(volatilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

  const description = `Market regime: ${dominantTrend} trend, ${dominantVolatility} volatility across ${snapshots.length} symbols`;

  return { dominantTrend, dominantVolatility, description };
}
