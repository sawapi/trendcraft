/**
 * Render Pipeline — Extracted from CanvasChart._render() for maintainability.
 * Receives a context object with all needed state, renders one frame.
 */

import type { DataLayer, InternalSeries } from "../core/data-layer";
import { decimateCandles, getDecimationTarget } from "../core/decimation";
import { DrawHelper } from "../core/draw-helper";
import type { LayoutEngine } from "../core/layout";
import type { RendererRegistry } from "../core/renderer-registry";
import { PriceScale, type TimeScale } from "../core/scale";
import type { BacktestResultData, ChartType, PaneRect, ThemeColors } from "../core/types";
import type { ViewportState } from "../core/viewport";
import { renderCandlesticks } from "../series/candlestick";
import { renderVolume } from "../series/histogram";
import { renderMountainChart } from "../series/mountain";
import { renderOhlcBars } from "../series/ohlc-bar";
import { renderPriceLineChart } from "../series/price-line";
import { renderGrid, renderPriceAxis, renderReferenceLines, renderTimeAxis } from "./axis-renderer";
import {
  renderBacktestSummary,
  renderBacktestTrades,
  renderEquityCurve,
} from "./backtest-renderer";
import { renderCrosshair } from "./crosshair-renderer";
import { renderDrawings } from "./drawing-renderer";
import {
  renderPaneTitles,
  renderPriceLine,
  renderSignals,
  renderTimeframeOverlays,
  renderTrades,
} from "./overlay-renderer";
import { renderPatterns } from "./pattern-renderer";
import { computePaneRange } from "./range-calculator";
import { renderScoreHeatmap } from "./score-renderer";
import { renderScrollbar } from "./scrollbar-renderer";
import { dispatchSeries } from "./series-dispatcher";

/** Everything the render pipeline needs from CanvasChart */
export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  pixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeColors;
  fontSize: number;
  chartType: ChartType;
  watermark: string | undefined;
  priceFormatter: (price: number) => string;
  timeFormatter: ((time: number) => string) | undefined;
  data: DataLayer;
  layout: LayoutEngine;
  timeScale: TimeScale;
  priceScales: Map<string, PriceScale>;
  viewportState: Readonly<ViewportState>;
  rendererRegistry: RendererRegistry;
  drawHelper: DrawHelper | null;
  emit: (event: string, data: unknown) => void;
};

/** Result returned to canvas-chart for DOM overlay updates */
export type RenderResult = {
  crosshairIndex: number | null;
  paneRects: readonly PaneRect[];
  seriesByPane: Map<string, InternalSeries[]>;
  drawHelper: DrawHelper | null;
};

/**
 * Execute one render frame. Pure rendering — no DOM mutations.
 * DOM overlays (info, legend) are updated by the caller using the result.
 */
export function renderFrame(rc: RenderContext): RenderResult {
  const { ctx, pixelRatio: pr, theme, data, layout, timeScale } = rc;
  const width = rc.canvasWidth / pr;
  const height = rc.canvasHeight / pr;

  ctx.setTransform(pr, 0, 0, pr, 0, 0);

  // Clear
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Watermark
  if (rc.watermark) {
    ctx.save();
    ctx.fillStyle = theme.textSecondary;
    ctx.globalAlpha = 0.07;
    ctx.font = `bold ${Math.min(width * 0.08, 48)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rc.watermark, width / 2, height / 2);
    ctx.restore();
  }

  const paneRects = layout.paneRects;
  const candles = data.candles;
  const visibleStart = timeScale.startIndex;
  const visibleEnd = timeScale.endIndex;

  // Ensure price scales exist
  for (const pane of paneRects) {
    if (!rc.priceScales.has(pane.id)) {
      rc.priceScales.set(pane.id, new PriceScale());
    }
  }

  // Update price scales
  for (const pane of paneRects) {
    const ps = rc.priceScales.get(pane.id);
    if (!ps) continue;
    ps.setHeight(pane.height);
    if (pane.config.yScale) ps.setMode(pane.config.yScale);
    if (pane.config.yRange) ps.setFixedRange(pane.config.yRange);

    const paneSeries = data.getSeriesForPane(pane.id);

    if (pane.id === "equity" && data.backtestResult) {
      const bt = data.backtestResult;
      let eqMin = bt.initialCapital;
      let eqMax = bt.initialCapital;
      let equity = bt.initialCapital;
      for (const trade of bt.trades) {
        equity *= 1 + trade.returnPercent / 100;
        if (equity < eqMin) eqMin = equity;
        if (equity > eqMax) eqMax = equity;
      }
      ps.setDataRange(eqMin * 0.99, eqMax * 1.01);
    } else {
      const [min, max] = computePaneRange(pane, visibleStart, visibleEnd, candles, paneSeries);
      ps.setDataRange(min, max);
    }
  }

  // Render panes
  let drawHelper = rc.drawHelper;

  for (const pane of paneRects) {
    const ps = rc.priceScales.get(pane.id);
    if (!ps) continue;

    ctx.save();
    ctx.beginPath();
    ctx.rect(pane.x, pane.y, pane.width, pane.height);
    ctx.clip();

    // Grid
    renderGrid(ctx, ps, pane.x, pane.y, pane.width, pane.height, theme, timeScale, candles);

    // Reference lines
    if (pane.config.referenceLines?.length) {
      renderReferenceLines(
        ctx,
        pane.config.referenceLines,
        ps,
        pane.x,
        pane.y,
        pane.width,
        pane.config.referenceLineColor ?? theme.textSecondary,
      );
    }

    ctx.translate(0, pane.y);

    // Score heatmap
    if (pane.id === "main" && data.scores.length > 0) {
      renderScoreHeatmap(ctx, data.scores, timeScale, { ...pane, y: 0 });
    }

    // Price data
    if (pane.id === "main") {
      const decimTarget = getDecimationTarget(
        timeScale.endIndex - timeScale.startIndex,
        timeScale.width,
      );
      const visibleCandles =
        decimTarget > 0
          ? decimateCandles(candles, timeScale.startIndex, timeScale.endIndex, decimTarget)
          : candles;

      switch (rc.chartType) {
        case "line":
          renderPriceLineChart(ctx, visibleCandles, timeScale, ps, theme);
          break;
        case "mountain":
          renderMountainChart(ctx, visibleCandles, timeScale, ps, theme);
          break;
        case "ohlc":
          renderOhlcBars(ctx, visibleCandles, timeScale, ps, theme);
          break;
        default:
          renderCandlesticks(ctx, visibleCandles, timeScale, ps, theme);
          break;
      }
    }

    if (pane.id === "volume") {
      renderVolume(ctx, candles, timeScale, ps, theme);
    }

    // 'below' primitives
    for (const prim of rc.rendererRegistry.getPrimitives(pane.id, "below")) {
      if (!drawHelper) drawHelper = new DrawHelper(ctx, timeScale, ps);
      else drawHelper.reset(ctx, timeScale, ps);
      prim.plugin.render(
        {
          ctx,
          pane: { ...pane, y: 0 },
          timeScale,
          priceScale: ps,
          dataLayer: data,
          theme,
          draw: drawHelper,
        },
        prim.state,
      );
    }

    // Series (dispatch to correct scale)
    const paneSeriesForRender = data.getSeriesForPane(pane.id);
    for (const s of paneSeriesForRender) {
      dispatchSeries(ctx, s, timeScale, ps, data, pane.width, theme, rc.rendererRegistry);
    }

    // 'above' primitives
    for (const prim of rc.rendererRegistry.getPrimitives(pane.id, "above")) {
      if (!drawHelper) drawHelper = new DrawHelper(ctx, timeScale, ps);
      else drawHelper.reset(ctx, timeScale, ps);
      prim.plugin.render(
        {
          ctx,
          pane: { ...pane, y: 0 },
          timeScale,
          priceScale: ps,
          dataLayer: data,
          theme,
          draw: drawHelper,
        },
        prim.state,
      );
    }

    ctx.restore();

    // Price axis
    renderPriceAxis(
      ctx,
      ps,
      pane.x + pane.width,
      pane.y,
      layout.priceAxisWidth,
      pane.height,
      theme,
      rc.fontSize,
      rc.priceFormatter,
    );
  }

  // Pane titles
  renderPaneTitles(ctx, paneRects, data, theme, rc.fontSize);

  // Scrollbar
  if (layout.scrollbarHeight > 0) {
    renderScrollbar(
      ctx,
      timeScale,
      0,
      layout.scrollbarY,
      layout.dataAreaWidth,
      layout.scrollbarHeight,
      theme,
    );
  }

  // Time axis
  renderTimeAxis(
    ctx,
    candles,
    timeScale,
    0,
    layout.timeAxisY,
    layout.dataAreaWidth,
    layout.timeAxisHeight,
    theme,
    rc.fontSize,
    rc.timeFormatter,
  );

  // MTF overlays
  renderTimeframeOverlays(ctx, data.timeframes, paneRects, rc.priceScales, data, theme);

  // Backtest
  const btResult = data.backtestResult;
  if (btResult) {
    renderBacktestTrades(ctx, btResult, paneRects, rc.priceScales, timeScale, data);
    const equityPane = paneRects.find((p) => p.id === "equity");
    const equityScale = rc.priceScales.get("equity");
    if (equityPane && equityScale) {
      renderEquityCurve(ctx, btResult, equityPane, equityScale, timeScale, data, theme);
      renderBacktestSummary(ctx, btResult, equityPane.x, equityPane.y, theme, rc.fontSize);
    }
  }

  // Patterns
  if (data.patterns.length > 0) {
    renderPatterns(
      ctx,
      data.patterns,
      paneRects,
      rc.priceScales,
      timeScale,
      data,
      theme,
      rc.fontSize,
    );
  }

  // Drawings
  renderDrawings(
    ctx,
    data.drawings,
    paneRects,
    rc.priceScales,
    timeScale,
    data,
    theme,
    rc.fontSize,
  );

  // Overlays
  renderPriceLine(ctx, candles, paneRects, rc.priceScales, theme, rc.fontSize);
  renderSignals(ctx, data.signals, candles, data, paneRects, rc.priceScales, timeScale);
  renderTrades(ctx, data.trades, data, paneRects, rc.priceScales, timeScale);

  // Crosshair
  renderCrosshair(
    ctx,
    rc.viewportState,
    paneRects,
    rc.priceScales,
    timeScale,
    layout.dataAreaWidth,
    layout.timeAxisY,
    theme,
    rc.fontSize,
    candles,
  );

  // Emit crosshair event
  if (rc.viewportState.crosshairIndex !== null) {
    const idx = rc.viewportState.crosshairIndex;
    const candle = candles[idx];
    if (candle) {
      rc.emit("crosshairMove", {
        time: candle.time,
        index: idx,
        ohlcv: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        },
        paneId: rc.viewportState.activePaneId,
      });
    }
  }

  // Build series-by-pane map for DOM overlays
  const seriesByPane = new Map<string, InternalSeries[]>();
  for (const pane of paneRects) {
    seriesByPane.set(pane.id, data.getSeriesForPane(pane.id));
  }

  return { crosshairIndex: rc.viewportState.crosshairIndex, paneRects, seriesByPane, drawHelper };
}
