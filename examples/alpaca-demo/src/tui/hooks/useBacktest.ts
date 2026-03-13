/**
 * useBacktest — run backtest from TUI
 */

import { useCallback, useState } from "react";
import { fetchHistoricalBars, monthsAgo, today } from "../../alpaca/historical.js";
import { runStrategyBacktests } from "../../backtest/runner.js";
import type { ScoredResult } from "../../backtest/scorer.js";
import { loadEnv } from "../../config/env.js";
import { getAllStrategies } from "../../strategy/registry.js";

export type BacktestState = {
  results: ScoredResult[];
  isRunning: boolean;
  error: string | null;
  symbol: string | null;
};

export function useBacktest(): [
  BacktestState,
  { run: (symbol: string, periodMonths?: number) => Promise<void> },
] {
  const [state, setState] = useState<BacktestState>({
    results: [],
    isRunning: false,
    error: null,
    symbol: null,
  });

  const run = useCallback(async (symbol: string, periodMonths = 3) => {
    setState({ results: [], isRunning: true, error: null, symbol });

    try {
      const env = loadEnv();
      const candles = await fetchHistoricalBars(env, {
        symbol,
        timeframe: "1Day",
        start: monthsAgo(periodMonths),
        end: today(),
      });

      if (candles.length < 50) {
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: `Insufficient data: only ${candles.length} candles`,
        }));
        return;
      }

      const strategies = getAllStrategies();
      const { rankings } = runStrategyBacktests(strategies, symbol, candles, 100000);
      rankings.sort((a, b) => b.score - a.score);

      setState({ results: rankings, isRunning: false, error: null, symbol });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  return [state, { run }];
}
