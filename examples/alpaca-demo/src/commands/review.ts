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

import { atr, detectMarketRegime } from "trendcraft";
import { createAgentManager } from "../agent/manager.js";
import { daysAgo, fetchHistoricalBars, monthsAgo, today } from "../alpaca/historical.js";
import { runStrategyBacktests } from "../backtest/runner.js";
import { loadEnv } from "../config/env.js";
import { createStateStore } from "../persistence/store.js";
import { applyActions, loadOverrides, removeOverride } from "../review/applier.js";
import { loadCustomStrategies } from "../review/applier.js";
import { loadRecentReviews, loadTodayReviews, saveReviewRecord } from "../review/history.js";
import { reviewWithLLM } from "../review/llm-client.js";
import { detectRollbackCandidates, evaluateOutcomes } from "../review/outcome-tracker.js";
import {
  generateBacktestReport,
  generateDailyReport,
  saveReport,
} from "../review/report-generator.js";
import { validateRecommendation } from "../review/safety.js";
import type { BuyAndHoldBenchmark, DailyReport, MarketContext } from "../review/types.js";
import {
  applyStrategyOverrides,
  getAllStrategies,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";
import { PRESET_TEMPLATES } from "../strategy/template.js";
import { createLogger } from "../util/logger.js";

const log = createLogger("REVIEW");

export type ReviewCommandOptions = {
  reportOnly?: boolean;
  apply?: boolean;
  days?: string;
  fromBacktest?: boolean;
  symbols?: string;
  period?: string;
  timeframe?: string;
  capital?: string;
  noAutoReview?: boolean;
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
async function backtestReviewCommand(opts: ReviewCommandOptions, date: string): Promise<void> {
  log.info(`\n=== Backtest Review: ${date} ===\n`);

  const env = loadEnv();
  const symbols = opts.symbols
    ? opts.symbols.split(",").map((s) => s.trim().toUpperCase())
    : ["SPY"];
  const periodMonths = Number.parseInt(opts.period ?? "3", 10);
  const capital = Number.parseInt(opts.capital ?? "100000", 10);
  const timeframe = opts.timeframe ?? "1Day";

  // Load overrides and custom strategies
  const overrides = loadOverrides();
  if (overrides.length > 0) {
    const { applied, errors } = applyStrategyOverrides(overrides);
    if (applied > 0) log.info(`Applied ${applied} strategy override(s)`);
    for (const err of errors) log.warn(`Override error: ${err}`);
  }
  const customTemplates = loadCustomStrategies();
  if (customTemplates.length > 0) {
    const { loaded, errors } = loadCustomStrategiesFromTemplates(customTemplates, overrides);
    if (loaded > 0) log.info(`Loaded ${loaded} custom strategy(ies)`);
    for (const err of errors) log.warn(`Custom strategy error: ${err}`);
  }

  const strategies = getAllStrategies();

  log.info(`Running backtest: ${strategies.length} strategies x ${symbols.length} symbols`);
  log.info(
    `Period: ${periodMonths} months | Timeframe: ${timeframe} | Capital: $${capital.toLocaleString()}\n`,
  );

  const allRankings: import("../backtest/scorer.js").ScoredResult[] = [];
  const buyAndHoldBenchmarks: BuyAndHoldBenchmark[] = [];

  for (const symbol of symbols) {
    log.info(`Fetching data for ${symbol}...`);
    const candles = await fetchHistoricalBars(env, {
      symbol,
      timeframe: timeframe as "1Day",
      start: monthsAgo(periodMonths),
      end: today(),
    });

    if (candles.length < 50) {
      log.warn(`  Skipping ${symbol}: only ${candles.length} candles`);
      continue;
    }

    log.info(`  ${candles.length} candles. Running strategies...`);
    const { rankings } = runStrategyBacktests(strategies, symbol, candles, capital);
    allRankings.push(...rankings);

    // Compute Buy & Hold benchmark
    if (candles.length >= 2) {
      const startPrice = candles[0].close;
      const endPrice = candles[candles.length - 1].close;
      buyAndHoldBenchmarks.push({
        symbol,
        startPrice,
        endPrice,
        returnPercent: ((endPrice - startPrice) / startPrice) * 100,
        period: `${periodMonths}mo`,
      });
    }
  }

  allRankings.sort((a, b) => b.score - a.score);

  // Fetch market context
  let marketContext: MarketContext[] = [];
  try {
    marketContext = await fetchMarketContext(env, symbols);
  } catch (err) {
    log.warn("Failed to fetch market context:", err instanceof Error ? err.message : err);
  }

  const activeOverrides = loadOverrides();
  const report = generateBacktestReport({
    rankings: allRankings,
    marketContext,
    activeOverrides,
    buyAndHold: buyAndHoldBenchmarks,
    date,
  });

  const { jsonPath, mdPath } = saveReport(report);
  log.info("\nReport saved:");
  log.info(`  JSON: ${jsonPath}`);
  log.info(`  Markdown: ${mdPath}`);

  // Print leaderboard
  printLeaderboard(report);

  if (opts.reportOnly) {
    log.info("\n--report-only mode: skipping LLM review.");
    return;
  }

  // Continue to LLM review
  await runLLMReview(report, opts, date, allRankings);
}

/**
 * Review based on live/paper trading results
 */
async function liveReviewCommand(opts: ReviewCommandOptions, date: string): Promise<void> {
  log.info(`\n=== Daily Review: ${date} ===\n`);

  // Load agent state
  const store = createStateStore();
  const savedState = store.load();

  if (!savedState || savedState.agents.length === 0) {
    log.info("No agent state found. Run 'live' first, or use --from-backtest.");
    return;
  }

  // Rebuild agent manager from state
  const strategyMap = new Map(getAllStrategies().map((s) => [s.id, s]));
  const manager = createAgentManager();
  manager.restoreStates(savedState.agents, strategyMap);

  const agents = manager.getAgents();
  log.info(`Loaded ${agents.length} agents from state.\n`);

  // Fetch market context + Buy & Hold benchmark
  let marketContext: MarketContext[] = [];
  const buyAndHoldBenchmarks: BuyAndHoldBenchmark[] = [];
  try {
    const env = loadEnv();
    const symbols = [...new Set(agents.map((a) => a.symbol))];
    marketContext = await fetchMarketContext(env, symbols);

    // Compute B&H from same 90-day data
    for (const symbol of symbols) {
      try {
        const bars = await fetchHistoricalBars(env, {
          symbol,
          timeframe: "1Day",
          start: daysAgo(90),
          end: today(),
        });
        if (bars.length >= 2) {
          const startPrice = bars[0].close;
          const endPrice = bars[bars.length - 1].close;
          buyAndHoldBenchmarks.push({
            symbol,
            startPrice,
            endPrice,
            returnPercent: ((endPrice - startPrice) / startPrice) * 100,
            period: "90d",
          });
        }
      } catch (err) {
        log.warn(
          `Failed to fetch B&H data for ${symbol}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    log.warn("Could not fetch market context:", err instanceof Error ? err.message : err);
  }

  // Load active overrides
  const activeOverrides = loadOverrides();

  // Generate report
  const report = generateDailyReport({
    agents,
    agentStates: savedState.agents,
    marketContext,
    activeOverrides,
    buyAndHold: buyAndHoldBenchmarks.length > 0 ? buyAndHoldBenchmarks : undefined,
    date,
  });

  const { jsonPath, mdPath } = saveReport(report);
  log.info("Report saved:");
  log.info(`  JSON: ${jsonPath}`);
  log.info(`  Markdown: ${mdPath}`);

  printLeaderboard(report);

  if (opts.reportOnly) {
    log.info("\n--report-only mode: skipping LLM review.");
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
  log.info("\n--- LLM Review ---");
  const historyDays = Number.parseInt(opts.days ?? "7", 10);
  const history = loadRecentReviews(historyDays);

  // Evaluate outcomes of past recommendations (with benchmark-relative scoring)
  if (history.length > 0 && report.leaderboard.length > 0) {
    evaluateOutcomes(history, report.leaderboard, report.marketContext);
    log.info("Evaluated outcomes of past recommendations.");
  }

  // Detect and execute auto-rollbacks
  const rollbackCandidates = detectRollbackCandidates(history);
  if (rollbackCandidates.length > 0) {
    log.info(`\nAuto-rollback candidates: ${rollbackCandidates.join(", ")}`);
    if (opts.apply) {
      for (const strategyId of rollbackCandidates) {
        if (removeOverride(strategyId)) {
          log.info(`  Rolled back "${strategyId}" to original preset.`);
        }
      }
    }
  }

  let recommendation: import("../review/types.js").LLMRecommendation | undefined;
  try {
    recommendation = await reviewWithLLM(report, history, {
      userMessageOptions: {
        rollbackCandidates: rollbackCandidates.length > 0 ? rollbackCandidates : undefined,
      },
    });
  } catch (err) {
    log.error("LLM review failed:", err instanceof Error ? err.message : err);
    return;
  }

  log.info(`\nLLM Summary: ${recommendation.summary}`);
  log.info(`Market Analysis: ${recommendation.marketAnalysis}`);
  log.info(`Actions proposed: ${recommendation.actions.length}`);

  for (const action of recommendation.actions) {
    log.info(`  - [${action.action}] ${action.reasoning}`);
  }

  // Validate actions
  const allTemplates = [...PRESET_TEMPLATES, ...loadCustomStrategies()];
  const todayReviews = loadTodayReviews();
  const { valid, rejected } = validateRecommendation(recommendation, todayReviews, allTemplates, {
    recentReviews: history,
  });

  if (rejected.length > 0) {
    log.info(`\nRejected actions (${rejected.length}):`);
    for (const r of rejected) {
      log.info(`  - [${r.action.action}] ${r.reason}`);
    }
  }

  if (valid.length === 0) {
    log.info("\nNo valid actions to apply.");
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
    log.info(`\n${valid.length} valid action(s) ready. Use --apply to apply them.`);
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
  log.info(`\n--- Applying ${valid.length} action(s) ---`);

  // Fetch backtest data for create_strategy gate
  let backtestCandles: import("trendcraft").NormalizedCandle[] | undefined;
  const createActions = valid.filter((a) => a.action === "create_strategy");
  if (createActions.length > 0) {
    try {
      const env = loadEnv();
      const symbol = "SPY";
      log.info(`Fetching 3-month backtest data for ${symbol}...`);
      backtestCandles = await fetchHistoricalBars(env, {
        symbol,
        timeframe: "1Day",
        start: monthsAgo(3),
        end: today(),
      });
    } catch (err) {
      log.warn("Could not fetch backtest data:", err instanceof Error ? err.message : err);
      log.info("New strategies will be saved without backtest gate.");
    }
  }

  const { applied, rejected: applyRejected } = await applyActions(valid, backtestCandles);

  log.info(`\nApplied: ${applied.length}`);
  for (const a of applied) {
    log.info(
      `  - [${a.action.action}] ${a.action.reasoning}${a.backtestScore !== undefined ? ` (score: ${a.backtestScore.toFixed(1)})` : ""}`,
    );
  }

  if (applyRejected.length > 0) {
    log.info(`Rejected during apply: ${applyRejected.length}`);
    for (const r of applyRejected) {
      log.info(`  - [${r.action.action}] ${r.reason}`);
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
  log.info(`\nReview record saved: ${reviewPath}`);
}

function printLeaderboard(report: DailyReport): void {
  log.info("\n--- Leaderboard ---");
  for (const entry of report.leaderboard) {
    const m = entry.metrics;
    log.info(
      `  #${entry.rank} ${entry.agentId.padEnd(30)} Score: ${entry.score.toFixed(1).padEnd(6)} Return: ${m.totalReturnPercent.toFixed(2)}%  Sharpe: ${m.sharpeRatio.toFixed(2)}`,
    );
  }
}

/**
 * Fetch market context for symbols using Alpaca API, including regime detection
 */
async function fetchMarketContext(
  env: import("../config/env.js").AlpacaEnv,
  symbols: string[],
): Promise<MarketContext[]> {
  const results: MarketContext[] = [];

  for (const symbol of symbols) {
    try {
      // Fetch 60 days for regime detection (fallback to 2-day if insufficient)
      const bars = await fetchHistoricalBars(env, {
        symbol,
        timeframe: "1Day",
        start: daysAgo(90),
        end: today(),
      });

      if (bars.length < 2) {
        if (bars.length === 1) {
          results.push({
            symbol,
            dailyChangePercent: 0,
            close: bars[0].close,
            volume: bars[0].volume,
          });
        }
        continue;
      }

      const prev = bars[bars.length - 2];
      const latest = bars[bars.length - 1];

      const ctx: MarketContext = {
        symbol,
        dailyChangePercent: ((latest.close - prev.close) / prev.close) * 100,
        close: latest.close,
        volume: latest.volume,
      };

      // Compute regime if we have enough data (30+ bars)
      if (bars.length >= 30) {
        try {
          const candles = bars.map((b) => ({
            time: b.time,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
            volume: b.volume,
          }));

          // ATR for atr14/atrPercent context
          const atrSeries = atr(candles, { period: 14 });
          if (atrSeries.length > 0) {
            const latestAtr = atrSeries[atrSeries.length - 1].value;
            if (latestAtr != null) {
              ctx.atr14 = latestAtr;
              ctx.atrPercent = (latestAtr / latest.close) * 100;
            }
          }

          // Unified regime detection via trendcraft
          const regime = detectMarketRegime(candles, { lookback: 60 });
          ctx.volatilityRegime = regime.volatility;
          ctx.trendDirection = regime.trend;
          ctx.trendStrength = regime.trendStrength;
        } catch (err) {
          log.warn(
            `Regime detection failed for ${symbol}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      results.push(ctx);
    } catch (err) {
      log.warn(
        `Failed to fetch market data for ${symbol}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return results;
}

/**
 * Execute a full review cycle — can be called from CLI or scheduler.
 *
 * Loads agent state, fetches market context, generates report, and runs LLM review.
 */
export async function executeReviewCycle(opts: {
  apply?: boolean;
  days?: string;
}): Promise<void> {
  const date = new Date().toISOString().split("T")[0];
  await liveReviewCommand({ apply: opts.apply, days: opts.days }, date);
}
