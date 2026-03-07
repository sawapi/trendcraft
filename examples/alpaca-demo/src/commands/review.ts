/**
 * CLI command: review
 *
 * Daily review cycle: generate report, optionally call LLM, optionally apply changes.
 *
 * Usage:
 *   review --report-only                      Generate report only (no API needed)
 *   review                                    Generate report + LLM review (preview only)
 *   review --apply                            Generate report + LLM review + apply changes
 *   review --apply --days 14                  Include 14 days of history for LLM context
 *   review --from-backtest -s SPY -p 1 -t 1Min   Review backtest results (no live needed)
 */

import { loadEnv } from "../config/env.js";
import { createStateStore } from "../persistence/store.js";
import { createAgentManager } from "../agent/manager.js";
import {
  getAllStrategies,
  applyStrategyOverrides,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";
import {
  generateDailyReport,
  generateBacktestReport,
  saveReport,
} from "../review/report-generator.js";
import { reviewWithLLM } from "../review/llm-client.js";
import { validateRecommendation } from "../review/safety.js";
import { applyActions, loadOverrides } from "../review/applier.js";
import {
  saveReviewRecord,
  loadRecentReviews,
  loadTodayReviews,
} from "../review/history.js";
import { fetchHistoricalBars, monthsAgo, today } from "../alpaca/historical.js";
import { runStrategyBacktests } from "../backtest/runner.js";
import { PRESET_TEMPLATES } from "../strategy/template.js";
import { loadCustomStrategies } from "../review/applier.js";
import type { MarketContext, DailyReport } from "../review/types.js";

export type ReviewCommandOptions = {
  reportOnly?: boolean;
  apply?: boolean;
  days?: string;
  fromBacktest?: boolean;
  symbols?: string;
  period?: string;
  timeframe?: string;
  capital?: string;
};

export async function reviewCommand(opts: ReviewCommandOptions): Promise<void> {
  const date = new Date().toISOString().split("T")[0];

  if (opts.fromBacktest) {
    return backtestReviewCommand(opts, date);
  }

  return liveReviewCommand(opts, date);
}

/**
 * Review based on backtest results — works anytime, no live trading needed
 */
async function backtestReviewCommand(
  opts: ReviewCommandOptions,
  date: string,
): Promise<void> {
  console.log(`\n=== Backtest Review: ${date} ===\n`);

  const env = loadEnv();
  const symbols = opts.symbols
    ? opts.symbols.split(",").map((s) => s.trim().toUpperCase())
    : ["SPY"];
  const periodMonths = parseInt(opts.period ?? "3", 10);
  const capital = parseInt(opts.capital ?? "100000", 10);
  const timeframe = opts.timeframe ?? "1Day";

  // Load overrides and custom strategies
  const overrides = loadOverrides();
  if (overrides.length > 0) {
    const { applied, errors } = applyStrategyOverrides(overrides);
    if (applied > 0) console.log(`Applied ${applied} strategy override(s)`);
    for (const err of errors) console.warn(`Override error: ${err}`);
  }
  const customTemplates = loadCustomStrategies();
  if (customTemplates.length > 0) {
    const { loaded, errors } = loadCustomStrategiesFromTemplates(customTemplates, overrides);
    if (loaded > 0) console.log(`Loaded ${loaded} custom strategy(ies)`);
    for (const err of errors) console.warn(`Custom strategy error: ${err}`);
  }

  const strategies = getAllStrategies();

  console.log(
    `Running backtest: ${strategies.length} strategies x ${symbols.length} symbols`,
  );
  console.log(
    `Period: ${periodMonths} months | Timeframe: ${timeframe} | Capital: $${capital.toLocaleString()}\n`,
  );

  const allRankings: import("../backtest/scorer.js").ScoredResult[] = [];

  for (const symbol of symbols) {
    console.log(`Fetching data for ${symbol}...`);
    const candles = await fetchHistoricalBars(env, {
      symbol,
      timeframe: timeframe as "1Day",
      start: monthsAgo(periodMonths),
      end: today(),
    });

    if (candles.length < 50) {
      console.warn(`  Skipping ${symbol}: only ${candles.length} candles`);
      continue;
    }

    console.log(`  ${candles.length} candles. Running strategies...`);
    const { rankings } = runStrategyBacktests(strategies, symbol, candles, capital);
    allRankings.push(...rankings);
  }

  allRankings.sort((a, b) => b.score - a.score);

  // Fetch market context
  let marketContext: MarketContext[] = [];
  try {
    marketContext = await fetchMarketContext(env, symbols);
  } catch {
    // OK
  }

  const activeOverrides = loadOverrides();
  const report = generateBacktestReport({
    rankings: allRankings,
    marketContext,
    activeOverrides,
    date,
  });

  const { jsonPath, mdPath } = saveReport(report);
  console.log(`\nReport saved:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);

  // Print leaderboard
  printLeaderboard(report);

  if (opts.reportOnly) {
    console.log("\n--report-only mode: skipping LLM review.");
    return;
  }

  // Continue to LLM review
  await runLLMReview(report, opts, date, allRankings);
}

/**
 * Review based on live/paper trading results
 */
async function liveReviewCommand(
  opts: ReviewCommandOptions,
  date: string,
): Promise<void> {
  console.log(`\n=== Daily Review: ${date} ===\n`);

  // Load agent state
  const store = createStateStore();
  const savedState = store.load();

  if (!savedState || savedState.agents.length === 0) {
    console.log("No agent state found. Run 'live' first, or use --from-backtest.");
    return;
  }

  // Rebuild agent manager from state
  const strategyMap = new Map(
    getAllStrategies().map((s) => [s.id, s]),
  );
  const manager = createAgentManager();
  manager.restoreStates(savedState.agents, strategyMap);

  const agents = manager.getAgents();
  console.log(`Loaded ${agents.length} agents from state.\n`);

  // Fetch market context
  let marketContext: MarketContext[] = [];
  try {
    const env = loadEnv();
    const symbols = [...new Set(agents.map((a) => a.symbol))];
    marketContext = await fetchMarketContext(env, symbols);
  } catch {
    console.log("Could not fetch market context (Alpaca API may not be configured).");
  }

  // Load active overrides
  const activeOverrides = loadOverrides();

  // Generate report
  const report = generateDailyReport({
    agents,
    agentStates: savedState.agents,
    marketContext,
    activeOverrides,
    date,
  });

  const { jsonPath, mdPath } = saveReport(report);
  console.log(`Report saved:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);

  printLeaderboard(report);

  if (opts.reportOnly) {
    console.log("\n--report-only mode: skipping LLM review.");
    return;
  }

  // Continue to LLM review
  await runLLMReview(report, opts, date);
}

/**
 * Shared LLM review + apply logic
 */
async function runLLMReview(
  report: DailyReport,
  opts: ReviewCommandOptions,
  date: string,
  backtestRankings?: import("../backtest/scorer.js").ScoredResult[],
): Promise<void> {
  console.log("\n--- LLM Review ---");
  const historyDays = parseInt(opts.days ?? "7", 10);
  const history = loadRecentReviews(historyDays);

  let recommendation;
  try {
    recommendation = await reviewWithLLM(report, history);
  } catch (err) {
    console.error(
      "LLM review failed:",
      err instanceof Error ? err.message : err,
    );
    return;
  }

  console.log(`\nLLM Summary: ${recommendation.summary}`);
  console.log(`Market Analysis: ${recommendation.marketAnalysis}`);
  console.log(`Actions proposed: ${recommendation.actions.length}`);

  for (const action of recommendation.actions) {
    console.log(`  - [${action.action}] ${action.reasoning}`);
  }

  // Validate actions
  const allTemplates = [
    ...PRESET_TEMPLATES,
    ...loadCustomStrategies(),
  ];
  const todayReviews = loadTodayReviews();
  const { valid, rejected } = validateRecommendation(
    recommendation,
    todayReviews,
    allTemplates,
  );

  if (rejected.length > 0) {
    console.log(`\nRejected actions (${rejected.length}):`);
    for (const r of rejected) {
      console.log(`  - [${r.action.action}] ${r.reason}`);
    }
  }

  if (valid.length === 0) {
    console.log("\nNo valid actions to apply.");
    const record = {
      date,
      reviewedAt: Date.now(),
      llmResponse: recommendation,
      appliedActions: [],
      rejectedActions: rejected,
    };
    saveReviewRecord(record);
    return;
  }

  if (!opts.apply) {
    console.log(
      `\n${valid.length} valid action(s) ready. Use --apply to apply them.`,
    );
    const record = {
      date,
      reviewedAt: Date.now(),
      llmResponse: recommendation,
      appliedActions: [],
      rejectedActions: rejected,
    };
    saveReviewRecord(record);
    return;
  }

  // Apply actions
  console.log(`\n--- Applying ${valid.length} action(s) ---`);

  // Fetch backtest data for create_strategy gate
  let backtestCandles;
  const createActions = valid.filter((a) => a.action === "create_strategy");
  if (createActions.length > 0) {
    try {
      const env = loadEnv();
      const symbol = "SPY";
      console.log(`Fetching 3-month backtest data for ${symbol}...`);
      backtestCandles = await fetchHistoricalBars(env, {
        symbol,
        timeframe: "1Day",
        start: monthsAgo(3),
        end: today(),
      });
    } catch {
      console.log("Could not fetch backtest data — new strategies will be saved without backtest gate.");
    }
  }

  const { applied, rejected: applyRejected } = await applyActions(
    valid,
    backtestCandles,
  );

  console.log(`\nApplied: ${applied.length}`);
  for (const a of applied) {
    console.log(
      `  - [${a.action.action}] ${a.action.reasoning}${a.backtestScore !== undefined ? ` (score: ${a.backtestScore.toFixed(1)})` : ""}`,
    );
  }

  if (applyRejected.length > 0) {
    console.log(`Rejected during apply: ${applyRejected.length}`);
    for (const r of applyRejected) {
      console.log(`  - [${r.action.action}] ${r.reason}`);
    }
  }

  // Save review record
  const record = {
    date,
    reviewedAt: Date.now(),
    llmResponse: recommendation,
    appliedActions: applied,
    rejectedActions: [...rejected, ...applyRejected],
  };
  const reviewPath = saveReviewRecord(record);
  console.log(`\nReview record saved: ${reviewPath}`);
}

function printLeaderboard(report: DailyReport): void {
  console.log(`\n--- Leaderboard ---`);
  for (const entry of report.leaderboard) {
    const m = entry.metrics;
    console.log(
      `  #${entry.rank} ${entry.agentId.padEnd(30)} Score: ${entry.score.toFixed(1).padEnd(6)} Return: ${m.totalReturnPercent.toFixed(2)}%  Sharpe: ${m.sharpeRatio.toFixed(2)}`,
    );
  }
}

/**
 * Fetch market context for symbols using Alpaca API
 */
async function fetchMarketContext(
  env: import("../config/env.js").AlpacaEnv,
  symbols: string[],
): Promise<MarketContext[]> {
  const results: MarketContext[] = [];

  for (const symbol of symbols) {
    try {
      const bars = await fetchHistoricalBars(env, {
        symbol,
        timeframe: "1Day",
        start: daysAgo(2),
        end: today(),
        limit: 2,
      });

      if (bars.length >= 2) {
        const prev = bars[bars.length - 2];
        const latest = bars[bars.length - 1];
        results.push({
          symbol,
          dailyChangePercent:
            ((latest.close - prev.close) / prev.close) * 100,
          close: latest.close,
          volume: latest.volume,
        });
      } else if (bars.length === 1) {
        results.push({
          symbol,
          dailyChangePercent: 0,
          close: bars[0].close,
          volume: bars[0].volume,
        });
      }
    } catch {
      // Skip symbol if data unavailable
    }
  }

  return results;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
