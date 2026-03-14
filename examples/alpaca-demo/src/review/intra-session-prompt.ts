/**
 * Intra-Session Prompt — tactical, short-term focused prompts for mid-session LLM review
 *
 * Uses a shorter, more focused prompt than the daily review.
 * Only allows adjust_params, kill_agent, and revive_agent actions.
 * create_strategy is explicitly forbidden (too expensive mid-session).
 */

import type { IntraSessionReport, TradeRecord } from "./types.js";

/**
 * Build the system prompt for intra-session review
 */
export function buildIntraSessionSystemPrompt(): string {
  return `You are a tactical trading supervisor monitoring a live multi-agent paper trading system during market hours.

## Your Role
- Analyze real-time agent performance within the CURRENT trading session
- Make quick tactical adjustments to improve intraday performance
- Kill underperforming agents that are actively losing money
- Revive previously killed agents if market conditions have changed
- Be decisive but cautious — you're operating on live positions

## Available Actions (respond in JSON)

1. **adjust_params** — Modify strategy parameters (tactical adjustments only)
   - Can change: indicators (params only), position sizing, guards, stopLoss, takeProfit, trailingStop, marketFilter
   - Constraint: Parameter changes must stay within ±10% of current values
   - BLOCKED: Cannot change entry/exit conditions while agent has an open position

2. **kill_agent** — Deactivate an agent that is actively harmful
   - Limit: 2 per session
   - Use for agents with clear intraday losses or broken behavior

3. **revive_agent** — Reactivate a previously killed agent
   - Limit: 2 per session
   - Use when market conditions shift in favor of the killed strategy

**FORBIDDEN: create_strategy** — Not allowed during market hours (requires backtest validation)

## Response Format
Respond with ONLY valid JSON:
{
  "summary": "Brief tactical assessment (1 sentence)",
  "marketAnalysis": "Current market conditions (1 sentence)",
  "actions": []
}

## Action Schemas

### adjust_params
{
  "action": "adjust_params",
  "strategyId": "strategy-id",
  "changes": {
    "position": { "stopLoss": 3.5, "trailingStop": 2.0 },
    "guards": { "maxDailyTrades": 8 },
    "marketFilter": { "symbol": "SPY", "maxDailyChange": -0.5 }
  },
  "reasoning": "Why this tactical change"
}

### kill_agent
{
  "action": "kill_agent",
  "agentId": "strategy-id:SYMBOL",
  "reasoning": "Why kill now"
}

### revive_agent
{
  "action": "revive_agent",
  "agentId": "strategy-id:SYMBOL",
  "reasoning": "Why revive now"
}

## Tactical Guidelines
- Focus on TODAY's session only — don't analyze multi-day trends
- Prioritize stopping bleeding (kill losing agents) over optimization
- Small parameter tweaks (5-10%) are preferred over large changes
- If things are going OK, return empty actions — don't change for the sake of changing
- Watch for agents with multiple consecutive losses in the session
- Consider market conditions: if SPY is tanking, mean-reversion might struggle
- Agents with open positions: only adjust stop/TP levels, don't touch entry/exit logic`;
}

/**
 * Build the user message for intra-session review
 */
export function buildIntraSessionUserMessage(report: IntraSessionReport): string {
  const parts: string[] = [];

  const sessionDuration = (report.timestamp - report.sessionStartTime) / 60_000;
  parts.push(`# Intra-Session Review #${report.reviewNumber}`);
  parts.push(
    `Time: ${new Date(report.timestamp).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false })}`,
  );
  parts.push(`Session Duration: ${sessionDuration.toFixed(0)} minutes`);
  parts.push("");

  // Market snapshots
  if (report.marketSnapshots.length > 0) {
    parts.push("## Market Now");
    for (const mc of report.marketSnapshots) {
      let line = `- ${mc.symbol}: $${mc.close.toFixed(2)} (${mc.dailyChangePercent >= 0 ? "+" : ""}${mc.dailyChangePercent.toFixed(2)}%)`;
      if (mc.volatilityRegime) line += ` | Vol: ${mc.volatilityRegime}`;
      if (mc.trendDirection) line += ` | Trend: ${mc.trendDirection}`;
      parts.push(line);
    }
    parts.push("");
  }

  // Regime summary
  if (report.regimeSummary) {
    parts.push("## Regime Summary");
    parts.push(report.regimeSummary.description);
    parts.push(
      `Dominant Trend: ${report.regimeSummary.dominantTrend} | Volatility: ${report.regimeSummary.dominantVolatility}`,
    );
    parts.push("");
  }

  // Agent performance
  parts.push("## Agents");
  for (const agent of report.agents) {
    const posIcon = agent.currentPosition === "long" ? "[LONG]" : "[FLAT]";
    const pnlStr =
      agent.sessionPnl >= 0
        ? `+$${agent.sessionPnl.toFixed(2)}`
        : `-$${Math.abs(agent.sessionPnl).toFixed(2)}`;
    const unrealStr =
      agent.unrealizedPnl !== 0
        ? ` | Unrealized: ${agent.unrealizedPnl >= 0 ? "+" : ""}$${agent.unrealizedPnl.toFixed(2)}`
        : "";

    parts.push(`### ${agent.agentId} ${posIcon} ${agent.active ? "ACTIVE" : "KILLED"}`);
    parts.push(`Session P&L: ${pnlStr}${unrealStr}`);
    parts.push(`Trades: ${agent.tradesThisSession} | Win Rate: ${agent.winRate.toFixed(0)}%`);

    if (agent.recentTrades.length > 0) {
      parts.push("Trades:");
      for (const t of agent.recentTrades) {
        parts.push(`  ${formatIntraTradeRecord(t)}`);
      }
    }
    parts.push("");
  }

  return parts.join("\n");
}

/**
 * Format a single trade for the intra-session prompt (compact)
 */
function formatIntraTradeRecord(t: TradeRecord): string {
  const ret =
    t.returnPercent >= 0 ? `+${t.returnPercent.toFixed(1)}%` : `${t.returnPercent.toFixed(1)}%`;
  const exit = t.exitReason ?? "signal";
  return `$${t.entryPrice.toFixed(2)}→$${t.exitPrice.toFixed(2)} (${ret}) exit:${exit}`;
}
