/**
 * `@trendcraft/chart/features` — optional chart features.
 *
 * Each register function attaches one feature to a chart. Import only the
 * ones you use and the rest stay out of your bundle; `registerAll` attaches
 * every feature.
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerAll } from "@trendcraft/chart/features";
 *
 * const chart = createChart(container);
 * registerAll(chart);
 * ```
 */

import type { ChartInstance } from "../core/types";
import { registerBacktest } from "./backtest";
import { registerDrawingTools } from "./drawing";
import { registerMarkers } from "./markers";
import { registerScores } from "./scores";

export { registerBacktest, registerDrawingTools, registerMarkers, registerScores };

/** A feature register function, as passed to the React/Vue `features` prop. */
export type ChartFeatureRegistrar = (chart: ChartInstance) => void;

/** Attach every optional feature to a chart. */
export function registerAll(chart: ChartInstance): void {
  registerDrawingTools(chart);
  registerBacktest(chart);
  registerMarkers(chart);
  registerScores(chart);
}
