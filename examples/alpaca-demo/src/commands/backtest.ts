/**
 * CLI command: backtest
 *
 * Run all strategies against historical data and output leaderboard.
 * Strategies are grouped by their preferred backtest timeframe/period,
 * so intraday strategies use minute bars while swing strategies use daily bars.
 */

import type { NormalizedCandle } from "trendcraft";
import { type AlpacaTimeframe, daysAgo, fetchHistoricalBars, today } from "../alpaca/historical.js";
import {
  formatLeaderboard,
  formatPortfolioSummary,
  runPortfolioSummary,
  runStrategyBacktests,
} from "../backtest/runner.js";
import type { ScoredResult } from "../backtest/scorer.js";
import { loadEnv } from "../config/env.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import { loadCustomStrategies, loadOverrides } from "../review/applier.js";
import { type BacktestDataConfig, groupStrategiesByConfig } from "../strategy/backtest-config.js";
import {
  applyStrategyOverrides,
  getAllStrategies,
  loadCustomStrategiesFromTemplates,
} from "../strategy/registry.js";

export type BacktestCommandOptions = {
  symbols?: string;
  period?: string;
  capital?: string;
  timeframe?: string;
};

export async function backtestCommand(opts: BacktestCommandOptions): Promise<void> {
  const env = loadEnv();
  const symbols = opts.symbols
    ? opts.symbols.split(",").map((s) => s.trim().toUpperCase())
    : DEFAULT_SYMBOLS;
  const capital = Number.parseInt(opts.capital ?? "100000", 10);

  // Build override config if CLI flags provided
  const overrideConfig: BacktestDataConfig | undefined =
    opts.timeframe || opts.period
      ? {
          timeframe: (opts.timeframe as AlpacaTimeframe) ?? "1Day",
          periodDays: opts.period ? Number.parseInt(opts.period, 10) : 180,
        }
      : undefined;

  // Load strategy overrides and custom strategies
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
  const groups = groupStrategiesByConfig(strategies, overrideConfig);

  console.log(
    `\nRunning backtest tournament: ${strategies.length} strategies x ${symbols.length} symbols`,
  );
  if (overrideConfig) {
    console.log(
      `Override: ${overrideConfig.timeframe} / ${overrideConfig.periodDays} days | Capital: $${capital.toLocaleString()}`,
    );
  } else {
    console.log(`${groups.length} timeframe group(s) | Capital: $${capital.toLocaleString()}`);
  }

  const allRankings: ScoredResult[] = [];

  // Cache fetched bars by "symbol:timeframe:periodDays" to avoid duplicate fetches
  const barsCache = new Map<string, NormalizedCandle[]>();

  for (const group of groups) {
    const { config, strategies: groupStrategies } = group;

    console.log(
      `\n${"─".repeat(80)}\n  Group: ${config.timeframe} / ${config.periodDays} days (${groupStrategies.length} strategies)`,
    );
    console.log(`  Strategies: ${groupStrategies.map((s) => s.id).join(", ")}`);
    console.log("─".repeat(80));

    const groupSymbolCandles = new Map<string, NormalizedCandle[]>();

    for (const symbol of symbols) {
      const cacheKey = `${symbol}:${config.timeframe}:${config.periodDays}`;
      let candles = barsCache.get(cacheKey);

      if (!candles) {
        console.log(
          `\n  Fetching ${config.timeframe} data for ${symbol} (${config.periodDays} days)...`,
        );

        candles = await fetchHistoricalBars(env, {
          symbol,
          timeframe: config.timeframe,
          start: daysAgo(config.periodDays),
          end: today(),
        });
        barsCache.set(cacheKey, candles);
      }

      if (candles.length < 50) {
        console.warn(`  Skipping ${symbol}: only ${candles.length} candles (need 50+)`);
        continue;
      }

      console.log(
        `  ${symbol}: ${candles.length} candles. Running ${groupStrategies.length} strategies...`,
      );
      groupSymbolCandles.set(symbol, candles);

      const { rankings } = runStrategyBacktests(groupStrategies, symbol, candles, capital);
      allRankings.push(...rankings);
    }

    // Portfolio summary within this group (if multiple symbols)
    if (groupSymbolCandles.size >= 2) {
      const seen = new Set<string>();
      const topStrategyIds: string[] = [];
      const groupRankings = allRankings
        .filter((r) => groupStrategies.some((s) => s.id === r.strategyId))
        .sort((a, b) => b.score - a.score);

      for (const r of groupRankings) {
        if (!seen.has(r.strategyId)) {
          seen.add(r.strategyId);
          topStrategyIds.push(r.strategyId);
          if (topStrategyIds.length >= 3) break;
        }
      }

      if (topStrategyIds.length > 0) {
        console.log(`\n  ${"=".repeat(76)}`);
        console.log(`  PORTFOLIO SUMMARY (${config.timeframe} / ${config.periodDays}d group)`);
        console.log(`  ${"=".repeat(76)}`);

        for (const strategyId of topStrategyIds) {
          const strategy = groupStrategies.find((s) => s.id === strategyId);
          if (!strategy) continue;

          const result = runPortfolioSummary(strategy, groupSymbolCandles, capital);
          if (result) {
            console.log(formatPortfolioSummary(strategyId, result));
          }
        }
      }
    }
  }

  // Overall leaderboard
  allRankings.sort((a, b) => b.score - a.score);
  console.log(formatLeaderboard(allRankings));
}
