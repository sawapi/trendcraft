/**
 * Series Dispatcher — Routes series data to the correct renderer.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { DataLayer, InternalSeries } from "../core/data-layer";
import { getDecimationTarget, lttb } from "../core/decimation";
import { DrawHelper } from "../core/draw-helper";
import type { RendererRegistry } from "../core/renderer-registry";
import type { PriceScale, TimeScale } from "../core/scale";
import { defaultRegistry } from "../core/series-registry";
import type { DataPoint, ThemeColors } from "../core/types";
import { renderArea } from "../series/area";
import { renderBand } from "../series/band";
import { renderBoxes } from "../series/box";
import { renderCloud } from "../series/cloud";
import { renderHeatmap } from "../series/heatmap";
import { renderHistogram } from "../series/histogram";
import { renderChannelLine, renderLine } from "../series/line";
import { renderMarkers } from "../series/marker";

/** Cached DrawHelper for custom plugin renderers — avoids per-frame allocation */
let _pluginDrawHelper: DrawHelper | null = null;

/**
 * Dispatch a series to its appropriate renderer based on introspection.
 */
export function dispatchSeries(
  ctx: CanvasRenderingContext2D,
  s: InternalSeries,
  timeScale: TimeScale,
  priceScale: PriceScale,
  dataLayer?: DataLayer,
  paneWidth?: number,
  theme?: ThemeColors,
  rendererRegistry?: RendererRegistry,
): void {
  // Detect rule once (avoid duplicate calls)
  const rule = defaultRegistry.detect(s.data);

  // Check custom renderer registry first (plugins take priority)
  if (rendererRegistry && dataLayer && theme) {
    const custom =
      rendererRegistry.getRenderer(s.type) ??
      (rule ? rendererRegistry.getRenderer(rule.name) : undefined);
    if (custom) {
      if (!_pluginDrawHelper) _pluginDrawHelper = new DrawHelper(ctx, timeScale, priceScale);
      else _pluginDrawHelper.reset(ctx, timeScale, priceScale);
      custom.render(
        {
          ctx,
          series: s,
          timeScale,
          priceScale,
          dataLayer,
          paneWidth: paneWidth ?? timeScale.width,
          theme,
          draw: _pluginDrawHelper,
        },
        s.config,
      );
      return;
    }
  }

  if (!rule) return;

  const color = s.config.color ?? "#2196F3";
  const lineWidth = s.config.lineWidth ?? 1.5;

  if (rule.name === "number") {
    // Honor explicit type override (e.g., volume as histogram)
    if (s.config.type === "histogram") {
      // Render histogram inline without .map() allocation
      const candles = dataLayer?.candles;
      const upColor = theme?.volumeUp ?? color;
      const downColor = theme?.volumeDown ?? color;
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      const barWidth = Math.max(1, timeScale.barSpacing * 0.6);
      const halfBar = barWidth / 2;
      const zeroY = priceScale.priceToY(0);
      for (let i = start; i < end && i < s.data.length; i++) {
        const val = (s.data[i] as DataPoint<number | null>)?.value;
        if (val === null || val === undefined) continue;
        const x = timeScale.indexToX(i);
        const valY = priceScale.priceToY(val);
        const isUp = candles?.[i] ? candles[i].close >= candles[i].open : true;
        ctx.fillStyle = isUp ? upColor : downColor;
        const top = Math.min(valY, zeroY);
        const height = Math.max(1, Math.abs(valY - zeroY));
        ctx.fillRect(x - halfBar, top, barWidth, height);
      }
      return;
    }

    let data = s.data as DataPoint<number | null>[];
    const target = getDecimationTarget(timeScale.endIndex - timeScale.startIndex, timeScale.width);
    if (target > 0) {
      data = lttb(data.slice(timeScale.startIndex, timeScale.endIndex), target);
    }
    renderLine(ctx, data, timeScale, priceScale, timeScale.startIndex, {
      color,
      lineWidth,
    });
    return;
  }

  if (rule.name === "band") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const cc = s.config.channelColors;
    renderBand(
      ctx,
      channels.get("upper") ?? [],
      channels.get("middle") ?? [],
      channels.get("lower") ?? [],
      timeScale,
      priceScale,
      cc ? { upperColor: cc.upper, middleColor: cc.middle, lowerColor: cc.lower } : undefined,
    );
    return;
  }

  if (rule.name === "macd") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const cc = s.config.channelColors;
    renderHistogram(ctx, channels.get("histogram") ?? [], timeScale, priceScale, {
      upColor: cc?.histogramUp ?? "rgba(38,166,154,0.6)",
      downColor: cc?.histogramDown ?? "rgba(239,83,80,0.6)",
    });
    renderChannelLine(ctx, channels.get("macd") ?? [], timeScale, priceScale, {
      color: cc?.macd ?? "#2196F3",
      lineWidth: 1.5,
    });
    renderChannelLine(ctx, channels.get("signal") ?? [], timeScale, priceScale, {
      color: cc?.signal ?? "#FF9800",
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

  // Supertrend: draw active band colored by trend direction
  if (rule.name === "supertrend") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    const upper = channels.get("upperBand") ?? [];
    const lower = channels.get("lowerBand") ?? [];
    const trend = channels.get("trend") ?? [];
    const cc = s.config.channelColors;
    const upColor = cc?.lowerBand ?? "#26a69a";
    const downColor = cc?.upperBand ?? "#ef5350";
    const start = timeScale.startIndex;
    const end = timeScale.endIndex;

    ctx.lineWidth = s.config.lineWidth ?? 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([]);

    // Draw segments, switching color on trend change
    let prevTrend: number | null = null;
    let drawing = false;
    for (let i = start; i < end && i < trend.length; i++) {
      const t = trend[i];
      const val = t === 1 ? lower[i] : upper[i];
      if (val === null || val === undefined || t === null || t === undefined) {
        drawing = false;
        prevTrend = null;
        continue;
      }
      const x = timeScale.indexToX(i);
      const y = priceScale.priceToY(val);
      if (!drawing || t !== prevTrend) {
        if (drawing) ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = t === 1 ? upColor : downColor;
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
      prevTrend = t;
    }
    if (drawing) ctx.stroke();
    return;
  }

  if (rule.name === "hmmRegime") {
    renderArea(ctx, s.data as DataPoint<number | null>[], timeScale, priceScale, {
      lineColor: color,
      fillColor: `${color}26`,
    });
    return;
  }

  // Volume Profile heatmap
  if (rule.name === "volumeProfile") {
    const channels = defaultRegistry.decomposeAll(s.data, rule);
    renderHeatmap(ctx, channels, timeScale, priceScale, paneWidth ?? timeScale.width);
    return;
  }

  // Box zones (Order Block, FVG)
  if (rule.seriesType === "box" && dataLayer) {
    renderBoxes(ctx, s.data as { value: unknown }[], timeScale, priceScale, dataLayer);
    return;
  }

  // Generic multi-channel: render each channel as a line
  const channels = defaultRegistry.decomposeAll(s.data, rule);
  const cc = s.config.channelColors;
  const fallbackColors = ["#2196F3", "#FF9800", "#26a69a", "#ef5350", "#9c27b0", "#FF5722"];
  let colorIdx = 0;
  for (const [name, vals] of channels) {
    renderChannelLine(ctx, vals, timeScale, priceScale, {
      color: cc?.[name] ?? fallbackColors[colorIdx % fallbackColors.length],
      lineWidth,
    });
    colorIdx++;
  }
}
