/**
 * Render Pipeline — Extracted from CanvasChart._render() for maintainability.
 * Receives a context object with all needed state, renders one frame.
 */

import type { DataLayer, InternalSeries } from "../core/data-layer";
import { decimateCandles, getDecimationTarget } from "../core/decimation";
import { DrawHelper, withPaneClip } from "../core/draw-helper";
import type { BacktestFeature } from "../core/features";
import { canvasFont } from "../core/font";
import { formatVolume } from "../core/format";
import type { LayoutEngine } from "../core/layout";
import type { RendererRegistry } from "../core/renderer-registry";
import { PriceScale, type TimeScale } from "../core/scale";
import type {
  CandleData,
  ChartErrorPayload,
  ChartType,
  PaneRect,
  ThemeColors,
} from "../core/types";
import type { ViewportState } from "../core/viewport";
import { renderCandlesticks } from "../series/candlestick";
import { renderVolume } from "../series/histogram";
import { renderMountainChart } from "../series/mountain";
import { renderOhlcBars } from "../series/ohlc-bar";
import { renderPriceLineChart } from "../series/price-line";
import { renderGrid, renderPriceAxis, renderReferenceLines, renderTimeAxis } from "./axis-renderer";
import { renderCrosshair } from "./crosshair-renderer";
import type { EquityViewProblem } from "./equity-view";
import type { ChartEventEmitter } from "./event-emitter";
import {
  type ComputedBadge,
  computeSeriesBadges,
  drawSeriesBadges,
  renderPriceLine,
  renderTimeframeOverlays,
} from "./overlay-renderer";
import { computePaneRange } from "./range-calculator";
import { renderScrollbar } from "./scrollbar-renderer";
import { dispatchSeries } from "./series-dispatcher";

type DualScale = { left: PriceScale; right: PriceScale };

/** Cached watermark font string — avoids per-frame template literal */
let _watermarkFontWidth = 0;
let _watermarkFontFamily = "";
let _watermarkFont = "";

/** Reused Maps — avoids per-frame allocation */
const _rightScaleMap = new Map<string, PriceScale>();
const _seriesByPane = new Map<string, InternalSeries[]>();

/**
 * Candle decimation cache — avoids re-decimating every frame when the viewport
 * hasn't changed. Keyed on the source candle array reference (a WeakMap, like
 * the LTTB line cache) so each chart instance gets its own entry: a module-level
 * singleton keyed only on {start,end,target,dataVersion} collided across two
 * charts sharing those values (e.g. both `fitContent()`'d to the same count and
 * width), painting one chart's decimated candles onto the other.
 */
const _decimCache = new WeakMap<
  readonly CandleData[],
  {
    start: number;
    end: number;
    target: number;
    dataVersion: number;
    candles: readonly CandleData[];
    originalIndices: Int32Array;
  }
>();

/** Everything the render pipeline needs from CanvasChart */
export type RenderContext = {
  ctx: CanvasRenderingContext2D;
  pixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  theme: ThemeColors;
  fontSize: number;
  fontFamily: string;
  chartType: ChartType;
  watermark: string | undefined;
  /** When true, draw last-value pills on each pane's right axis */
  showSeriesBadges?: boolean;
  /** Which value to show in series badges: "absolute" (default) or "visible". */
  seriesBadgeMode?: "absolute" | "visible";
  priceFormatter: (price: number) => string;
  /**
   * The caller's own priceFormatter for the price-axis ticks; undefined when
   * they gave none, so the axis formats ticks from their step.
   */
  axisPriceFormatter?: (price: number) => string;
  timeFormatter: ((time: number) => string) | undefined;
  data: DataLayer;
  layout: LayoutEngine;
  timeScale: TimeScale;
  priceScales: Map<string, DualScale>;
  viewportState: Readonly<ViewportState>;
  rendererRegistry: RendererRegistry;
  drawHelper: DrawHelper | null;
  emit: ChartEventEmitter;
  /** Temporary drawing being placed interactively (shown as preview) */
  drawingPreview?: import("../core/types").Drawing;
  /** Locale strings for i18n */
  locale: import("../core/i18n").ChartLocale;
  /** Crosshair snap behavior */
  crosshair?: import("../core/types").CrosshairOptions;
  /** Optional features registered on the chart; absent ones are skipped */
  features: import("../core/features").ChartFeatures;
};

/** Result returned to canvas-chart for DOM overlay updates */
export type RenderResult = {
  crosshairIndex: number | null;
  paneRects: readonly PaneRect[];
  seriesByPane: Map<string, InternalSeries[]>;
  drawHelper: DrawHelper | null;
};

/** Backtest results already warned about, so each warns once */
const _equityWarned = new WeakSet<object>();

/**
 * Warn once per result that its equity curve is not drawn, and why. The
 * curve is never rebuilt from trades, which misstates sized or partly
 * closed positions.
 */
function warnNoEquityCurve(
  rc: RenderContext,
  backtest: BacktestFeature,
  result: object,
  reason: EquityViewProblem,
): void {
  if (_equityWarned.has(result)) return;
  _equityWarned.add(result);
  const message = backtest.equityWarning(reason);
  if (typeof console !== "undefined") console.warn(`[@trendcraft/chart] ${message}`);
  rc.emit("error", { message, code: "NO_EQUITY_CURVE", detail: { reason } });
}

/**
 * The `error` payload for a renderer or primitive that threw mid-frame:
 * `source` names it (`series:<id>` / `primitive:<name>`), and `detail` keeps
 * the source and the thrown value.
 */
function renderError(source: string, error: unknown): ChartErrorPayload {
  return {
    message: describeRenderError(source, error),
    code: "RENDER_ERROR",
    detail: { source, error },
  };
}

/**
 * Total: this runs inside the catch that contains a throwing plugin, and
 * describing the thrown value can itself throw (String() of a null-prototype
 * object, a throwing toString or `message` getter, a revoked Proxy), so the
 * whole message is built inside the try.
 */
function describeRenderError(source: string, error: unknown): string {
  try {
    const reason = error instanceof Error ? error.message : error;
    return `${source} threw while rendering: ${String(reason)}`;
  } catch {
    return `${source} threw while rendering a value that cannot be described`;
  }
}

/**
 * Execute one render frame. Pure rendering — no DOM mutations.
 */
export function renderFrame(rc: RenderContext): RenderResult {
  const { ctx, pixelRatio: pr, theme, data, layout, timeScale } = rc;
  const { backtest, drawing, markers, scores } = rc.features;
  const width = rc.canvasWidth / pr;
  const height = rc.canvasHeight / pr;

  ctx.setTransform(pr, 0, 0, pr, 0, 0);

  // Clear
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, width, height);

  // Watermark
  if (rc.watermark) {
    if (_watermarkFontWidth !== width || _watermarkFontFamily !== rc.fontFamily) {
      _watermarkFontWidth = width;
      _watermarkFontFamily = rc.fontFamily;
      _watermarkFont = canvasFont(Math.min(width * 0.08, 48), rc.fontFamily, "bold");
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
    if (pane.id === "equity" && data.backtestResult && backtest) {
      const [eqMin, eqMax] = backtest.equityRange(data.backtestResult, data);
      scales.right.setDataRange(eqMin, eqMax);
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

  // Resolve which candle the current-price badge points at. In "visible"
  // badge mode it follows the right edge of the viewport so all badges share
  // the same semantics; otherwise it tracks the data array's last bar
  // (live / streaming price).
  const currentPriceIndex =
    rc.seriesBadgeMode === "visible"
      ? Math.max(0, Math.min(candles.length, timeScale.endIndex) - 1)
      : candles.length - 1;

  // Current-price label Y (main pane) — tick labels that would overlap it
  // are suppressed by the main-pane axis renderer below.
  let mainPriceExcludeY: number | undefined;
  let mainPriceExcludeHalf: number | undefined;
  if (candles.length > 0 && currentPriceIndex >= 0) {
    const mainPane = paneRects.find((p) => p.id === "main");
    const mainScales = mainPane ? rc.priceScales.get("main") : undefined;
    if (mainPane && mainScales) {
      mainPriceExcludeY = mainScales.right.priceToY(candles[currentPriceIndex].close) + mainPane.y;
      mainPriceExcludeHalf = rc.fontSize / 2 + 3; // fontSize + padY(3) — matches overlay-renderer
    }
  }

  // Last-value badges per pane, collected during the pane loop and drawn
  // after renderPriceLine so they layer above the axis but below crosshair.
  const pendingBadges: { badges: ComputedBadge[] }[] = [];

  for (const pane of paneRects) {
    const scales = rc.priceScales.get(pane.id);
    if (!scales) continue;
    const ps = scales.right; // Primary scale for most rendering

    // Density-aware tick count — short sub-panes would otherwise crowd labels.
    const paneMaxTicks = Math.max(2, Math.floor(pane.height / 32));

    withPaneClip(ctx, pane, () => {
      // Grid
      renderGrid(
        ctx,
        ps,
        pane.x,
        pane.y,
        pane.width,
        pane.height,
        theme,
        timeScale,
        candles,
        paneMaxTicks,
      );

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
      if (pane.id === "main" && scores && data.scores.length > 0) {
        scores.renderHeatmap(ctx, data.scores, timeScale, { ...pane, y: 0 });
      }

      // Price data
      if (pane.id === "main") {
        const decimTarget = getDecimationTarget(
          timeScale.endIndex - timeScale.startIndex,
          timeScale.width,
        );
        let visibleCandles: readonly CandleData[];
        let origIndices: Int32Array | undefined;
        if (decimTarget > 0) {
          // Use cached decimation result when viewport hasn't changed. The
          // cache is keyed on this chart's own candle array, so a sibling
          // chart with the same start/end/target/version can't read it.
          const dataVer = data.version;
          const cached = _decimCache.get(candles);
          if (
            cached &&
            cached.start === timeScale.startIndex &&
            cached.end === timeScale.endIndex &&
            cached.target === decimTarget &&
            cached.dataVersion === dataVer
          ) {
            visibleCandles = cached.candles;
            origIndices = cached.originalIndices;
          } else {
            const decimated = decimateCandles(
              candles,
              timeScale.startIndex,
              timeScale.endIndex,
              decimTarget,
            );
            visibleCandles = decimated.candles;
            origIndices = decimated.originalIndices;
            _decimCache.set(candles, {
              start: timeScale.startIndex,
              end: timeScale.endIndex,
              target: decimTarget,
              dataVersion: dataVer,
              candles: visibleCandles,
              originalIndices: origIndices,
            });
          }
        } else {
          visibleCandles = candles;
        }
        switch (rc.chartType) {
          case "line":
            renderPriceLineChart(ctx, visibleCandles, timeScale, ps, theme, origIndices);
            break;
          case "mountain":
            renderMountainChart(ctx, visibleCandles, timeScale, ps, theme, origIndices);
            break;
          case "ohlc":
            renderOhlcBars(ctx, visibleCandles, timeScale, ps, theme, origIndices);
            break;
          default:
            renderCandlesticks(ctx, visibleCandles, timeScale, ps, theme, origIndices);
            break;
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
              fontFamily: rc.fontFamily,
            },
            prim.state,
          );
        } catch (err) {
          rc.emit("error", renderError(`primitive:${prim.plugin.name}`, err));
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
          rc.emit("error", renderError(`series:${s.id}`, err));
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
              fontFamily: rc.fontFamily,
            },
            prim.state,
          );
        } catch (err) {
          rc.emit("error", renderError(`primitive:${prim.plugin.name}`, err));
        }
      }
    });

    // Volume axis uses compact K/M/B notation; other panes use the user-
    // supplied price formatter. The tick labels fall back to step-based
    // decimals when there is none; the last-value badges keep the price
    // formatter.
    const badgeFormatter = pane.id === "volume" ? formatVolume : rc.priceFormatter;
    const axisFormatter = pane.id === "volume" ? formatVolume : rc.axisPriceFormatter;

    // Compute last-value badges (if enabled) before the axis so we can tell
    // the axis which Y ranges are occupied. The candle current-price badge
    // is seeded as a preoccupied slot so series badges shift around it.
    const excludeYRanges: { y: number; half: number }[] = [];
    if (pane.id === "main" && mainPriceExcludeY !== undefined) {
      excludeYRanges.push({ y: mainPriceExcludeY, half: mainPriceExcludeHalf ?? 0 });
    }
    let computedBadges: ComputedBadge[] = [];
    if (rc.showSeriesBadges) {
      const seriesOnPane = data.getSeriesForScale(pane.id, "right");
      // Visible-range mode: search up to the last visible candle index.
      const searchUpTo =
        rc.seriesBadgeMode === "visible"
          ? Math.max(0, Math.min(candles.length, timeScale.endIndex) - 1)
          : undefined;
      // Volume pane: the "volume" value isn't stored as a series — synthesize
      // a badge from the candle array so it lives next to indicator pills.
      const extras: { value: number; color: string }[] = [];
      if (pane.id === "volume") {
        const idx = searchUpTo ?? candles.length - 1;
        const c = candles[idx];
        if (c && Number.isFinite(c.volume)) {
          const isUp = c.close >= c.open;
          // Use solid up/down color (not translucent volumeUp/Down) so the
          // white pill text stays readable.
          extras.push({ value: c.volume, color: isUp ? theme.upColor : theme.downColor });
        }
      }
      if (seriesOnPane.length > 0 || extras.length > 0) {
        computedBadges = computeSeriesBadges(
          ctx,
          pane,
          ps,
          seriesOnPane,
          theme,
          rc.fontSize,
          badgeFormatter,
          excludeYRanges,
          searchUpTo,
          extras,
          rc.fontFamily,
        );
        for (const b of computedBadges) excludeYRanges.push({ y: b.y, half: b.half });
        if (computedBadges.length > 0) pendingBadges.push({ badges: computedBadges });
      }
    }

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
      axisFormatter,
      {
        position: "right",
        maxTicks: paneMaxTicks,
        excludeYRanges: excludeYRanges.length > 0 ? excludeYRanges : undefined,
      },
      rc.fontFamily,
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
        axisFormatter,
        { position: "left", maxTicks: paneMaxTicks },
        rc.fontFamily,
      );
    }
  }

  // Pane titles are rendered by InfoOverlay (DOM) to keep a single source of
  // truth and avoid Canvas/DOM alignment drift.

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
    rc.fontFamily,
  );

  // MTF overlays
  renderTimeframeOverlays(ctx, data.timeframes, paneRects, _rightScaleMap, data, theme);

  // Backtest
  const btResult = data.backtestResult;
  if (btResult && backtest) {
    backtest.renderTrades(ctx, btResult, paneRects, _rightScaleMap, timeScale, data);
    const equityPane = paneRects.find((p) => p.id === "equity");
    const equityScale = rc.priceScales.get("equity");
    if (equityPane && equityScale) {
      const view = backtest.equityView(btResult, data);
      if (!view.ok) warnNoEquityCurve(rc, backtest, btResult, view.reason);
      backtest.renderEquityCurve(ctx, view, equityPane, equityScale.right, timeScale, theme);
      const lastTime = data.timeAt(data.candleCount - 1);
      const partial =
        lastTime !== undefined && backtest.isPartialRun(btResult, view, data)
          ? { view, lastTime }
          : undefined;
      backtest.renderSummary(
        ctx,
        btResult,
        equityPane.x,
        equityPane.y,
        theme,
        rc.fontSize,
        rc.locale,
        rc.fontFamily,
        partial,
      );
    }
  }

  // Patterns
  if (backtest && data.patterns.length > 0) {
    backtest.renderPatterns(
      ctx,
      data.patterns,
      paneRects,
      _rightScaleMap,
      timeScale,
      data,
      theme,
      rc.fontSize,
      rc.fontFamily,
    );
  }

  // Drawings (include interactive preview if present)
  const allDrawings = rc.drawingPreview ? [...data.drawings, rc.drawingPreview] : data.drawings;
  drawing?.render(
    ctx,
    allDrawings,
    paneRects,
    _rightScaleMap,
    timeScale,
    data,
    theme,
    rc.fontSize,
    rc.fontFamily,
  );

  // Overlays
  renderPriceLine(
    ctx,
    candles,
    paneRects,
    _rightScaleMap,
    theme,
    rc.fontSize,
    currentPriceIndex,
    rc.fontFamily,
  );
  // Last-value series badges (opt-in). Drawn after renderPriceLine so the
  // candle current-price badge stays on top visually, and above the axis so
  // pills aren't obscured by tick labels.
  for (const { badges } of pendingBadges) {
    drawSeriesBadges(ctx, badges, rc.fontSize, rc.fontFamily);
  }
  markers?.renderSignals(ctx, data.signals, candles, data, paneRects, _rightScaleMap, timeScale);
  markers?.renderTrades(ctx, data.trades, data, paneRects, _rightScaleMap, timeScale);

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
    undefined,
    rc.crosshair,
    rc.fontFamily,
  );

  // Crosshair event emission is handled by CanvasChart's viewport interaction
  // callback (_maybeEmitCrosshair) with change-detection so it only fires
  // when the index actually moves.
  // Emitting every frame (as this used to) broke syncCharts: the
  // round-trip A→B→A crosses a requestAnimationFrame boundary, so the
  // synchronous re-entry guard can't stop the echo.

  return {
    crosshairIndex: rc.viewportState.crosshairIndex,
    paneRects,
    seriesByPane: _seriesByPane,
    drawHelper,
  };
}
