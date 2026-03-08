/**
 * Backtest runner — executes all strategies against historical data
 *
 * Includes Walk-Forward validation and Monte Carlo simulation support.
 */

import {
  type BacktestResult,
  type MonteCarloResult,
  type NormalizedCandle,
  type StrategyDefinition,
  type WalkForwardResult,
  runBacktest,
  runMonteCarloSimulationSafe,
  walkForwardAnalysisSafe,
} from "trendcraft";
import { type ScoreWeights, type ScoredResult, scoreResult } from "./scorer.js";

export type BacktestRunResult = {
  rankings: ScoredResult[];
  results: Map<string, BacktestResult>;
};

/**
 * Run all strategies against historical data for a single symbol
 */
export function runStrategyBacktests(
  strategies: StrategyDefinition[],
  symbol: string,
  candles: NormalizedCandle[],
  capital: number,
  weights?: ScoreWeights,
): BacktestRunResult {
  const results = new Map<string, BacktestResult>();
  const rankings: ScoredResult[] = [];

  for (const strategy of strategies) {
    if (!strategy.backtestEntry || !strategy.backtestExit) continue;

    const result = runBacktest(candles, strategy.backtestEntry, strategy.backtestExit, {
      ...strategy.backtestOptions,
      capital,
    });

    const key = `${strategy.id}:${symbol}`;
    results.set(key, result);

    const scored = scoreResult(strategy.id, symbol, result, weights);
    rankings.push(scored);
  }

  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);

  return { rankings, results };
}

/**
 * Walk-Forward validation result
 */
export type WalkForwardValidation = {
  passed: boolean;
  efficiency: number;
  avgOosSharpe: number;
  reason: string;
  result?: WalkForwardResult;
};

/**
 * Run Walk-Forward validation for a strategy
 *
 * Uses trendcraft's walkForwardAnalysis to check if strategy parameters
 * are robust to out-of-sample testing.
 *
 * Pass criteria: OOS avg Sharpe > 0 AND WFA stability ratio > 0.5
 */
export function runWalkForwardValidation(
  strategy: StrategyDefinition,
  candles: NormalizedCandle[],
  capital: number,
): WalkForwardValidation {
  if (!strategy.backtestEntry || !strategy.backtestExit) {
    return {
      passed: true,
      efficiency: 0,
      avgOosSharpe: 0,
      reason: "No backtest conditions defined, skipping",
    };
  }

  const {
    backtestEntry: entryCondition,
    backtestExit: exitCondition,
    backtestOptions: options,
  } = strategy;

  // Need enough data for walk-forward windows
  if (candles.length < 500) {
    return {
      passed: true,
      efficiency: 0,
      avgOosSharpe: 0,
      reason: "Insufficient data for WFA (< 500 candles), skipping",
    };
  }

  const createStrategy = () => ({
    entry: entryCondition,
    exit: exitCondition,
    options: { ...options, capital },
  });

  const wfaResult = walkForwardAnalysisSafe(
    candles,
    createStrategy,
    [], // No parameter ranges — validate current params
    {
      windowSize: Math.min(252, Math.floor(candles.length * 0.4)),
      stepSize: Math.min(63, Math.floor(candles.length * 0.1)),
      testSize: Math.min(63, Math.floor(candles.length * 0.1)),
      metric: "sharpe",
    },
  );

  if (!wfaResult.ok) {
    return {
      passed: true,
      efficiency: 0,
      avgOosSharpe: 0,
      reason: `WFA error: ${wfaResult.error}, skipping`,
    };
  }

  const result = wfaResult.value;
  const avgOosSharpe = result.aggregateMetrics.avgOutOfSample.sharpe ?? 0;
  const efficiency = result.aggregateMetrics.stabilityRatio;

  const passed = avgOosSharpe > 0 && efficiency > 0.5;

  return {
    passed,
    efficiency,
    avgOosSharpe,
    reason: passed
      ? `WFA passed: OOS Sharpe=${avgOosSharpe.toFixed(2)}, efficiency=${efficiency.toFixed(2)}`
      : `WFA failed: OOS Sharpe=${avgOosSharpe.toFixed(2)}, efficiency=${efficiency.toFixed(2)}`,
    result,
  };
}

/**
 * Monte Carlo simulation result summary
 */
export type MonteCarloSummary = {
  isSignificant: boolean;
  pReturnPositive: number;
  percentile5Return: number;
  percentile95Drawdown: number;
  result?: MonteCarloResult;
};

/**
 * Run Monte Carlo simulation on a backtest result
 */
export function runMonteCarloValidation(
  backtestResult: BacktestResult,
  simulations = 500,
): MonteCarloSummary {
  if (backtestResult.tradeCount < 5) {
    return {
      isSignificant: false,
      pReturnPositive: 0,
      percentile5Return: 0,
      percentile95Drawdown: 0,
    };
  }

  const mcResult = runMonteCarloSimulationSafe(backtestResult, {
    simulations,
    confidenceLevel: 0.95,
  });

  if (!mcResult.ok) {
    return {
      isSignificant: false,
      pReturnPositive: 0,
      percentile5Return: 0,
      percentile95Drawdown: 0,
    };
  }

  const mc = mcResult.value;

  return {
    isSignificant: mc.assessment.isSignificant,
    pReturnPositive: 1 - mc.pValue.returns,
    percentile5Return: mc.statistics.totalReturnPercent.percentile5,
    percentile95Drawdown: mc.statistics.maxDrawdown.percentile95,
    result: mc,
  };
}

/**
 * Format leaderboard for console output
 */
export function formatLeaderboard(rankings: ScoredResult[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push("=".repeat(100));
  lines.push("  BACKTEST LEADERBOARD");
  lines.push("=".repeat(100));
  lines.push(
    `  ${"Rank".padEnd(6)}${"Strategy".padEnd(25)}${"Symbol".padEnd(8)}` +
      `${"Score".padEnd(8)}${"Return%".padEnd(10)}${"WinRate".padEnd(10)}` +
      `${"Sharpe".padEnd(9)}${"MaxDD".padEnd(9)}${"PF".padEnd(8)}${"Trades".padEnd(8)}`,
  );
  lines.push("-".repeat(100));

  rankings.forEach((r, i) => {
    const rank = `#${i + 1}`.padEnd(6);
    const strategy = r.strategyId.padEnd(25);
    const symbol = r.symbol.padEnd(8);
    const score = r.score.toFixed(1).padEnd(8);
    const ret = `${r.result.totalReturnPercent.toFixed(2)}%`.padEnd(10);
    const wr = `${r.result.winRate.toFixed(1)}%`.padEnd(10);
    const sharpe = r.result.sharpeRatio.toFixed(2).padEnd(9);
    const dd = `${r.result.maxDrawdown.toFixed(1)}%`.padEnd(9);
    const pf =
      r.result.profitFactor === Number.POSITIVE_INFINITY
        ? "Inf".padEnd(8)
        : r.result.profitFactor.toFixed(2).padEnd(8);
    const trades = String(r.result.tradeCount).padEnd(8);

    lines.push(`  ${rank}${strategy}${symbol}${score}${ret}${wr}${sharpe}${dd}${pf}${trades}`);
  });

  lines.push("=".repeat(100));
  lines.push("");

  return lines.join("\n");
}
