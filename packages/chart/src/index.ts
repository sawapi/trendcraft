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
  if (typeof document === "undefined") {
    throw new Error(
      "@trendcraft/chart: createChart() requires a browser environment. " +
        "Use @trendcraft/chart/headless for server-side usage.",
    );
  }
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
  BuiltinSeriesType,
  SeriesHandle,
  SignalMarker,
  TradeMarker,
  ScaleMode,
  CrosshairMoveData,
  VisibleRangeChangeData,
  SeriesInfo,
  Drawing,
  DrawingType,
  HLineDrawing,
  TrendLineDrawing,
  FibRetracementDrawing,
  RayDrawing,
  HRayDrawing,
  VLineDrawing,
  RectangleDrawing,
  ChannelDrawing,
  FibExtensionDrawing,
  TextLabelDrawing,
  ArrowDrawing,
  TimeframeOverlay,
  ChartType,
  InfoOverlayData,
  RangeDuration,
} from "./core/types";

// i18n
export type { ChartLocale } from "./core/i18n";
export { DEFAULT_LOCALE, mergeLocale } from "./core/i18n";

export { DARK_THEME, LIGHT_THEME } from "./core/types";

// Series registry (for custom rules)
export { SeriesRegistry, type IntrospectionRule } from "./core/series-registry";

// Plugin system
export {
  defineSeriesRenderer,
  definePrimitive,
  type SeriesRendererPlugin,
  type PrimitivePlugin,
  type SeriesRenderContext,
  type PrimitiveRenderContext,
  type AnySeriesRendererPlugin,
  type AnyPrimitivePlugin,
} from "./core/plugin-types";
export { RendererRegistry } from "./core/renderer-registry";

// Drawing helper
export { DrawHelper, type StrokeStyle, type FillStyle } from "./core/draw-helper";

// Unified indicator connection
export { connectIndicators, defineIndicator } from "./integration/connect-indicators";

// Drawing auto-injection helpers — convert indicator output (fibs / trendlines / channels)
// into built-in Drawing objects without needing a dedicated primitive plugin.
export {
  addAutoFibRetracement,
  addAutoFibExtension,
  addAutoTrendLine,
  addAutoChannelLine,
  DEFAULT_FIB_RETRACEMENT_LEVELS,
  DEFAULT_FIB_EXTENSION_LEVELS,
  type SwingAnchor,
  type AddFibOptions,
  type AddTrendLineOptions,
  type AddChannelLineOptions,
} from "./integration/drawing-helpers";
export type {
  ConnectIndicatorsOptions,
  IndicatorConnection,
  IndicatorPresetEntry,
  IndicatorHandle,
  IndicatorSpec,
  AddIndicatorOptions,
  LiveSource,
} from "./integration/connect-indicators";

// Plugins — tree-shakeable visualization primitives
export { createRegimeHeatmap, connectRegimeHeatmap } from "./plugins/regime-heatmap";
export { createSmcLayer, connectSmcLayer } from "./plugins/smc-layer";
export type { SmcState, SmcZone, SmcMarker, SmcLevel } from "./plugins/smc-layer";
export { createWyckoffPhase, connectWyckoffPhase } from "./plugins/wyckoff-phase";
export { createSrConfluence, connectSrConfluence } from "./plugins/sr-confluence";
export { createTradeAnalysis, connectTradeAnalysis } from "./plugins/trade-analysis";
export { createSessionZones, connectSessionZones } from "./plugins/session-zones";
