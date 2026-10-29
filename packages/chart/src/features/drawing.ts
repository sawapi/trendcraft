/**
 * Drawing tools: interactive placement (also the drawing hotkeys, Alt+H /
 * Alt+V / Alt+T / Alt+F / Alt+C by default) and rendering of
 * `chart.addDrawing()` objects.
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerDrawingTools } from "@trendcraft/chart/features";
 *
 * const chart = createChart(container);
 * registerDrawingTools(chart);
 * chart.setDrawingTool("trendline");
 * ```
 */

import { type FeatureHost, REGISTER_FEATURE } from "../core/features";
import type { ChartInstance } from "../core/types";
import { renderDrawings } from "../renderer/drawing-renderer";
import { DrawingTool } from "../renderer/drawing-tool";

/** Enable drawing tools and drawing rendering on a chart. */
export function registerDrawingTools(chart: ChartInstance): void {
  (chart as unknown as FeatureHost)[REGISTER_FEATURE]("drawing", {
    render: renderDrawings,
    createTool: (deps) => new DrawingTool(deps),
  });
}
