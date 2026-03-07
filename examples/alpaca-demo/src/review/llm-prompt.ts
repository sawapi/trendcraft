/**
 * LLM System Prompt and Response Schema
 *
 * Defines the instructions and expected response format for the
 * Claude API daily review call.
 */

import type { DailyReport, LLMRecommendation, ReviewRecord } from "./types.js";

/**
 * Build the system prompt for the daily review
 */
export function buildSystemPrompt(): string {
  return `You are a quantitative portfolio manager reviewing daily performance of an automated multi-agent paper trading system.

## Your Role
- Analyze daily agent performance and market conditions
- Recommend concrete actions to improve the portfolio
- Be conservative — small iterative improvements beat dramatic changes

## Available Actions (respond in JSON)

1. **adjust_params** — Modify parameters of an existing strategy
   - Can change: indicators (params only), position sizing, guards, entry/exit conditions
   - Constraint: Parameter changes must stay within ±20% of current values per day
   - Constraint: All values must stay within the palette's min/max bounds

2. **kill_agent** — Deactivate a consistently underperforming agent
   - Limit: 1 per day
   - Only kill agents with clear negative trends (not just one bad day)

3. **revive_agent** — Reactivate a previously killed agent with optional param changes
   - Limit: 1 per day
   - Must provide reasoning for why conditions have changed

4. **create_strategy** — Propose a new strategy template
   - Limit: 1 per day
   - Must use only indicators and conditions from the provided palette
   - Will be validated via backtest (minimum score of 30 required)
   - You do NOT write code — only specify indicator types, names, params, and condition references

## Response Format
Respond with ONLY valid JSON matching this schema:
{
  "summary": "Brief overall assessment (1-2 sentences)",
  "marketAnalysis": "Brief market condition analysis",
  "actions": [
    // Array of action objects (can be empty if no changes needed)
  ]
}

## Action Schemas

### adjust_params
{
  "action": "adjust_params",
  "strategyId": "strategy-id",
  "changes": {
    "indicators": [{ "type": "rsi", "name": "rsi", "params": { "period": 16 } }],
    "position": { "stopLoss": 3.5, "riskPercent": 1.2 },
    "guards": { "maxDailyTrades": 12 }
  },
  "reasoning": "Why this change"
}

### kill_agent
{
  "action": "kill_agent",
  "agentId": "strategy-id:SYMBOL",
  "reasoning": "Why kill this agent"
}

### revive_agent
{
  "action": "revive_agent",
  "agentId": "strategy-id:SYMBOL",
  "paramChanges": { ... },  // optional, same as adjust_params.changes
  "reasoning": "Why revive"
}

### create_strategy
{
  "action": "create_strategy",
  "template": {
    "id": "new-strategy-id",
    "name": "Human Readable Name",
    "description": "Brief description",
    "intervalMs": 60000,
    "symbols": ["AAPL", "SPY"],
    "indicators": [
      { "type": "rsi", "name": "rsi", "params": { "period": 14 } },
      { "type": "ema", "name": "ema20", "params": { "period": 20 } }
    ],
    "entry": { "type": "rsiBelow", "params": { "threshold": 25 } },
    "exit": { "type": "rsiAbove", "params": { "threshold": 75 } },
    "guards": { "maxDailyLoss": -5000, "maxDailyTrades": 10 },
    "position": {
      "capital": 100000,
      "sizingMethod": "risk-based",
      "riskPercent": 1,
      "stopLoss": 3,
      "takeProfit": 6,
      "slippage": 0.05
    },
    "source": "llm-generated",
    "parentId": "optional-parent-strategy-id",
    "reasoning": "Why this strategy should work"
  },
  "reasoning": "Overall reasoning"
}

## Important Guidelines
- If performance is acceptable, it's OK to return an empty actions array
- Focus on agents with clear negative trends over multiple days
- When adjusting parameters, prefer small changes (5-10%) over large ones
- Consider market context when making recommendations
- Learn from past review history — if a previous change made things worse, suggest reverting`;
}

/**
 * Build the user message with daily report and history
 */
export function buildUserMessage(
  report: DailyReport,
  history: ReviewRecord[],
): string {
  const parts: string[] = [];

  parts.push(`# ${report.mode === "backtest" ? "Backtest" : "Daily Performance"} Report`);
  parts.push(`Date: ${report.date}`);
  parts.push(`Mode: ${report.mode}`);
  parts.push("");

  // Market context
  if (report.marketContext.length > 0) {
    parts.push("## Market Context");
    for (const mc of report.marketContext) {
      parts.push(
        `- ${mc.symbol}: $${mc.close.toFixed(2)} (${mc.dailyChangePercent >= 0 ? "+" : ""}${mc.dailyChangePercent.toFixed(2)}%)`,
      );
    }
    parts.push("");
  }

  // Backtest results (if available)
  if (report.backtestResults && report.backtestResults.length > 0) {
    parts.push("## Backtest Results");
    for (const b of report.backtestResults) {
      parts.push(`- **${b.strategyId}:${b.symbol}** — Score: ${b.score.toFixed(1)}, Return: ${b.totalReturnPercent.toFixed(2)}%, WR: ${b.winRate.toFixed(1)}%, Sharpe: ${b.sharpeRatio.toFixed(2)}, DD: ${b.maxDrawdown.toFixed(1)}%, PF: ${b.profitFactor === Infinity ? "Inf" : b.profitFactor.toFixed(2)}, Trades: ${b.tradeCount}`);
    }
    parts.push("");
  }

  // Agent performance
  parts.push("## Agent Performance");
  for (const agent of report.agents) {
    const m = agent.metrics;
    parts.push(`### ${agent.agentId} [${agent.active ? "ACTIVE" : "INACTIVE"}]`);
    parts.push(`Strategy: ${agent.strategyId} | Symbol: ${agent.symbol} | Tier: ${agent.tier}`);
    parts.push(`Return: $${m.totalReturn.toFixed(2)} (${m.totalReturnPercent.toFixed(2)}%)`);
    parts.push(`Daily P&L: $${m.dailyPnl.toFixed(2)}`);
    parts.push(`Win Rate: ${m.winRate.toFixed(1)}% | Sharpe: ${m.sharpeRatio.toFixed(2)} | MaxDD: ${m.maxDrawdown.toFixed(1)}% | PF: ${m.profitFactor === Infinity ? "Inf" : m.profitFactor.toFixed(2)} | Trades: ${m.totalTrades}`);
    parts.push(`Promotion: ${agent.promotionDecision.action} — ${agent.promotionDecision.reason}`);
    parts.push("");
  }

  // Leaderboard
  parts.push("## Leaderboard");
  for (const entry of report.leaderboard) {
    parts.push(
      `#${entry.rank} ${entry.agentId} (score: ${entry.score.toFixed(1)})`,
    );
  }
  parts.push("");

  // Historical trend
  if (report.historicalTrend.length > 0) {
    parts.push("## Historical Trend (past 7 days)");
    const byAgent = new Map<string, typeof report.historicalTrend>();
    for (const h of report.historicalTrend) {
      const arr = byAgent.get(h.agentId) ?? [];
      arr.push(h);
      byAgent.set(h.agentId, arr);
    }
    for (const [agentId, entries] of byAgent) {
      parts.push(`### ${agentId}`);
      for (const e of entries) {
        parts.push(
          `  ${e.date}: Return ${e.metrics.totalReturnPercent.toFixed(2)}%, Sharpe ${e.metrics.sharpeRatio.toFixed(2)}, DD ${e.metrics.maxDrawdown.toFixed(1)}%`,
        );
      }
    }
    parts.push("");
  }

  // Active overrides
  if (report.activeOverrides.length > 0) {
    parts.push("## Current Active Overrides");
    for (const o of report.activeOverrides) {
      parts.push(`- ${o.strategyId}: ${o.reasoning} (applied ${new Date(o.appliedAt).toISOString().split("T")[0]})`);
    }
    parts.push("");
  }

  // Past review history
  if (history.length > 0) {
    parts.push("## Recent Review History");
    for (const record of history.slice(-5)) {
      parts.push(`### ${record.date}`);
      parts.push(`Summary: ${record.llmResponse.summary}`);
      if (record.appliedActions.length > 0) {
        parts.push("Applied:");
        for (const a of record.appliedActions) {
          parts.push(`  - ${a.action.action}: ${a.action.reasoning}${a.backtestScore !== undefined ? ` (backtest score: ${a.backtestScore.toFixed(1)})` : ""}`);
        }
      }
      if (record.rejectedActions.length > 0) {
        parts.push("Rejected:");
        for (const r of record.rejectedActions) {
          parts.push(`  - ${r.action.action}: ${r.reason}`);
        }
      }
      parts.push("");
    }
  }

  // Available palette
  parts.push("## Available Palette");
  parts.push("### Indicators");
  for (const [key, ind] of Object.entries(report.palette.indicators)) {
    const def = ind as { description: string; params: Record<string, { min: number; max: number; default: number }> };
    const paramStr = Object.entries(def.params)
      .map(([k, v]) => `${k}: ${v.min}-${v.max} (default: ${v.default})`)
      .join(", ");
    parts.push(`- **${key}**: ${def.description}${paramStr ? ` [${paramStr}]` : ""}`);
  }
  parts.push("### Conditions");
  for (const [key, cond] of Object.entries(report.palette.conditions)) {
    const def = cond as { description: string; requiredIndicators?: string[] };
    parts.push(`- **${key}**: ${def.description}${def.requiredIndicators ? ` (requires: ${def.requiredIndicators.join(", ")})` : ""}`);
  }

  return parts.join("\n");
}

/**
 * Parse and validate the LLM response JSON
 */
export function parseLLMResponse(text: string): LLMRecommendation | null {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Basic shape validation
    if (
      typeof parsed.summary !== "string" ||
      typeof parsed.marketAnalysis !== "string" ||
      !Array.isArray(parsed.actions)
    ) {
      return null;
    }

    // Validate each action has required fields
    for (const action of parsed.actions) {
      if (!action.action || !action.reasoning) return null;

      switch (action.action) {
        case "adjust_params":
          if (!action.strategyId || !action.changes) return null;
          break;
        case "kill_agent":
          if (!action.agentId) return null;
          break;
        case "revive_agent":
          if (!action.agentId) return null;
          break;
        case "create_strategy":
          if (!action.template) return null;
          break;
        default:
          return null;
      }
    }

    return parsed as LLMRecommendation;
  } catch {
    return null;
  }
}
