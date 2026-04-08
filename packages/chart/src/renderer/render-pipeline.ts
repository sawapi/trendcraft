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
import type { CandleData, ChartType, PaneRect, ThemeColors } from "../core/types";
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

type DualScale = { left: PriceScale; right: PriceScale };

/** Cached watermark font string — avoids per-frame template literal */
let _watermarkFontWidth = 0;
let _watermarkFont = "";

/** Reused Maps — avoids per-frame allocation */
const _rightScaleMap = new Map<string, PriceScale>();
const _seriesByPane = new Map<string, InternalSeries[]>();

/** Candle decimation cache — avoids re-decimating every frame when viewport hasn't changed */
let _decimCache: {
  start: number;
  end: number;
  target: number;
  dataVersion: number;
  result: readonly CandleData[];
} | null = null;

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
  priceScales: Map<string, DualScale>;
  viewportState: Readonly<ViewportState>;
  rendererRegistry: RendererRegistry;
  drawHelper: DrawHelper | null;
  emit: (event: string, data: unknown) => void;
  /** Temporary drawing being placed interactively (shown as preview) */
  drawingPreview?: import("../core/types").Drawing;
  /** Locale strings for i18n */
  locale: import("../core/i18n").ChartLocale;
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
    if (_watermarkFontWidth !== width) {
      _watermarkFontWidth = width;
      _watermarkFont = `bold ${Math.min(width * 0.08, 48)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    }
    ctx.save();
    ctx.fillStyle = theme.textSecondary;
    ctx.globalAlpha = 0.07;
    ctx.font = _watermarkFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(rc.watermark, width / 2, height / 2);
    ctx.restore();
  }

  const paneRects = layout.paneRects;
  const candles = data.candles;
  const visibleStart = timeScale.startIndex;
  const visibleEnd = timeScale.endIndex;

  // Ensure price scales exist (left + right per pane)
  for (const pane of paneRects) {
    if (!rc.priceScales.has(pane.id)) {
      rc.priceScales.set(pane.id, { left: new PriceScale(), right: new PriceScale() });
    }
  }

  // Update price scales
  for (const pane of paneRects) {
    const scales = rc.priceScales.get(pane.id);
    if (!scales) continue;

    // Right scale
    scales.right.setHeight(pane.height);
    if (pane.config.yScale) scales.right.setMode(pane.config.yScale);
    if (pane.config.yRange) scales.right.setFixedRange(pane.config.yRange);

    // Left scale
    scales.left.setHeight(pane.height);
    if (pane.config.leftScale?.mode) scales.left.setMode(pane.config.leftScale.mode);
    if (pane.config.leftScale?.range) scales.left.setFixedRange(pane.config.leftScale.range);

    // Equity pane: backtest range
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
      scales.right.setDataRange(eqMin * 0.99, eqMax * 1.01);
    } else {
      // Right scale range
      const rightSeries = data.getSeriesForScale(pane.id, "right");
      const [rMin, rMax] = computePaneRange(
        pane,
        visibleStart,
        visibleEnd,
        candles,
        rightSeries,
        undefined,
        "right",
      );
      scales.right.setDataRange(rMin, rMax);

      // Left scale range
      const leftSeries = data.getSeriesForScale(pane.id, "left");
      if (leftSeries.length > 0) {
        const [lMin, lMax] = computePaneRange(
          pane,
          visibleStart,
          visibleEnd,
          candles,
          leftSeries,
          undefined,
          "left",
        );
        // Apply maxHeightRatio: expand range so data occupies at most ratio of pane height
        let ratio = 1;
        for (const s of leftSeries) {
          const r = s.config.maxHeightRatio;
          if (r !== undefined && r > 0 && r < ratio) ratio = r;
        }
        if (ratio < 1) {
          const dataRange = lMax - lMin;
          scales.left.setDataRange(lMin, lMin + dataRange / ratio);
        } else {
          scales.left.setDataRange(lMin, lMax);
        }
      }
    }
  }

  // Render panes
  let drawHelper = rc.drawHelper;
  // Reuse Maps across frames — clear + repopulate to avoid allocation
  _rightScaleMap.clear();
  for (const [id, dual] of rc.priceScales) _rightScaleMap.set(id, dual.right);
  _seriesByPane.clear();

  for (const pane of paneRects) {
    const scales = rc.priceScales.get(pane.id);
    if (!scales) continue;
    const ps = scales.right; // Primary scale for most rendering

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
    if (pane.config.leftScale?.referenceLines?.length) {
      renderReferenceLines(
        ctx,
        pane.config.leftScale.referenceLines,
        scales.left,
        pane.x,
        pane.y,
        pane.width,
        pane.config.leftScale.referenceLineColor ?? theme.textSecondary,
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
      let visibleCandles: readonly CandleData[];
      // When decimated, remap barSpacing so candles fill the full canvas width
      const savedStart = timeScale.startIndex;
      const savedSpacing = timeScale.barSpacing;
      if (decimTarget > 0) {
        // Use cached decimation result when viewport hasn't changed
        const dataVer = data.version;
        if (
          _decimCache &&
          _decimCache.start === timeScale.startIndex &&
          _decimCache.end === timeScale.endIndex &&
          _decimCache.target === decimTarget &&
          _decimCache.dataVersion === dataVer
        ) {
          visibleCandles = _decimCache.result;
        } else {
          visibleCandles = decimateCandles(
            candles,
            timeScale.startIndex,
            timeScale.endIndex,
            decimTarget,
          );
          _decimCache = {
            start: timeScale.startIndex,
            end: timeScale.endIndex,
            target: decimTarget,
            dataVersion: dataVer,
            result: visibleCandles,
          };
        }
        timeScale.setImmediate(0, timeScale.width / visibleCandles.length);
      } else {
        visibleCandles = candles;
      }
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
      // Restore timeScale after decimated rendering
      if (decimTarget > 0) {
        timeScale.setImmediate(savedStart, savedSpacing);
      }
    }

    if (pane.id === "volume") {
      renderVolume(ctx, candles, timeScale, ps, theme);
    }

    // Pre-compute translated pane object once (avoids spread per primitive)
    const translatedPane = { ...pane, y: 0 };

    // 'below' primitives
    for (const prim of rc.rendererRegistry.getPrimitives(pane.id, "below")) {
      try {
        if (!drawHelper) drawHelper = new DrawHelper(ctx, timeScale, ps);
        else drawHelper.reset(ctx, timeScale, ps);
        prim.plugin.render(
          {
            ctx,
            pane: translatedPane,
            timeScale,
            priceScale: ps,
            dataLayer: data,
            theme,
            draw: drawHelper,
          },
          prim.state,
        );
      } catch (err) {
        rc.emit("error", { source: `primitive:${prim.plugin.name}`, error: err });
      }
    }

    // Series — dispatch to correct scale (cache for later info overlay use)
    const paneSeriesForRender = data.getSeriesForPane(pane.id);
    _seriesByPane.set(pane.id, paneSeriesForRender);
    for (const s of paneSeriesForRender) {
      try {
        const seriesScale = s.scaleId === "left" ? scales.left : ps;
        dispatchSeries(
          ctx,
          s,
          timeScale,
          seriesScale,
          data,
          pane.width,
          theme,
          rc.rendererRegistry,
        );
      } catch (err) {
        rc.emit("error", { source: `series:${s.id}`, error: err });
      }
    }

    // 'above' primitives
    for (const prim of rc.rendererRegistry.getPrimitives(pane.id, "above")) {
      try {
        if (!drawHelper) drawHelper = new DrawHelper(ctx, timeScale, ps);
        else drawHelper.reset(ctx, timeScale, ps);
        prim.plugin.render(
          {
            ctx,
            pane: translatedPane,
            timeScale,
            priceScale: ps,
            dataLayer: data,
            theme,
            draw: drawHelper,
          },
          prim.state,
        );
      } catch (err) {
        rc.emit("error", { source: `primitive:${prim.plugin.name}`, error: err });
      }
    }

    ctx.restore();

    // Right price axis
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

    // Left price axis (if pane has left-scale series)
    if (data.hasSeriesOnScale(pane.id, "left")) {
      renderPriceAxis(
        ctx,
        scales.left,
        pane.x - layout.priceAxisWidth,
        pane.y,
        layout.priceAxisWidth,
        pane.height,
        theme,
        rc.fontSize,
        rc.priceFormatter,
      );
    }
  }

  // Pane titles
  renderPaneTitles(ctx, paneRects, data, theme, rc.fontSize, rc.locale);

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
  renderTimeframeOverlays(ctx, data.timeframes, paneRects, _rightScaleMap, data, theme);

  // Backtest
  const btResult = data.backtestResult;
  if (btResult) {
    renderBacktestTrades(ctx, btResult, paneRects, _rightScaleMap, timeScale, data);
    const equityPane = paneRects.find((p) => p.id === "equity");
    const equityScale = rc.priceScales.get("equity");
    if (equityPane && equityScale) {
      renderEquityCurve(ctx, btResult, equityPane, equityScale.right, timeScale, data, theme);
      renderBacktestSummary(
        ctx,
        btResult,
        equityPane.x,
        equityPane.y,
        theme,
        rc.fontSize,
        rc.locale,
      );
    }
  }

  // Patterns
  if (data.patterns.length > 0) {
    renderPatterns(
      ctx,
      data.patterns,
      paneRects,
      _rightScaleMap,
      timeScale,
      data,
      theme,
      rc.fontSize,
    );
  }

  // Drawings (include interactive preview if present)
  const allDrawings = rc.drawingPreview ? [...data.drawings, rc.drawingPreview] : data.drawings;
  renderDrawings(ctx, allDrawings, paneRects, _rightScaleMap, timeScale, data, theme, rc.fontSize);

  // Overlays
  renderPriceLine(ctx, candles, paneRects, _rightScaleMap, theme, rc.fontSize);
  renderSignals(ctx, data.signals, candles, data, paneRects, _rightScaleMap, timeScale);
  renderTrades(ctx, data.trades, data, paneRects, _rightScaleMap, timeScale);

  // Crosshair
  renderCrosshair(
    ctx,
    rc.viewportState,
    paneRects,
    _rightScaleMap,
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

  return {
    crosshairIndex: rc.viewportState.crosshairIndex,
    paneRects,
    seriesByPane: _seriesByPane,
    drawHelper,
  };
}
