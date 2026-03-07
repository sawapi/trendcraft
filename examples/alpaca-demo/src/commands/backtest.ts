/**
 * CLI command: backtest
 *
 * Run all strategies against historical data and output leaderboard.
 */

import { fetchHistoricalBars, monthsAgo, today } from "../alpaca/historical.js";
import { formatLeaderboard, runStrategyBacktests } from "../backtest/runner.js";
import type { ScoredResult } from "../backtest/scorer.js";
import { loadEnv } from "../config/env.js";
import { DEFAULT_SYMBOLS } from "../config/symbols.js";
import { loadCustomStrategies, loadOverrides } from "../review/applier.js";
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
  const periodMonths = Number.parseInt(opts.period ?? "6", 10);
  const capital = Number.parseInt(opts.capital ?? "100000", 10);
  const timeframe = opts.timeframe ?? "1Day";

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

  console.log(
    `\nRunning backtest tournament: ${strategies.length} strategies x ${symbols.length} symbols`,
  );
  console.log(
    `Period: ${periodMonths} months | Capital: $${capital.toLocaleString()} | Timeframe: ${timeframe}`,
  );

  const allRankings: ScoredResult[] = [];

  for (const symbol of symbols) {
    console.log(`\nFetching historical data for ${symbol}...`);

    const candles = await fetchHistoricalBars(env, {
      symbol,
      timeframe: timeframe as "1Day",
      start: monthsAgo(periodMonths),
      end: today(),
    });

    if (candles.length < 50) {
      console.warn(`  Skipping ${symbol}: only ${candles.length} candles (need 50+)`);
      continue;
    }

    console.log(`  ${candles.length} candles loaded. Running strategies...`);

    const { rankings } = runStrategyBacktests(strategies, symbol, candles, capital);

    allRankings.push(...rankings);
  }

  // Sort all results by score
  allRankings.sort((a, b) => b.score - a.score);

  console.log(formatLeaderboard(allRankings));
}
