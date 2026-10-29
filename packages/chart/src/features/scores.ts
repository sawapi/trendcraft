/**
 * Score heatmap behind the candles (`chart.addScores()`).
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerScores } from "@trendcraft/chart/features";
 *
 * const chart = createChart(container);
 * registerScores(chart);
 * chart.addScores(scoreSeries);
 * ```
 */

import { type FeatureHost, REGISTER_FEATURE } from "../core/features";
import type { ChartInstance } from "../core/types";
import { renderScoreHeatmap } from "../renderer/score-renderer";

/** Enable the score heatmap on a chart. */
export function registerScores(chart: ChartInstance): void {
  (chart as unknown as FeatureHost)[REGISTER_FEATURE]("scores", {
    renderHeatmap: renderScoreHeatmap,
  });
}
