/**
 * Range Calculator — Computes min/max price ranges for pane auto-scaling.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { InternalSeries } from "../core/data-layer";
import type { RendererRegistry } from "../core/renderer-registry";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, DataPoint, PaneRect } from "../core/types";
import { bandPriceRange } from "../series/band";
import { candlePriceRange } from "../series/candlestick";
import { cloudPriceRange } from "../series/cloud";
import { volumeRange } from "../series/histogram";
import { channelPriceRange, linePriceRange } from "../series/line";

/**
 * Compute the price range for a pane based on candles and assigned series.
 */
export function computePaneRange(
  pane: PaneRect,
  start: number,
  end: number,
  candles: readonly CandleData[],
  paneSeries: InternalSeries[],
  rendererRegistry?: RendererRegistry,
  scaleId?: "left" | "right",
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  // Include candle price range only for main pane's right scale (or unspecified)
  if (pane.id === "main" && scaleId !== "left") {
    const [cMin, cMax] = candlePriceRange(candles, start, end);
    if (cMin < min) min = cMin;
    if (cMax > max) max = cMax;
  }

  if (pane.id === "volume") {
    const [vMin, vMax] = volumeRange(candles, start, end);
    return [vMin, vMax];
  }

  for (const s of paneSeries) {
    const [sMin, sMax] = computeSeriesRange(s, start, end, rendererRegistry);
    if (sMin < min) min = sMin;
    if (sMax > max) max = sMax;
  }

  return min <= max ? [min, max] : [0, 100];
}

/**
 * Compute the price range for a single series.
 */
export function computeSeriesRange(
  s: InternalSeries,
  start: number,
  end: number,
  rendererRegistry?: RendererRegistry,
): [number, number] {
  // Check custom renderer for priceRange
  if (rendererRegistry) {
    const custom = rendererRegistry.getRenderer(s.type);
    if (custom?.priceRange) {
      return custom.priceRange(s, start, end);
    }
  }

  const rule = defaultRegistry.detect(s.data);
  if (!rule) return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  if (rule.name === "number") {
    return linePriceRange(s.data as DataPoint<number | null>[], start, end);
  }

  if (rule.name === "band") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const upper = channels.get("upper") ?? [];
    const lower = channels.get("lower") ?? [];
    return bandPriceRange(upper, lower, start, end);
  }

  if (rule.name === "ichimoku") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    return cloudPriceRange(channels, start, end);
  }

  // FVG/Order Block zones are within candle price range — don't affect Y-axis scaling
  if (rule.name === "fairValueGap" || rule.name === "orderBlock") {
    return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  }

  // Supertrend: only use upperBand/lowerBand for range (exclude trend direction channel)
  if (rule.name === "supertrend") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const upper = channels.get("upperBand") ?? [];
    const lower = channels.get("lowerBand") ?? [];
    return bandPriceRange(upper, lower, start, end);
  }

  // Generic: decompose and find range across all channels
  const channels = defaultRegistry.decomposeAll(s.data, rule);
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const [, vals] of channels) {
    const [cMin, cMax] = channelPriceRange(vals, start, end);
    if (cMin < min) min = cMin;
    if (cMax > max) max = cMax;
  }
  return [min, max];
}
