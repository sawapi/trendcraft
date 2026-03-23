/**
 * @trendcraft/chart — Finance-specialized charting library
 *
 * @example
 * ```typescript
 * import { createChart } from '@trendcraft/chart';
 * import { sma, rsi, bollingerBands } from 'trendcraft';
 *
 * const chart = createChart(document.getElementById('chart'), { theme: 'dark' });
 * chart.setCandles(candles);
 * chart.addIndicator(sma(candles, { period: 20 }));
 * chart.addIndicator(bollingerBands(candles));
 * chart.addIndicator(rsi(candles), { pane: 'new' });
 * ```
 */

import type { ChartInstance, ChartOptions } from "./core/types";
import { CanvasChart } from "./renderer/canvas-chart";

// ---- Main Entry Point ----

/**
 * Create a new chart instance attached to a DOM container.
 *
 * @param container - The HTML element to render the chart into
 * @param options - Chart configuration options
 * @returns A ChartInstance for manipulating the chart
 *
 * @example
 * ```typescript
 * const chart = createChart(document.getElementById('chart'), {
 *   width: 800,
 *   height: 600,
 *   theme: 'dark',
 * });
 * ```
 */
export function createChart(container: HTMLElement, options?: ChartOptions): ChartInstance {
  return new CanvasChart(container, options);
}

// ---- Re-exports ----

// Core types
export type {
  ChartInstance,
  ChartOptions,
  ChartEvent,
  CandleData,
  DataPoint,
  TimeValue,
  ThemeColors,
  PaneConfig,
  LayoutConfig,
  SeriesConfig,
  SeriesType,
  SeriesHandle,
  SignalMarker,
  TradeMarker,
  ScaleMode,
  CrosshairMoveData,
  VisibleRangeChangeData,
} from "./core/types";

export { DARK_THEME, LIGHT_THEME } from "./core/types";

// Series registry (for custom rules)
export { SeriesRegistry, type IntrospectionRule } from "./core/series-registry";
