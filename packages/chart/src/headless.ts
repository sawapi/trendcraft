/**
 * @trendcraft/chart/headless — Headless API (no DOM/Canvas dependency)
 *
 * Provides data layer, scales, layout engine, and series introspection
 * without any rendering. Useful for server-side processing, custom renderers,
 * or testing.
 */

// Core
export { DataLayer } from "./core/data-layer";
export { lttb, decimateCandles, getDecimationTarget } from "./core/decimation";
export {
  autoFormatPrice,
  autoFormatTime,
  formatCrosshairTime,
  formatVolume,
  detectPrecision,
  fixedPriceFormatter,
} from "./core/format";
export { TimeScale, PriceScale } from "./core/scale";
export { LayoutEngine, DEFAULT_LAYOUT } from "./core/layout";
export { SeriesRegistry, defaultRegistry } from "./core/series-registry";
export { Viewport } from "./core/viewport";

// Integration
export { introspect, type IntrospectionResult } from "./integration/series-introspector";
export { INDICATOR_PRESETS, type IndicatorPreset } from "./integration/indicator-presets";

// Types
export type {
  ChartOptions,
  CandleData,
  DataPoint,
  TimeValue,
  ThemeColors,
  PaneConfig,
  PaneRect,
  LayoutConfig,
  SeriesConfig,
  SeriesType,
  SeriesHandle,
  SignalMarker,
  TradeMarker,
  ScaleMode,
  ResolvedSeries,
} from "./core/types";

export { DARK_THEME, LIGHT_THEME } from "./core/types";
