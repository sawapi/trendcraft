/**
 * @trendcraft/chart/headless — Headless API (no DOM/Canvas dependency)
 *
 * Provides data layer, scales, layout engine, and series introspection
 * without any rendering. Useful for server-side processing, custom renderers,
 * or testing.
 */

// Core
export { DataLayer, type InternalSeries } from "./core/data-layer";
export {
  type DecimatedCandles,
  type DecimatedPoints,
  decimateCandles,
  getDecimationTarget,
  lttb,
} from "./core/decimation";
// Drawing helper
export { DrawHelper, type FillStyle, type StrokeStyle } from "./core/draw-helper";
export { canvasFont, DEFAULT_FONT_FAMILY } from "./core/font";
export {
  autoFormatPrice,
  autoFormatTime,
  detectPrecision,
  fixedPriceFormatter,
  formatCrosshairTime,
  formatVolume,
} from "./core/format";
export { DEFAULT_LAYOUT, LayoutEngine } from "./core/layout";
// Plugin types
export type {
  PrimitivePlugin,
  PrimitiveRenderContext,
  SeriesRenderContext,
  SeriesRendererPlugin,
} from "./core/plugin-types";
export { definePrimitive, defineSeriesRenderer } from "./core/plugin-types";
export { RendererRegistry } from "./core/renderer-registry";
export { PriceScale, TimeScale } from "./core/scale";
export { defaultRegistry, SeriesRegistry } from "./core/series-registry";
// Types
export type {
  BuiltinSeriesType,
  CandleData,
  ChartOptions,
  DataPoint,
  LayoutConfig,
  PaneConfig,
  PaneRect,
  ResolvedSeries,
  ScaleMode,
  SeriesConfig,
  SeriesHandle,
  SeriesType,
  SignalMarker,
  ThemeColors,
  TimeValue,
  TradeMarker,
} from "./core/types";
export { DARK_THEME, LIGHT_THEME } from "./core/types";
export { Viewport } from "./core/viewport";
export { INDICATOR_PRESETS, type IndicatorPreset } from "./integration/indicator-presets";
// Integration
export { type IntrospectionResult, introspect } from "./integration/series-introspector";

// Indicator connection (connectIndicators is DOM-dependent; use the main entry for it)
