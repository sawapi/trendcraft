import type { ChartInstance } from "@trendcraft/chart";
import { useCallback, useState } from "react";
import type { StrategyJSON } from "trendcraft";
import type { StudioCandle } from "../lib/sample-data";
import { localStudioAPI, type StrategyRunResult } from "../lib/studio-api";

export type BacktestRunnerState =
  | { status: "idle"; lastError?: undefined; lastResult?: StrategyRunResult }
  | { status: "running"; lastError?: undefined; lastResult?: StrategyRunResult }
  | { status: "error"; lastError: string; lastResult?: StrategyRunResult }
  | { status: "ready"; lastError?: undefined; lastResult: StrategyRunResult };

/**
 * Runs a `StrategyJSON` through `runBacktest` and applies the result to the
 * chart. Returns a `run()` callback plus reactive state so the right pane can
 * show summary / trades / errors. The caller is responsible for clearing the
 * chart's previous trade overlay before calling `run()` for a fresh strategy.
 */
export function useBacktestRunner(
  chart: ChartInstance | null,
  candles: StudioCandle[],
): {
  state: BacktestRunnerState;
  run(json: StrategyJSON): StrategyRunResult | null;
  reset(): void;
} {
  const [state, setState] = useState<BacktestRunnerState>({ status: "idle" });

  const run = useCallback(
    (json: StrategyJSON): StrategyRunResult | null => {
      if (!chart) {
        setState({ status: "error", lastError: "Chart not ready" });
        return null;
      }
      setState({ status: "running" });
      try {
        const out = localStudioAPI.runStrategy(json, candles);
        // `addBacktest` already paints the trade markers + holding-period
        // shading from `result.trades`; calling `addTrades` on top of it
        // would double-render every overlay. The equity-curve subchart and
        // marker overlay are both produced by `addBacktest` alone.
        chart.addBacktest(out.result);
        setState({ status: "ready", lastResult: out });
        return out;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState({ status: "error", lastError: message });
        return null;
      }
    },
    [chart, candles],
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, reset };
}
