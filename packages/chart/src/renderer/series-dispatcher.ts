/**
 * Series Dispatcher — Routes series data to the correct renderer.
 * Extracted from canvas-chart.ts for maintainability.
 */

import { withAlpha } from "../core/color-utils";
import type { DataLayer, InternalSeries } from "../core/data-layer";
import { getDecimationTarget, lttb } from "../core/decimation";
import { barLeft, DrawHelper, oddPixelWidth } from "../core/draw-helper";
import type { RendererRegistry } from "../core/renderer-registry";
import type { PriceScale, TimeScale } from "../core/scale";
import type { IntrospectionRule } from "../core/series-registry";
import { defaultRegistry } from "../core/series-registry";
import type { DataPoint, ThemeColors } from "../core/types";
import { renderArea } from "../series/area";
import { renderBand } from "../series/band";
import { renderBoxes } from "../series/box";
import { renderCloud } from "../series/cloud";
import { renderHeatmap } from "../series/heatmap";
import { BarBatch, renderHistogram } from "../series/histogram";
import { renderChannelLine, renderLine } from "../series/line";
import { renderMarkers } from "../series/marker";
import { plainChannelColors } from "./series-color";

/** Cached DrawHelper for custom plugin renderers — avoids per-frame allocation */
let _pluginDrawHelper: DrawHelper | null = null;

/** LTTB decimation cache per series — avoids re-decimating every frame */
const _lttbCache = new WeakMap<
  DataPoint<number | null>[],
  {
    start: number;
    end: number;
    target: number;
    version: number;
    points: readonly DataPoint<number | null>[];
    originalIndices: Int32Array;
  }
>();

/** Return cached decomposed channels, recomputing only when data changes */
export function getCachedChannels(
  s: InternalSeries,
  rule: IntrospectionRule,
): Map<string, (number | null)[]> {
  // _channels is cleared to undefined by handle.update() and setData(),
  // so in-place mutations always trigger recomputation.
  if (s._channels && s._channelsLen === s.data.length) return s._channels;
  const channels = defaultRegistry.decomposeAll(s.data, rule);
  s._channels = channels;
  s._channelsLen = s.data.length;
  return channels;
}

/**
 * Drop `undefined` entries so a renderer's `{ ...defaults, ...options }`
 * keeps its default for every option the series config leaves unset.
 */
function definedOnly<T extends object>(options: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(options).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

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
  // Use cached rule from addSeries() — avoids per-frame data scan
  const rule = s._rule !== undefined ? s._rule : defaultRegistry.detect(s.data);

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
  // Resolve `markers` config — `true` becomes default style, an object
  // overrides; `undefined` / `false` skip marker rendering entirely.
  const markersConfig = s.config.markers;
  const markers =
    markersConfig === true
      ? { radius: 2.5, color }
      : markersConfig && typeof markersConfig === "object"
        ? { radius: markersConfig.radius ?? 2.5, color: markersConfig.color ?? color }
        : undefined;

  if (rule.name === "number") {
    // Honor explicit type override (e.g., volume as histogram)
    if (s.config.type === "histogram") {
      // Render histogram inline without .map() allocation. An explicit
      // `color` fills every bar. With none, `histogramColorBy` picks each
      // bar's colour: the candle's direction in the theme's volume colours
      // (default), or the value's sign or change in its candle colours.
      const candles = dataLayer?.candles;
      const own = s.config.color;
      const colorBy = s.config.histogramColorBy ?? "candle";
      const byCandle = colorBy === "candle";
      const upColor = own ?? (byCandle ? theme?.volumeUp : theme?.upColor) ?? color;
      const downColor = own ?? (byCandle ? theme?.volumeDown : theme?.downColor) ?? color;
      const values = s.data as DataPoint<number | null>[];
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      const barWidth = oddPixelWidth(timeScale.barSpacing * 0.6);
      const zeroY = priceScale.priceToY(0);
      const bars = new BarBatch(barWidth);
      // "change": the colour of the bar before the first visible one, carried
      // forward so an equal value keeps it.
      let falling =
        colorBy === "change" && start > 0 ? fallsFromPrevious(values, start - 1) : false;
      for (let i = start; i < end && i < s.data.length; i++) {
        if (colorBy === "change") falling = nextFalling(values, i, falling);
        const val = values[i]?.value;
        if (val === null || val === undefined) continue;
        const valY = priceScale.priceToY(val);
        const isDown =
          colorBy === "sign"
            ? val < 0
            : colorBy === "change"
              ? falling
              : candles?.[i]
                ? candles[i].close < candles[i].open
                : false;
        const top = Math.min(valY, zeroY);
        bars.add(
          barLeft(timeScale.indexToX(i), barWidth),
          top,
          top + Math.max(1, Math.abs(valY - zeroY)),
          isDown,
        );
      }
      bars.fill(ctx, upColor, downColor);
      return;
    }

    const data = s.data as DataPoint<number | null>[];
    const target = getDecimationTarget(timeScale.endIndex - timeScale.startIndex, timeScale.width);
    // Clamp the slice window to the data: a beyond-left viewport yields a
    // negative startIndex, which Array.slice would interpret as an offset
    // from the END (length + start) — silently blanking the whole series.
    // The clamped value must feed the slice, the LTTB index offset, and the
    // cache key identically, or the three drift apart.
    const sliceStart = Math.max(0, timeScale.startIndex);
    const sliceEnd = Math.max(sliceStart, timeScale.endIndex);
    let points: readonly DataPoint<number | null>[] = data;
    let origIndices: Int32Array | undefined;
    if (target > 0) {
      const ver = s._dataVersion ?? 0;
      const cached = _lttbCache.get(data);
      if (
        cached &&
        cached.start === sliceStart &&
        cached.end === sliceEnd &&
        cached.target === target &&
        cached.version === ver
      ) {
        points = cached.points;
        origIndices = cached.originalIndices;
      } else {
        const decimated = lttb(data.slice(sliceStart, sliceEnd), target, sliceStart);
        points = decimated.points;
        origIndices = decimated.originalIndices;
        _lttbCache.set(data, {
          start: sliceStart,
          end: sliceEnd,
          target,
          version: ver,
          points,
          originalIndices: origIndices,
        });
      }
    }
    renderLine(
      ctx,
      points,
      timeScale,
      priceScale,
      timeScale.startIndex,
      { color, lineWidth, markers },
      origIndices,
    );
    return;
  }

  if (rule.name === "band") {
    const channels = getCachedChannels(s, rule);
    const cc = s.config.channelColors;
    // A band line without a colour of its own takes the series colour, and
    // the fill a light tint of it.
    const base = s.config.color;
    renderBand(
      ctx,
      channels.get("upper") ?? [],
      channels.get("middle") ?? [],
      channels.get("lower") ?? [],
      timeScale,
      priceScale,
      definedOnly({
        upperColor: cc?.upper ?? base,
        middleColor: cc?.middle ?? base,
        lowerColor: cc?.lower ?? base,
        fillColor: base ? withAlpha(base, 0.08) : undefined,
        lineWidth: s.config.lineWidth,
      }),
    );
    return;
  }

  // A histogram series: MACD-like ones (MACD, PPO, Klinger) have a
  // `histogram` channel drawn as bars behind their lines; one with a single
  // channel (Weis Wave, Gap Analysis) is all bars.
  if (rule.seriesType === "histogram") {
    const channels = getCachedChannels(s, rule);
    const bars = channels.get("histogram");
    if (bars) {
      const cc = s.config.channelColors;
      renderHistogram(ctx, bars, timeScale, priceScale, {
        upColor: cc?.histogramUp ?? "rgba(38,166,154,0.6)",
        downColor: cc?.histogramDown ?? "rgba(239,83,80,0.6)",
      });
      const names = [...channels.keys()].filter((name) => name !== "histogram");
      names.forEach((name, i) => {
        renderChannelLine(ctx, channels.get(name) ?? [], timeScale, priceScale, {
          color: cc?.[name] ?? (i === 0 ? "#2196F3" : "#FF9800"),
          lineWidth,
        });
      });
      return;
    }
    if (channels.size === 1) {
      // An explicit `color` fills every bar, as for a plain histogram;
      // otherwise bars take the theme's up / down volume colours.
      const own = s.config.color;
      const [values] = channels.values();
      const direction =
        rule.name === "weisWave"
          ? (i: number) => (s.data[i]?.value as { direction?: string } | null)?.direction === "down"
          : undefined;
      renderHistogram(ctx, values, timeScale, priceScale, {
        upColor: own ?? theme?.volumeUp ?? color,
        downColor: own ?? theme?.volumeDown ?? color,
        isDown: direction,
      });
      return;
    }
  }

  if (rule.name === "ichimoku") {
    const channels = getCachedChannels(s, rule);
    renderCloud(
      ctx,
      channels,
      timeScale,
      priceScale,
      definedOnly({ lineColors: s.config.channelColors, lineWidth: s.config.lineWidth }),
    );
    return;
  }

  if (rule.name === "parabolicSar") {
    const channels = getCachedChannels(s, rule);
    const sarVals = channels.get("sar") ?? [];
    renderMarkers(ctx, sarVals, timeScale, priceScale, { color: color ?? "#FF9800", radius: 2 });
    return;
  }

  // Supertrend: draw cloud between price and supertrend line, then the line
  if (rule.name === "supertrend") {
    const channels = getCachedChannels(s, rule);
    const upper = channels.get("upperBand") ?? [];
    const lower = channels.get("lowerBand") ?? [];
    const trend = channels.get("trend") ?? [];
    const cc = s.config.channelColors;
    const upColor = cc?.lowerBand ?? "#26a69a";
    const downColor = cc?.upperBand ?? "#ef5350";
    const start = timeScale.startIndex;
    const end = timeScale.endIndex;
    const candles = dataLayer?.candles;

    // Pass 1: Fill cloud between candle close and supertrend line
    if (candles) {
      let fillDir: number | null = null;
      let xBuf: number[] = [];
      let closeBuf: number[] = [];
      let stBuf: number[] = [];

      const flushFill = () => {
        if (xBuf.length < 2 || fillDir === null) {
          xBuf = [];
          closeBuf = [];
          stBuf = [];
          return;
        }
        ctx.beginPath();
        // Forward along close prices
        for (let j = 0; j < xBuf.length; j++) {
          j === 0 ? ctx.moveTo(xBuf[j], closeBuf[j]) : ctx.lineTo(xBuf[j], closeBuf[j]);
        }
        // Backward along supertrend line
        for (let j = xBuf.length - 1; j >= 0; j--) {
          ctx.lineTo(xBuf[j], stBuf[j]);
        }
        ctx.closePath();
        ctx.fillStyle = fillDir === 1 ? `${upColor}20` : `${downColor}20`;
        ctx.fill();
        xBuf = [];
        closeBuf = [];
        stBuf = [];
      };

      for (let i = start; i < end && i < trend.length; i++) {
        const t = trend[i];
        // Direction 0 is "no trend yet" (warm-up, or no band broken since):
        // nothing to draw, like a missing value.
        const stVal = t === 1 ? lower[i] : t === -1 ? upper[i] : null;
        const close = candles[i]?.close;
        if (
          t === null ||
          t === undefined ||
          stVal === null ||
          stVal === undefined ||
          close === undefined
        ) {
          flushFill();
          fillDir = null;
          continue;
        }
        if (t !== fillDir) {
          flushFill();
          fillDir = t;
        }
        xBuf.push(timeScale.indexToX(i));
        closeBuf.push(priceScale.priceToY(close));
        stBuf.push(priceScale.priceToY(stVal));
      }
      flushFill();
    }

    // Pass 2: Draw the supertrend line with color switching
    ctx.lineWidth = s.config.lineWidth ?? 1.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash([]);

    let prevTrend: number | null = null;
    let drawing = false;
    for (let i = start; i < end && i < trend.length; i++) {
      const t = trend[i];
      const val = t === 1 ? lower[i] : t === -1 ? upper[i] : null;
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
    // Values are objects: plot the decomposed regime index, as every other
    // multi-field rule does.
    const regime = getCachedChannels(s, rule).get("regime") ?? [];
    const points = s.data.map((p, i) => ({ time: p.time, value: regime[i] ?? null }));
    renderArea(ctx, points, timeScale, priceScale, {
      lineColor: color,
      fillColor: `${color}26`,
    });
    return;
  }

  // Volume Profile heatmap
  if (rule.name === "volumeProfile") {
    const channels = getCachedChannels(s, rule);
    renderHeatmap(ctx, channels, timeScale, priceScale, paneWidth ?? timeScale.width);
    return;
  }

  // Box zones (generic)
  if (rule.seriesType === "box" && dataLayer) {
    renderBoxes(ctx, s.data as { value: unknown }[], timeScale, priceScale, dataLayer);
    return;
  }

  // Generic multi-channel: render each channel as a line
  const channels = getCachedChannels(s, rule);
  const names = [...channels.keys()];
  const colors = plainChannelColors(names, s.config);
  const drawn = new Map<string, string>();
  names.forEach((name, i) => {
    renderChannelLine(ctx, channels.get(name) ?? [], timeScale, priceScale, {
      color: colors[i],
      lineWidth,
    });
    drawn.set(name, colors[i]);
  });
  s._lineColors = drawn;
}

/**
 * Whether bar `i` of a scalar series is lower than the bar before it. An
 * equal value keeps the colour of the previous bar, so the search walks
 * back to the last change; the first bar, and a bar after a gap, count
 * as rising.
 */
function fallsFromPrevious(values: readonly DataPoint<number | null>[], i: number): boolean {
  for (let j = i; j > 0; j--) {
    const cur = values[j]?.value;
    const prev = values[j - 1]?.value;
    if (cur === null || cur === undefined || prev === null || prev === undefined) return false;
    if (cur < prev) return true;
    if (cur > prev) return false;
  }
  return false;
}

/** `fallsFromPrevious` for bar `i`, given the answer for bar `i - 1`. */
function nextFalling(
  values: readonly DataPoint<number | null>[],
  i: number,
  previous: boolean,
): boolean {
  const cur = values[i]?.value;
  const prev = i > 0 ? values[i - 1]?.value : undefined;
  if (cur === null || cur === undefined || prev === null || prev === undefined) return false;
  if (cur < prev) return true;
  if (cur > prev) return false;
  return previous;
}
