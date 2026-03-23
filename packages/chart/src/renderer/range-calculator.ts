/**
 * Range Calculator — Computes min/max price ranges for pane auto-scaling.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { InternalSeries } from "../core/data-layer";
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
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  if (pane.id === "main") {
    const [cMin, cMax] = candlePriceRange(candles, start, end);
    if (cMin < min) min = cMin;
    if (cMax > max) max = cMax;
  }

  if (pane.id === "volume") {
    const [vMin, vMax] = volumeRange(candles, start, end);
    return [vMin, vMax];
  }

  for (const s of paneSeries) {
    const [sMin, sMax] = computeSeriesRange(s, start, end);
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
): [number, number] {
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
