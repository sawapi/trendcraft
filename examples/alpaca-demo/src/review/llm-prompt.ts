/**
 * LLM System Prompt and Response Schema
 *
 * Defines the instructions and expected response format for the
 * Claude API daily review call.
 */

import type { DailyReport, LLMRecommendation, ReviewRecord, TradeRecord } from "./types.js";

export type UserMessageOptions = {
  rollbackCandidates?: string[];
};

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

## Signal Lifecycle (new)
You can set signalLifecycle in strategy templates to control signal filtering:
- cooldownBars: Suppress same signal for N bars after a trade (reduces whipsaw)
- debounceBars: Require signal for N consecutive bars before acting
- expiryBars: Signal expires if not filled within N bars

## Advanced Exit Strategies (new)
You can set these in the position section:
- atrTrailingStop: { period, multiplier } — volatility-adaptive trailing stop
- partialTakeProfit: { threshold, portion } — take partial profits at threshold
- breakEvenStop: { triggerPercent, offset } — move stop to breakeven after trigger

## Validation Gates
- **Walk-Forward Analysis**: New strategies and logic changes are validated with out-of-sample testing. OOS Sharpe must be > 0 and WFA efficiency > 0.5 to pass
- **Monte Carlo**: Backtest results include statistical significance testing. Strategies relying on few lucky trades will be penalized
- Keep these gates in mind — your proposed changes will be validated automatically

## Trade-Level Analysis (MFE/MAE)
When individual trade data is provided, analyze:
- **MFE Utilization** (actual return / max favorable excursion): Low utilization (<50%) suggests trailing stops or partial take-profits could capture more profit
- **MAE** (max adverse excursion): Large MAE with frequent stop-loss hits suggests stops are too tight or entry timing is poor
- **Exit Reason Distribution**: High stopLoss rate → review stop placement; low takeProfit rate → consider lowering TP targets
- **Holding Bars**: Very short holds with losses suggest false signals; consider debounce/cooldown

## Market Regime Awareness
When regime data is provided:
- **High volatility**: Recommend wider stops (ATR-based), smaller position sizes, and caution with tight parameters
- **Low volatility**: Tighter stops acceptable; trend-following may underperform
- **Sideways/ranging**: Mean-reversion strategies (RSI) tend to outperform; reduce trend-following exposure
- **Strong trend (high ADX)**: Favor trend-following; widen trailing stops to avoid premature exits

## Outcome Tracking
When past action outcomes are shown:
- Actions marked **degraded** should be considered for reversal
- Actions marked **improved** suggest the approach works — consider applying similar logic to other underperforming strategies
- Actions marked **neutral** may need more time or a different approach
- Outcomes use **benchmark-relative scoring**: score changes are adjusted for overall market movement
- Evaluation requires **5 business days** minimum — recent changes may not have outcomes yet

## Safeguards (enforced automatically)
- **Change frequency**: Same strategy cannot be modified more than once every 3 days
- **Weekly limit**: Maximum 3 parameter adjustments per week across all strategies
- **Auto-rollback**: If a strategy receives 2 consecutive "degraded" verdicts, it will be automatically rolled back to its original preset
- **Buy & Hold comparison**: Always consider B&H returns when evaluating strategy performance — outperforming B&H is the minimum bar

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
  options?: UserMessageOptions,
): string {
  const parts: string[] = [];

  parts.push(`# ${report.mode === "backtest" ? "Backtest" : "Daily Performance"} Report`);
  parts.push(`Date: ${report.date}`);
  parts.push(`Mode: ${report.mode}`);
  parts.push("");

  // Market context with regime info
  if (report.marketContext.length > 0) {
    parts.push("## Market Context");
    for (const mc of report.marketContext) {
      let line = `- ${mc.symbol}: $${mc.close.toFixed(2)} (${mc.dailyChangePercent >= 0 ? "+" : ""}${mc.dailyChangePercent.toFixed(2)}%)`;
      if (mc.volatilityRegime) {
        line += ` | Vol: ${mc.volatilityRegime}`;
        if (mc.atrPercent != null) line += ` (ATR: ${mc.atrPercent.toFixed(1)}%)`;
      }
      if (mc.trendDirection) {
        line += ` | Trend: ${mc.trendDirection}`;
        if (mc.trendStrength != null) line += ` (ADX: ${mc.trendStrength.toFixed(0)})`;
      }
      parts.push(line);
    }
    parts.push("");
  }

  // Backtest results (if available)
  if (report.backtestResults && report.backtestResults.length > 0) {
    parts.push("## Backtest Results");
    for (const b of report.backtestResults) {
      let line = `- **${b.strategyId}:${b.symbol}** — Score: ${b.score.toFixed(1)}, Return: ${b.totalReturnPercent.toFixed(2)}%, WR: ${b.winRate.toFixed(1)}%, Sharpe: ${b.sharpeRatio.toFixed(2)}, DD: ${b.maxDrawdown.toFixed(1)}%, PF: ${b.profitFactor === Number.POSITIVE_INFINITY ? "Inf" : b.profitFactor.toFixed(2)}, Trades: ${b.tradeCount}`;
      if (b.monteCarlo) {
        line += ` | MC: ${b.monteCarlo.isSignificant ? "significant" : "not significant"}, P(ret>0): ${(b.monteCarlo.pReturnPositive * 100).toFixed(0)}%, 5%ile: ${b.monteCarlo.percentile5Return.toFixed(2)}%`;
      }
      parts.push(line);
    }
    parts.push("");
  }

  // Data quality
  if (report.dataQuality && report.dataQuality.length > 0) {
    parts.push("## Data Quality");
    for (const dq of report.dataQuality) {
      parts.push(
        `- ${dq.symbol}: ${dq.totalCandles} candles, ${dq.errors} errors, ${dq.warnings} warnings${dq.cleaned ? " (auto-cleaned)" : ""}`,
      );
    }
    parts.push("");
  }

  // Reconciliation
  if (report.reconciliation) {
    const rc = report.reconciliation;
    if (rc.discrepancies > 0 || rc.orphanedPositions > 0) {
      parts.push("## Position Reconciliation");
      parts.push(
        `- Matched: ${rc.matched}, Discrepancies: ${rc.discrepancies}, Orphaned: ${rc.orphanedPositions}`,
      );
      parts.push("");
    }
  }

  // Agent performance
  parts.push("## Agent Performance");
  for (const agent of report.agents) {
    const m = agent.metrics;
    parts.push(`### ${agent.agentId} [${agent.active ? "ACTIVE" : "INACTIVE"}]`);
    parts.push(`Strategy: ${agent.strategyId} | Symbol: ${agent.symbol} | Tier: ${agent.tier}`);
    parts.push(`Return: $${m.totalReturn.toFixed(2)} (${m.totalReturnPercent.toFixed(2)}%)`);
    parts.push(`Daily P&L: $${m.dailyPnl.toFixed(2)}`);
    parts.push(
      `Win Rate: ${m.winRate.toFixed(1)}% | Sharpe: ${m.sharpeRatio.toFixed(2)} | MaxDD: ${m.maxDrawdown.toFixed(1)}% | PF: ${m.profitFactor === Number.POSITIVE_INFINITY ? "Inf" : m.profitFactor.toFixed(2)} | Trades: ${m.totalTrades}`,
    );
    parts.push(`Promotion: ${agent.promotionDecision.action} — ${agent.promotionDecision.reason}`);

    // Individual trade details
    if (agent.recentTrades.length > 0) {
      parts.push("Recent Trades:");
      for (let i = 0; i < agent.recentTrades.length; i++) {
        parts.push(`  ${formatTradeRecord(agent.recentTrades[i], i + 1)}`);
      }
      // Aggregate trade analysis
      parts.push(formatTradeAnalysis(agent.recentTrades));
    }
    parts.push("");
  }

  // Leaderboard
  parts.push("## Leaderboard");
  for (const entry of report.leaderboard) {
    parts.push(`#${entry.rank} ${entry.agentId} (score: ${entry.score.toFixed(1)})`);
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
      parts.push(
        `- ${o.strategyId}: ${o.reasoning} (applied ${new Date(o.appliedAt).toISOString().split("T")[0]})`,
      );
    }
    parts.push("");
  }

  // Past review history with outcome tracking
  if (history.length > 0) {
    parts.push("## Recent Review History");
    for (const record of history.slice(-5)) {
      parts.push(`### ${record.date}`);
      parts.push(`Summary: ${record.llmResponse.summary}`);
      if (record.appliedActions.length > 0) {
        parts.push("Applied:");
        for (const a of record.appliedActions) {
          parts.push(
            `  - ${a.action.action}: ${a.action.reasoning}${a.backtestScore !== undefined ? ` (backtest score: ${a.backtestScore.toFixed(1)})` : ""}`,
          );
        }
      }
      if (record.rejectedActions.length > 0) {
        parts.push("Rejected:");
        for (const r of record.rejectedActions) {
          parts.push(`  - ${r.action.action}: ${r.reason}`);
        }
      }
      // Outcome tracking
      if (record.outcomes && record.outcomes.length > 0) {
        parts.push("Outcomes:");
        for (const o of record.outcomes) {
          const strategyId =
            "strategyId" in o.action
              ? (o.action as { strategyId: string }).strategyId
              : "agentId" in o.action
                ? (o.action as { agentId: string }).agentId
                : "unknown";
          const verdict = o.verdict ? o.verdict.toUpperCase() : "PENDING";
          const scoreStr =
            o.scoreAfter != null
              ? ` (score: ${o.scoreBefore.toFixed(0)}→${o.scoreAfter.toFixed(0)})`
              : ` (score before: ${o.scoreBefore.toFixed(0)})`;
          const benchStr =
            o.relativeDelta != null
              ? ` [relative: ${o.relativeDelta >= 0 ? "+" : ""}${o.relativeDelta.toFixed(1)}, mkt: ${o.benchmarkReturnPercent != null ? `${o.benchmarkReturnPercent >= 0 ? "+" : ""}${o.benchmarkReturnPercent.toFixed(1)}%` : "n/a"}]`
              : "";
          parts.push(`  - ${o.action.action}(${strategyId}): ${verdict}${scoreStr}${benchStr}`);
        }
      }
      parts.push("");
    }
  }

  // Buy & Hold Benchmark
  if (report.buyAndHold && report.buyAndHold.length > 0) {
    parts.push("## Buy & Hold Benchmark");
    for (const bh of report.buyAndHold) {
      parts.push(
        `- ${bh.symbol}: ${bh.returnPercent >= 0 ? "+" : ""}${bh.returnPercent.toFixed(2)}% (${bh.period})`,
      );
    }
    parts.push("Note: Strategies should ideally outperform B&H on a risk-adjusted basis.");
    parts.push("");
  }

  // Rollback candidates
  if (options?.rollbackCandidates && options.rollbackCandidates.length > 0) {
    parts.push("## Auto-Rollback Candidates");
    parts.push(
      "The following strategies have received 2+ consecutive DEGRADED verdicts and will be rolled back to original presets:",
    );
    for (const sid of options.rollbackCandidates) {
      parts.push(`- **${sid}** — rolling back to original preset`);
    }
    parts.push("");
  }

  // Available palette
  parts.push("## Available Palette");
  parts.push("### Indicators");
  for (const [key, ind] of Object.entries(report.palette.indicators)) {
    const def = ind as {
      description: string;
      params: Record<string, { min: number; max: number; default: number }>;
    };
    const paramStr = Object.entries(def.params)
      .map(([k, v]) => `${k}: ${v.min}-${v.max} (default: ${v.default})`)
      .join(", ");
    parts.push(`- **${key}**: ${def.description}${paramStr ? ` [${paramStr}]` : ""}`);
  }
  parts.push("### Conditions");
  for (const [key, cond] of Object.entries(report.palette.conditions)) {
    const def = cond as { description: string; requiredIndicators?: string[] };
    parts.push(
      `- **${key}**: ${def.description}${def.requiredIndicators ? ` (requires: ${def.requiredIndicators.join(", ")})` : ""}`,
    );
  }

  return parts.join("\n");
}

/**
 * Format a single trade record for the LLM prompt
 */
function formatTradeRecord(t: TradeRecord, index: number): string {
  const dir = (t.direction ?? "long").toUpperCase();
  const ret =
    t.returnPercent >= 0 ? `+${t.returnPercent.toFixed(1)}%` : `${t.returnPercent.toFixed(1)}%`;
  const exit = t.exitReason ?? "signal";
  let line = `#${index}: ${dir} $${t.entryPrice.toFixed(2)}→$${t.exitPrice.toFixed(2)} (${ret}) exit:${exit}`;
  if (t.mfe != null) line += ` MFE:${t.mfe.toFixed(1)}%`;
  if (t.mae != null) line += ` MAE:${t.mae.toFixed(1)}%`;
  if (t.mfeUtilization != null) line += ` util:${t.mfeUtilization.toFixed(0)}%`;
  if (t.holdingBars != null) line += ` ${t.holdingBars}bars`;
  return line;
}

/**
 * Format aggregate trade analysis for an agent's recent trades
 */
function formatTradeAnalysis(trades: TradeRecord[]): string {
  if (trades.length === 0) return "";

  const withMfe = trades.filter((t) => t.mfeUtilization != null);
  const avgUtil =
    withMfe.length > 0
      ? withMfe.reduce((s, t) => s + (t.mfeUtilization as number), 0) / withMfe.length
      : null;

  const exitReasons = new Map<string, number>();
  for (const t of trades) {
    const reason = t.exitReason ?? "signal";
    exitReasons.set(reason, (exitReasons.get(reason) ?? 0) + 1);
  }
  const exitDist = [...exitReasons.entries()].map(([r, c]) => `${r}:${c}`).join(" ");

  let line = `  Analysis: exits=[${exitDist}]`;
  if (avgUtil != null) line += ` avgMFEUtil:${avgUtil.toFixed(0)}%`;
  return line;
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
