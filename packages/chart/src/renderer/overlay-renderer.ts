/**
 * Overlay Renderer — Price line, signal markers, trade overlays.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { DataLayer, InternalSeries } from "../core/data-layer";
import { autoFormatPrice, measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import { defaultRegistry } from "../core/series-registry";
import type {
  CandleData,
  DataPoint,
  PaneRect,
  SignalMarker,
  ThemeColors,
  TimeframeOverlay,
  TradeMarker,
} from "../core/types";
import type { AxisExcludeRange } from "./axis-renderer";

/**
 * Render current price line (dashed horizontal line at latest close).
 */
export function renderPriceLine(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  theme: ThemeColors,
  fontSize: number,
): void {
  if (candles.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  const lastCandle = candles[candles.length - 1];
  const price = lastCandle.close;
  const y = ps.priceToY(price) + mainPane.y;
  const isUp = lastCandle.close >= lastCandle.open;
  const color = isUp ? theme.upColor : theme.downColor;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(mainPane.x, Math.round(y) + 0.5);
  ctx.lineTo(mainPane.x + mainPane.width, Math.round(y) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  const label = autoFormatPrice(price);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const padX = 6;
  const padY = 3;
  const labelW = measureTextWidth(ctx, label) + padX * 2;
  const labelH = fontSize + padY * 2;
  const labelX = mainPane.x + mainPane.width;

  ctx.fillStyle = color;
  ctx.fillRect(labelX, y - labelH / 2, labelW, labelH);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, labelX + padX, y);
}

/**
 * Render signal markers (buy/sell arrows) on the main pane.
 */
export function renderSignals(
  ctx: CanvasRenderingContext2D,
  signals: readonly SignalMarker[],
  candles: readonly CandleData[],
  dataLayer: DataLayer,
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
): void {
  if (signals.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
  ctx.clip();

  for (const signal of signals) {
    const idx = dataLayer.indexAtTime(signal.time);
    if (idx < timeScale.startIndex || idx >= timeScale.endIndex) continue;

    const candle = candles[idx];
    if (!candle) continue;

    const x = timeScale.indexToX(idx);
    const isBuy = signal.type === "buy";
    const price = isBuy ? candle.low : candle.high;
    const y = ps.priceToY(price) + mainPane.y;
    const offset = isBuy ? 12 : -12;

    ctx.fillStyle = isBuy ? "#26a69a" : "#ef5350";
    ctx.beginPath();
    if (isBuy) {
      ctx.moveTo(x, y + offset - 8);
      ctx.lineTo(x - 5, y + offset);
      ctx.lineTo(x + 5, y + offset);
    } else {
      ctx.moveTo(x, y + offset + 8);
      ctx.lineTo(x - 5, y + offset);
      ctx.lineTo(x + 5, y + offset);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Render trade markers (entry/exit dots, holding period shading).
 */
export function renderTrades(
  ctx: CanvasRenderingContext2D,
  trades: readonly TradeMarker[],
  dataLayer: DataLayer,
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
): void {
  if (trades.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
  ctx.clip();

  for (const trade of trades) {
    const entryIdx = dataLayer.indexAtTime(trade.entryTime);
    const exitIdx = dataLayer.indexAtTime(trade.exitTime);

    const isWin = (trade.returnPercent ?? 0) >= 0;
    const x1 = timeScale.indexToX(entryIdx);
    const x2 = timeScale.indexToX(exitIdx);
    ctx.fillStyle = isWin ? "rgba(38,166,154,0.08)" : "rgba(239,83,80,0.08)";
    ctx.fillRect(x1, mainPane.y, x2 - x1, mainPane.height);

    const entryY = ps.priceToY(trade.entryPrice) + mainPane.y;
    ctx.fillStyle = "#2196F3";
    ctx.beginPath();
    ctx.arc(x1, entryY, 4, 0, Math.PI * 2);
    ctx.fill();

    const exitY = ps.priceToY(trade.exitPrice) + mainPane.y;
    ctx.fillStyle = isWin ? "#26a69a" : "#ef5350";
    ctx.beginPath();
    ctx.arc(x2, exitY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = isWin ? "rgba(38,166,154,0.3)" : "rgba(239,83,80,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x1, entryY);
    ctx.lineTo(x2, exitY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Render multi-timeframe candles as semi-transparent overlays.
 */
export function renderTimeframeOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: readonly TimeframeOverlay[],
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  dataLayer: DataLayer,
  theme: ThemeColors,
): void {
  if (overlays.length === 0) return;

  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
  ctx.clip();

  for (const overlay of overlays) {
    const opacity = overlay.opacity ?? 0.15;
    ctx.globalAlpha = opacity;

    for (const candle of overlay.candles) {
      const startIdx = dataLayer.indexAtTime(candle.time);
      const nextIdx = overlay.candles.indexOf(candle) + 1;
      const endTime =
        nextIdx < overlay.candles.length
          ? overlay.candles[nextIdx].time
          : candle.time + 7 * 86400000;
      const endIdx = dataLayer.indexAtTime(endTime);

      if (endIdx < 0 || startIdx >= dataLayer.candleCount) continue;

      const x1 = mainPane.x + (startIdx / dataLayer.candleCount) * mainPane.width;
      const x2 = mainPane.x + (endIdx / dataLayer.candleCount) * mainPane.width;
      if (x2 - x1 < 1) continue;

      const isUp = candle.close >= candle.open;
      const openY = ps.priceToY(candle.open) + mainPane.y;
      const closeY = ps.priceToY(candle.close) + mainPane.y;
      const highY = ps.priceToY(candle.high) + mainPane.y;
      const lowY = ps.priceToY(candle.low) + mainPane.y;

      const color = overlay.color ?? (isUp ? theme.upColor : theme.downColor);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(1, Math.abs(closeY - openY));
      const midX = (x1 + x2) / 2;

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(midX, highY);
      ctx.lineTo(midX, lowY);
      ctx.stroke();

      // Body
      ctx.fillStyle = color;
      ctx.fillRect(x1, bodyTop, x2 - x1, bodyHeight);
    }

    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

/**
 * Render pane titles (label text in top-left of each subchart pane).
 */
export function renderPaneTitles(
  ctx: CanvasRenderingContext2D,
  paneRects: readonly PaneRect[],
  dataLayer: DataLayer,
  theme: ThemeColors,
  fontSize: number,
  locale?: import("../core/i18n").ChartLocale,
): void {
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  // Gap between adjacent labels, matching the DOM InfoOverlay which joins
  // entries with two non-breaking spaces.
  const GAP = 8;

  for (const pane of paneRects) {
    if (pane.id === "main") continue;
    const y = pane.y + 6;

    if (pane.id === "volume") {
      ctx.fillStyle = theme.textSecondary;
      ctx.fillText(locale?.volumePaneTitle ?? "Volume", 4, y);
      continue;
    }

    // Render each series label in its own color, matching the DOM InfoOverlay.
    const paneSeries = dataLayer.getSeriesForPane(pane.id);
    let x = 4;
    for (const s of paneSeries) {
      const label = s.config.label;
      if (!label) continue;
      ctx.fillStyle = s.config.color ?? theme.text;
      ctx.fillText(label, x, y);
      x += ctx.measureText(label).width + GAP;
    }
  }
}

/**
 * A pre-laid-out last-value badge ready to be drawn. Returned by
 * {@link computeSeriesBadges} so the caller can hand the occupied Y ranges
 * to {@link renderPriceAxis} (via `excludeYRanges`) before the badge is
 * actually painted — that way tick labels under a badge are suppressed.
 */
export type ComputedBadge = {
  /** Canvas-space center Y of the badge. */
  y: number;
  /** Half the badge height (fontSize/2 + padY). */
  half: number;
  /** Canvas-space x where the badge starts (right axis origin). */
  x: number;
  /** Badge width in pixels. */
  w: number;
  /** Fill color (pill background) and text color (derived as white / black if needed). */
  color: string;
  /** Rendered label text (already formatted). */
  label: string;
};

/**
 * Compute last-value badges for a pane. Does not paint — returns the list so
 * the caller can pass the occupied Y ranges into {@link renderPriceAxis} as
 * `excludeYRanges` and then call {@link drawSeriesBadges}.
 *
 * Collision strategy: walk badges sorted by descending Y; if a candidate's
 * range overlaps one already placed (including `preoccupied`), shift it
 * upward just enough to clear. If shifting would push it off the pane, the
 * candidate is skipped.
 */
export function computeSeriesBadges(
  ctx: CanvasRenderingContext2D,
  pane: PaneRect,
  priceScale: PriceScale,
  seriesOnPane: readonly InternalSeries[],
  theme: ThemeColors,
  fontSize: number,
  valueFormatter: (value: number) => string,
  preoccupied: readonly AxisExcludeRange[] = [],
  /**
   * Inclusive upper-bound index for the "latest value" search. `undefined`
   * means "search from end of data" (absolute-last mode). Pass the visible
   * endIndex − 1 for visible-range mode.
   */
  searchUpTo?: number,
  /** Optional extra badges (e.g. synthetic volume pill) to fold into layout. */
  extras: readonly { value: number; color: string }[] = [],
): ComputedBadge[] {
  const padX = 6;
  const padY = 3;
  const half = fontSize / 2 + padY;

  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  type Candidate = { y: number; color: string; label: string; w: number };
  const candidates: Candidate[] = [];

  for (const s of seriesOnPane) {
    if (!s.config.label) continue; // Only labeled series get a badge
    const rule = s._rule ?? defaultRegistry.detect(s.data);
    if (!rule) continue;

    if (rule.name === "number") {
      const val = latestNumber(s.data as DataPoint<number | null>[], searchUpTo);
      if (val === null) continue;
      candidates.push({
        y: priceScale.priceToY(val) + pane.y,
        color: s.config.color ?? theme.text,
        label: valueFormatter(val),
        w: 0,
      });
      continue;
    }

    // Multi-channel: one badge per channel with a defined latest value.
    if (!s._channels || s._channelsLen !== s.data.length) {
      s._channels = defaultRegistry.decomposeAll(s.data, rule);
      s._channelsLen = s.data.length;
    }
    const channelColors = s.config.channelColors;
    for (const [channelName, values] of s._channels) {
      const val = latestInArray(values, searchUpTo);
      if (val === null) continue;
      const color = channelColors?.[channelName] ?? s.config.color ?? theme.text;
      candidates.push({
        y: priceScale.priceToY(val) + pane.y,
        color,
        label: valueFormatter(val),
        w: 0,
      });
    }
  }

  // Extras (e.g. synthetic volume pill at the right edge).
  for (const ex of extras) {
    candidates.push({
      y: priceScale.priceToY(ex.value) + pane.y,
      color: ex.color,
      label: valueFormatter(ex.value),
      w: 0,
    });
  }

  // Measure and drop candidates whose center is outside the pane.
  for (const c of candidates) {
    c.w = measureTextWidth(ctx, c.label) + padX * 2;
  }
  const inside = candidates.filter((c) => c.y >= pane.y && c.y <= pane.y + pane.height);

  // Collision-resolve with descending Y so the lowest badge anchors first.
  inside.sort((a, b) => b.y - a.y);

  const placed: ComputedBadge[] = [];
  // Include preoccupied ranges as immovable anchors.
  const reserved: AxisExcludeRange[] = preoccupied.map((r) => ({ y: r.y, half: r.half }));

  const paneTop = pane.y;
  const paneBottom = pane.y + pane.height;

  for (const c of inside) {
    let y = c.y;
    // Shift up while overlapping any reserved range. Cap iterations to avoid
    // pathological loops on degenerate input.
    for (let iter = 0; iter < reserved.length + placed.length + 4; iter++) {
      let moved = false;
      for (const r of reserved) {
        const minDist = half + r.half;
        const delta = y - r.y;
        if (Math.abs(delta) < minDist) {
          // Move upward (negative Y) to stay above r.
          y = r.y - minDist;
          moved = true;
        }
      }
      if (!moved) break;
    }
    // Skip if shifted out of the pane.
    if (y - half < paneTop || y + half > paneBottom) continue;

    placed.push({
      y,
      half,
      x: pane.x + pane.width,
      w: c.w,
      color: c.color,
      label: c.label,
    });
    reserved.push({ y, half });
  }

  // Restore placement order to descending Y (for consistent draw order).
  placed.sort((a, b) => b.y - a.y);
  return placed;
}

/** Paint the badges produced by {@link computeSeriesBadges}. */
export function drawSeriesBadges(
  ctx: CanvasRenderingContext2D,
  badges: readonly ComputedBadge[],
  fontSize: number,
): void {
  if (badges.length === 0) return;
  const padX = 6;
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const b of badges) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y - b.half, b.w, b.half * 2);
    ctx.fillStyle = "#fff";
    ctx.fillText(b.label, b.x + padX, b.y);
  }
}

function latestNumber(data: readonly DataPoint<number | null>[], upTo?: number): number | null {
  const start = upTo !== undefined ? Math.min(upTo, data.length - 1) : data.length - 1;
  for (let i = start; i >= 0; i--) {
    const v = data[i]?.value;
    if (v !== null && v !== undefined) return v;
  }
  return null;
}

function latestInArray(values: readonly (number | null)[], upTo?: number): number | null {
  const start = upTo !== undefined ? Math.min(upTo, values.length - 1) : values.length - 1;
  for (let i = start; i >= 0; i--) {
    const v = values[i];
    if (v !== null && v !== undefined) return v;
  }
  return null;
}
