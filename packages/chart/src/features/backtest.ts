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

import type { DataLayer } from "../core/data-layer";
import { checkBacktest } from "../core/feature-validation";
import { type FeatureHost, REGISTER_FEATURE } from "../core/features";
import type { BacktestResultData, ChartInstance } from "../core/types";
import {
  renderBacktestSummary,
  renderBacktestTrades,
  renderEquityCurve,
} from "../renderer/backtest-renderer";
import { equityView, equityWarning, isPartialRun } from "../renderer/equity-view";
import { renderPatterns } from "../renderer/pattern-renderer";

/** Value range of the equity pane: the drawn part of the curve. */
function equityRange(result: BacktestResultData, dataLayer: DataLayer): [number, number] {
  const view = equityView(result, dataLayer);
  let min = result.initialCapital;
  let max = result.initialCapital;
  if (view.ok && view.points.length > 0) {
    min = Number.POSITIVE_INFINITY;
    max = Number.NEGATIVE_INFINITY;
    for (const p of view.points) {
      if (p.equity < min) min = p.equity;
      if (p.equity > max) max = p.equity;
    }
  }
  return [min * 0.99, max * 1.01];
}

/** Enable backtest and pattern display on a chart. */
export function registerBacktest(chart: ChartInstance): void {
  (chart as unknown as FeatureHost)[REGISTER_FEATURE]("backtest", {
    check: checkBacktest,
    equityRange,
    equityView,
    equityWarning,
    isPartialRun,
    renderTrades: renderBacktestTrades,
    renderEquityCurve,
    renderSummary: renderBacktestSummary,
    renderPatterns,
  });
}
