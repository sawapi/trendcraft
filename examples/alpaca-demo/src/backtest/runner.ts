/**
 * Backtest runner — executes all strategies against historical data
 */

import { runBacktest, type BacktestResult, type NormalizedCandle } from "trendcraft";
import type { StrategyDefinition } from "../strategy/types.js";
import { scoreResult, type ScoredResult, type ScoreWeights } from "./scorer.js";

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
    const { entryCondition, exitCondition, options } = strategy.backtestAdapter;

    const result = runBacktest(candles, entryCondition, exitCondition, {
      ...options,
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
 * Format leaderboard for console output
 */
export function formatLeaderboard(rankings: ScoredResult[]): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    "=".repeat(100),
  );
  lines.push("  BACKTEST LEADERBOARD");
  lines.push(
    "=".repeat(100),
  );
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
      r.result.profitFactor === Infinity
        ? "Inf".padEnd(8)
        : r.result.profitFactor.toFixed(2).padEnd(8);
    const trades = String(r.result.tradeCount).padEnd(8);

    lines.push(`  ${rank}${strategy}${symbol}${score}${ret}${wr}${sharpe}${dd}${pf}${trades}`);
  });

  lines.push("=".repeat(100));
  lines.push("");

  return lines.join("\n");
}
