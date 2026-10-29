/**
 * Backtest display (`chart.addBacktest()`: trade markers, equity pane and
 * summary) and chart patterns (`chart.addPatterns()`).
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerBacktest } from "@trendcraft/chart/features";
 *
 * const chart = createChart(container);
 * registerBacktest(chart);
 * chart.addBacktest(result);
 * ```
 */

import { checkBacktest } from "../core/feature-validation";
import { type FeatureHost, REGISTER_FEATURE } from "../core/features";
import type { BacktestResultData, ChartInstance } from "../core/types";
import {
  renderBacktestSummary,
  renderBacktestTrades,
  renderEquityCurve,
} from "../renderer/backtest-renderer";
import { renderPatterns } from "../renderer/pattern-renderer";

/** Equity range for the equity pane, rebuilt from trade returns. */
function equityRange(result: BacktestResultData): [number, number] {
  let min = result.initialCapital;
  let max = result.initialCapital;
  let equity = result.initialCapital;
  for (const trade of result.trades) {
    equity *= 1 + trade.returnPercent / 100;
    if (equity < min) min = equity;
    if (equity > max) max = equity;
  }
  return [min * 0.99, max * 1.01];
}

/** Enable backtest and pattern display on a chart. */
export function registerBacktest(chart: ChartInstance): void {
  (chart as unknown as FeatureHost)[REGISTER_FEATURE]("backtest", {
    check: checkBacktest,
    equityRange,
    renderTrades: renderBacktestTrades,
    renderEquityCurve,
    renderSummary: renderBacktestSummary,
    renderPatterns,
  });
}
