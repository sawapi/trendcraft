/**
 * Range Calculator — Computes min/max price ranges for pane auto-scaling.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { InternalSeries } from "../core/data-layer";
import type { RendererRegistry } from "../core/renderer-registry";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, DataPoint, PaneRect } from "../core/types";
import { emptyRange, type MinMax, reduceRange } from "../core/value-range";
import { bandPriceRange } from "../series/band";
import { candlePriceRange } from "../series/candlestick";
import { cloudPriceRange } from "../series/cloud";
import { volumeRange } from "../series/histogram";
import { linePriceRange } from "../series/line";
import { getCachedChannels } from "./series-dispatcher";

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
    // Merge only finite bounds: a custom renderer's priceRange is caller code,
    // and one series reporting Infinity must not drag the whole pane's range
    // (on the main pane, the candles' scale with it).
    if (Number.isFinite(sMin) && sMin < min) min = sMin;
    if (Number.isFinite(sMax) && sMax > max) max = sMax;
  }

  if (min > max) return [0, 100];

  // A reference line is there to be read against the data, so the range
  // keeps it in view (Mass Index's 27 and 26.5 sat above its values). A
  // log scale cannot show zero or below, so such a line is left out there.
  const left = scaleId === "left";
  const lines = left ? pane.config?.leftScale?.referenceLines : pane.config?.referenceLines;
  const log = (left ? pane.config?.leftScale?.mode : pane.config?.yScale) === "log";
  for (const v of lines ?? []) {
    if (!Number.isFinite(v) || (log && v <= 0)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
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
  // The rule and channels cached on the series, as the renderers use them:
  // decomposing the whole series here ran once per frame.
  const rule = s._rule !== undefined ? s._rule : defaultRegistry.detect(s.data);

  // Check custom renderer for priceRange (by series type or rule name)
  if (rendererRegistry) {
    const custom =
      rendererRegistry.getRenderer(s.type) ??
      (rule ? rendererRegistry.getRenderer(rule.name) : undefined);
    if (custom?.priceRange) {
      return custom.priceRange(s, start, end);
    }
  }

  if (!rule) return [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

  if (rule.name === "number") {
    const range = linePriceRange(s.data as DataPoint<number | null>[], start, end);
    // A scalar drawn as a histogram (AO) has its bars standing on zero, so
    // the range keeps zero in view or their heights cannot be compared.
    if (s.config.type === "histogram" && range[0] <= range[1]) {
      return [Math.min(range[0], 0), Math.max(range[1], 0)];
    }
    return range;
  }

  if (rule.name === "band") {
    const channels = getCachedChannels(s, rule);
    const upper = channels.get("upper") ?? [];
    const lower = channels.get("lower") ?? [];
    return bandPriceRange(upper, lower, start, end);
  }

  if (rule.name === "ichimoku") {
    const channels = getCachedChannels(s, rule);
    return cloudPriceRange(channels, start, end);
  }

  // Supertrend: only use upperBand/lowerBand for range (exclude trend direction channel)
  if (rule.name === "supertrend") {
    const channels = getCachedChannels(s, rule);
    const upper = channels.get("upperBand") ?? [];
    const lower = channels.get("lowerBand") ?? [];
    return bandPriceRange(upper, lower, start, end);
  }

  // Generic: decompose and find range across all channels
  const channels = getCachedChannels(s, rule);
  let acc: MinMax = emptyRange();
  for (const [, vals] of channels) {
    acc = reduceRange(vals, start, end, acc);
  }
  // Bars of a one-channel histogram (Weis Wave, Gap Analysis) stand on zero,
  // so the range keeps zero in view or their heights cannot be compared.
  if (rule.seriesType === "histogram" && channels.size === 1 && acc[0] <= acc[1]) {
    return [Math.min(acc[0], 0), Math.max(acc[1], 0)];
  }
  return acc;
}
