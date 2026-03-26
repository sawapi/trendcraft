/**
 * Plugin system types for @trendcraft/chart.
 *
 * Two plugin types:
 * - SeriesRendererPlugin: Custom series renderer (data-driven)
 * - PrimitivePlugin: Pane-level overlay/annotation
 *
 * @example
 * ```typescript
 * import { defineSeriesRenderer, definePrimitive } from '@trendcraft/chart';
 *
 * const myRenderer = defineSeriesRenderer({
 *   type: 'renko',
 *   render: ({ ctx, series, timeScale, priceScale }) => { ... },
 * });
 *
 * const myPrimitive = definePrimitive({
 *   name: 'srZones',
 *   pane: 'main',
 *   zOrder: 'below',
 *   defaultState: { zones: [] },
 *   render: ({ ctx, priceScale }, state) => { ... },
 * });
 * ```
 */

import type { DataLayer, InternalSeries } from "./data-layer";
import type { PriceScale, TimeScale } from "./scale";
import type { PaneRect, ThemeColors } from "./types";

/** Context passed to custom series renderers */
export type SeriesRenderContext = {
  ctx: CanvasRenderingContext2D;
  series: InternalSeries;
  timeScale: TimeScale;
  priceScale: PriceScale;
  dataLayer: DataLayer;
  paneWidth: number;
  theme: ThemeColors;
};

/** Context passed to primitive renderers */
export type PrimitiveRenderContext = {
  ctx: CanvasRenderingContext2D;
  pane: PaneRect;
  timeScale: TimeScale;
  priceScale: PriceScale;
  dataLayer: DataLayer;
  theme: ThemeColors;
};

/** Custom series renderer plugin */
export type SeriesRendererPlugin<TConfig = unknown> = {
  /** Unique type name (must not collide with built-in types) */
  readonly type: string;
  /** Render the series onto the canvas */
  render: (context: SeriesRenderContext, config: TConfig) => void;
  /** Compute price range for auto-scaling (optional, falls back to channel decomposition) */
  priceRange?: (series: InternalSeries, startIndex: number, endIndex: number) => [number, number];
  /** Format tooltip value at a given index (optional, falls back to decompose) */
  formatValue?: (series: InternalSeries, index: number) => string | null;
  /** Called once when plugin is registered (optional) */
  init?: () => void;
  /** Called on chart.destroy() (optional) */
  destroy?: () => void;
};

/** Pane primitive plugin */
export type PrimitivePlugin<TState = unknown> = {
  /** Unique name */
  readonly name: string;
  /** Target pane: 'main', a pane id, or 'all' for every pane */
  pane: string;
  /** Render order relative to series: 'below' (before series) or 'above' (after) */
  zOrder: "below" | "above";
  /** Render the primitive */
  render: (context: PrimitiveRenderContext, state: TState) => void;
  /** Update state (called before each render frame, optional) */
  update?: (state: TState) => TState;
  /** Initial state */
  defaultState: TState;
  /** Called on chart.destroy() (optional) */
  destroy?: () => void;
};

/**
 * Type-safe helper to define a custom series renderer plugin.
 * Mirrors trendcraft core's `defineIndicator()` pattern.
 */
export function defineSeriesRenderer<TConfig = unknown>(
  plugin: SeriesRendererPlugin<TConfig>,
): SeriesRendererPlugin<TConfig> {
  return plugin;
}

/**
 * Type-safe helper to define a pane primitive plugin.
 * Mirrors trendcraft core's `defineIndicator()` pattern.
 */
export function definePrimitive<TState = unknown>(
  plugin: PrimitivePlugin<TState>,
): PrimitivePlugin<TState> {
  return plugin;
}
