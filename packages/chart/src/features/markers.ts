/**
 * Signal and trade markers (`chart.addSignals()`, `chart.addTrades()`).
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerMarkers } from "@trendcraft/chart/features";
 *
 * const chart = createChart(container);
 * registerMarkers(chart);
 * chart.addSignals([{ time: Date.UTC(2024, 0, 2), type: "buy" }]);
 * ```
 */

import { checkSignals, checkTrades } from "../core/feature-validation";
import { type FeatureHost, REGISTER_FEATURE } from "../core/features";
import type { ChartInstance } from "../core/types";
import { renderSignals, renderTrades } from "../renderer/marker-renderer";

/** Enable signal and trade markers on a chart. */
export function registerMarkers(chart: ChartInstance): void {
  (chart as unknown as FeatureHost)[REGISTER_FEATURE]("markers", {
    checkSignals,
    checkTrades,
    renderSignals,
    renderTrades,
  });
}
