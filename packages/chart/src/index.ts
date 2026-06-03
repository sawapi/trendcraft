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

// Drawing helper
export { DrawHelper, type FillStyle, type StrokeStyle } from "./core/draw-helper";

export { DEFAULT_HOTKEYS, type HotkeyMap } from "./core/hotkeys";

// i18n
export type { ChartLocale } from "./core/i18n";
export { DEFAULT_LOCALE, mergeLocale } from "./core/i18n";
// Plugin system
export {
  type AnyPrimitivePlugin,
  type AnySeriesRendererPlugin,
  definePrimitive,
  defineSeriesRenderer,
  type PrimitivePlugin,
  type PrimitiveRenderContext,
  type SeriesRenderContext,
  type SeriesRendererPlugin,
} from "./core/plugin-types";
export { RendererRegistry } from "./core/renderer-registry";
// Series registry (for custom rules)
export { type IntrospectionRule, SeriesRegistry } from "./core/series-registry";
// Core types
export type {
  ArrowDrawing,
  BuiltinSeriesType,
  CandleData,
  ChannelDrawing,
  ChartErrorCode,
  ChartErrorPayload,
  ChartEvent,
  ChartInstance,
  ChartOptions,
  ChartType,
  CrosshairMode,
  CrosshairMoveData,
  CrosshairOptions,
  DataPoint,
  Drawing,
  DrawingType,
  FibExtensionDrawing,
  FibRetracementDrawing,
  HLineDrawing,
  HotkeyAction,
  HRayDrawing,
  InfoOverlayData,
  InteractionOptions,
  LayoutConfig,
  PaneConfig,
  RangeDuration,
  RayDrawing,
  RectangleDrawing,
  ScaleMode,
  SeriesConfig,
  SeriesHandle,
  SeriesInfo,
  SeriesType,
  SessionGapsOptions,
  SignalMarker,
  TextLabelDrawing,
  ThemeColors,
  TimeframeOverlay,
  TimeScaleOptions,
  TimeValue,
  TradeMarker,
  TrendLineDrawing,
  VisibleRangeChangeData,
  VLineDrawing,
} from "./core/types";
export { DARK_THEME, LIGHT_THEME } from "./core/types";
export type {
  AddIndicatorOptions,
  ConnectIndicatorsOptions,
  IndicatorConnection,
  IndicatorHandle,
  IndicatorPresetEntry,
  IndicatorSpec,
  LiveSource,
} from "./integration/connect-indicators";
// Unified indicator connection
export { connectIndicators, defineIndicator } from "./integration/connect-indicators";
export type {
  LivePrimitiveHandle,
  LivePrimitiveSpec,
  LivePrimitivesConnection,
} from "./integration/connect-live-primitives";
// Live mode for primitive plugins (S/R Zones, SMC, Wyckoff, Kill Zones, Regime
// Heatmap, etc.) — recompute on candleComplete and push to handle.update().
export { connectLivePrimitives } from "./integration/connect-live-primitives";
// Drawing auto-injection helpers — convert indicator output (fibs / trendlines / channels)
// into built-in Drawing objects without needing a dedicated primitive plugin.
export {
  type AddChannelLineOptions,
  type AddFibOptions,
  type AddTrendLineOptions,
  addAutoChannelLine,
  addAutoFibExtension,
  addAutoFibRetracement,
  addAutoTrendLine,
  DEFAULT_FIB_EXTENSION_LEVELS,
  DEFAULT_FIB_RETRACEMENT_LEVELS,
  type SwingAnchor,
} from "./integration/drawing-helpers";
export {
  type AndrewsPitchforkOptions,
  type AndrewsPitchforkState,
  connectAndrewsPitchfork,
  createAndrewsPitchfork,
  type PitchforkAnchor,
  type PitchforkAnchors,
} from "./plugins/andrews-pitchfork";
export {
  connectMarketProfile,
  createMarketProfile,
  type MarketProfileOptions,
  type MarketProfileSeries,
  type MarketProfileValue,
} from "./plugins/market-profile";
// Plugins — tree-shakeable visualization primitives
export {
  connectPricePatterns,
  createPricePatterns,
  filterPricePatterns,
  type PricePatternSignal,
  type PricePatternsOptions,
} from "./plugins/price-patterns";
export {
  connectRegimeHeatmap,
  createRegimeHeatmap,
  type RegimeHeatmapOptions,
} from "./plugins/regime-heatmap";
export { connectSessionZones, createSessionZones } from "./plugins/session-zones";
export type { SmcLevel, SmcMarker, SmcState, SmcZone } from "./plugins/smc-layer";
export { connectSmcLayer, createSmcLayer } from "./plugins/smc-layer";
export {
  connectSqueezeDots,
  createSqueezeDots,
  type SqueezeDotsOptions,
} from "./plugins/squeeze-dots";
export { connectSrConfluence, createSrConfluence } from "./plugins/sr-confluence";
export {
  connectTradeAnalysis,
  createTradeAnalysis,
  type TradeAnalysisOptions,
} from "./plugins/trade-analysis";
export {
  connectVolumeProfile,
  createVolumeProfile,
  type VolumeProfileData,
  type VolumeProfileLevel,
  type VolumeProfileState,
} from "./plugins/volume-profile";
export { connectWyckoffPhase, createWyckoffPhase } from "./plugins/wyckoff-phase";
