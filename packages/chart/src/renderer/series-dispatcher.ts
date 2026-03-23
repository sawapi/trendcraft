/**
 * Series Dispatcher — Routes series data to the correct renderer.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { InternalSeries } from "../core/data-layer";
import type { PriceScale, TimeScale } from "../core/scale";
import { defaultRegistry } from "../core/series-registry";
import type { DataPoint } from "../core/types";
import { renderArea } from "../series/area";
import { renderBand } from "../series/band";
import { renderCloud } from "../series/cloud";
import { renderHistogram } from "../series/histogram";
import { renderChannelLine, renderLine } from "../series/line";
import { renderMarkers } from "../series/marker";

/**
 * Dispatch a series to its appropriate renderer based on introspection.
 */
export function dispatchSeries(
  ctx: CanvasRenderingContext2D,
  s: InternalSeries,
  timeScale: TimeScale,
  priceScale: PriceScale,
): void {
  const rule = defaultRegistry.detect(s.data);
  if (!rule) return;

  const color = s.config.color ?? "#2196F3";
  const lineWidth = s.config.lineWidth ?? 1.5;

  if (rule.name === "number") {
    renderLine(
      ctx,
      s.data as DataPoint<number | null>[],
      timeScale,
      priceScale,
      timeScale.startIndex,
      {
        color,
        lineWidth,
      },
    );
    return;
  }

  if (rule.name === "band") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    renderBand(
      ctx,
      channels.get("upper") ?? [],
      channels.get("middle") ?? [],
      channels.get("lower") ?? [],
      timeScale,
      priceScale,
    );
    return;
  }

  if (rule.name === "macd") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    renderHistogram(ctx, channels.get("histogram") ?? [], timeScale, priceScale, {
      upColor: "rgba(38,166,154,0.6)",
      downColor: "rgba(239,83,80,0.6)",
    });
    renderChannelLine(ctx, channels.get("macd") ?? [], timeScale, priceScale, {
      color: "#2196F3",
      lineWidth: 1.5,
    });
    renderChannelLine(ctx, channels.get("signal") ?? [], timeScale, priceScale, {
      color: "#FF9800",
      lineWidth: 1.5,
    });
    return;
  }

  if (rule.name === "ichimoku") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    renderCloud(ctx, channels, timeScale, priceScale);
    return;
  }

  if (rule.name === "parabolicSar") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const sarVals = channels.get("sar") ?? [];
    renderMarkers(ctx, sarVals, timeScale, priceScale, { color: color ?? "#FF9800", radius: 2 });
    return;
  }

  if (rule.name === "hmmRegime") {
    renderArea(ctx, s.data as DataPoint<number | null>[], timeScale, priceScale, {
      lineColor: color,
      fillColor: `${color}26`,
    });
    return;
  }

  // Generic multi-channel: render each channel as a line
  const channels = defaultRegistry.decomposeAll(s.data, rule);
  const colors = ["#2196F3", "#FF9800", "#26a69a", "#ef5350", "#9c27b0", "#FF5722"];
  let colorIdx = 0;
  for (const [, vals] of channels) {
    renderChannelLine(ctx, vals, timeScale, priceScale, {
      color: colors[colorIdx % colors.length],
      lineWidth,
    });
    colorIdx++;
  }
}
