/**
 * useBacktest — run backtest from TUI (multi-symbol support)
 */

import { useCallback, useState } from "react";
import { fetchHistoricalBars, monthsAgo, today } from "../../alpaca/historical.js";
import { runStrategyBacktests } from "../../backtest/runner.js";
import type { ScoredResult } from "../../backtest/scorer.js";
import { loadEnv } from "../../config/env.js";
import { getAllStrategies } from "../../strategy/registry.js";

export type BacktestResult = ScoredResult & {
  symbol: string;
};

export type BacktestState = {
  results: BacktestResult[];
  isRunning: boolean;
  error: string | null;
  progress: string | null;
};

export function useBacktest(): [
  BacktestState,
  { run: (symbols: string[], periodMonths?: number) => Promise<void> },
] {
  const [state, setState] = useState<BacktestState>({
    results: [],
    isRunning: false,
    error: null,
    progress: null,
  });

  const run = useCallback(async (symbols: string[], periodMonths = 3) => {
    setState({ results: [], isRunning: true, error: null, progress: null });

    try {
      const env = loadEnv();
      const strategies = getAllStrategies();
      const allResults: BacktestResult[] = [];

      for (let i = 0; i < symbols.length; i++) {
        const symbol = symbols[i];
        setState((prev) => ({
          ...prev,
          progress: `Running ${symbol} (${i + 1}/${symbols.length})...`,
        }));

        const candles = await fetchHistoricalBars(env, {
          symbol,
          timeframe: "1Day",
          start: monthsAgo(periodMonths),
          end: today(),
        });

        if (candles.length < 50) {
          continue; // Skip symbols with insufficient data
        }

        const { rankings } = runStrategyBacktests(strategies, symbol, candles, 100000);
        for (const r of rankings) {
          allResults.push({ ...r, symbol });
        }
      }

      allResults.sort((a, b) => b.score - a.score);
      setState({ results: allResults, isRunning: false, error: null, progress: null });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : String(err),
        progress: null,
      }));
    }
  }, []);

  return [state, { run }];
}
