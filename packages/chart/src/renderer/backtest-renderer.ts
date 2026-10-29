/**
 * Backtest Renderer — Visualizes BacktestResult with equity curve,
 * drawdown periods, and exit-reason-colored trade markers.
 */

import type { DataLayer } from "../core/data-layer";
import { canvasFont, DEFAULT_FONT_FAMILY } from "../core/font";
import { measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { BacktestResultData, PaneRect, ThemeColors } from "../core/types";
import { tradeSpan } from "./trade-span";

/** Simplified backtest result shape (compatible with trendcraft BacktestResult) */
export type { BacktestResultData } from "../core/types";

const EXIT_REASON_COLORS: Record<string, string> = {
  signal: "#2196F3",
  stopLoss: "#ef5350",
  takeProfit: "#26a69a",
  trailing: "#FF9800",
  breakeven: "#9c27b0",
  partialTakeProfit: "#4caf50",
  timeExit: "#787b86",
  endOfData: "#787b86",
};

/**
 * Render trade markers on main pane, colored by exit reason.
 */
export function renderBacktestTrades(
  ctx: CanvasRenderingContext2D,
  result: BacktestResultData,
  paneRects: readonly PaneRect[],
  priceScales: Map<string, PriceScale>,
  timeScale: TimeScale,
  dataLayer: DataLayer,
): void {
  const mainPane = paneRects.find((p) => p.id === "main");
  if (!mainPane) return;

  const ps = priceScales.get("main");
  if (!ps) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mainPane.x, mainPane.y, mainPane.width, mainPane.height);
  ctx.clip();

  for (const trade of result.trades) {
    // Trades outside the loaded candles (a replay that has not reached them)
    // are skipped; one crossing an edge is clipped there, without the marker
    // on the far side.
    const span = tradeSpan(dataLayer, trade.entryTime, trade.exitTime);
    if (!span) continue;
    const isWin = trade.returnPercent >= 0;
    const exitColor = EXIT_REASON_COLORS[trade.exitReason ?? "signal"] ?? "#787b86";

    const x1 = timeScale.indexToX(span.entryIdx);
    const x2 = timeScale.indexToX(span.exitIdx);

    // Holding period shading
    ctx.fillStyle = isWin ? "rgba(38,166,154,0.06)" : "rgba(239,83,80,0.06)";
    ctx.fillRect(x1, mainPane.y, x2 - x1, mainPane.height);

    // Entry marker (blue circle)
    const entryY = ps.priceToY(trade.entryPrice) + mainPane.y;
    if (span.entryInRange) {
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(x1, entryY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Exit marker (colored by exit reason)
    const exitY = ps.priceToY(trade.exitPrice) + mainPane.y;
    if (span.exitInRange) {
      ctx.fillStyle = exitColor;
      ctx.beginPath();
      ctx.arc(x2, exitY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!span.entryInRange || !span.exitInRange) continue;

    // Connection line
    ctx.strokeStyle = `${exitColor}66`;
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
 * Render equity curve in a subchart pane with drawdown period shading.
 */
export function renderEquityCurve(
  ctx: CanvasRenderingContext2D,
  result: BacktestResultData,
  paneRect: PaneRect,
  priceScale: PriceScale,
  timeScale: TimeScale,
  dataLayer: DataLayer,
  theme: ThemeColors,
): void {
  // Build equity curve: one point per trade exit + initial point
  const equityPoints: { idx: number; equity: number }[] = [];
  let equity = result.initialCapital;
  const firstTime = dataLayer.timeAt(0);

  // Add entry points (equity stays flat until exit). Only exits up to the
  // last loaded candle count; a later exit has not happened yet on this chart.
  for (const trade of result.trades) {
    const span = tradeSpan(dataLayer, trade.entryTime, trade.exitTime);
    if (!span) {
      // Closed before the first loaded candle: it still sets the starting level
      if (firstTime !== undefined && trade.exitTime < firstTime) {
        equity *= 1 + trade.returnPercent / 100;
      }
      continue;
    }
    // Start at the first candle, at the equity reached before the data
    if (equityPoints.length === 0) equityPoints.push({ idx: 0, equity });
    equityPoints.push({ idx: span.entryIdx, equity }); // Flat until entry
    if (!span.exitInRange) continue;
    equity *= 1 + trade.returnPercent / 100;
    equityPoints.push({ idx: span.exitIdx, equity }); // Jump at exit
  }

  // Extend from the first to the last candle
  if (equityPoints.length === 0) equityPoints.push({ idx: 0, equity });
  equityPoints.push({ idx: dataLayer.candleCount - 1, equity });

  if (equityPoints.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(paneRect.x, paneRect.y, paneRect.width, paneRect.height);
  ctx.clip();

  // Drawdown periods (red shading), from the curve drawn below: from the bar
  // that set a peak until the line is back at it. `result.drawdownPeriods`
  // covers the whole run, so on partly loaded candles it would shade a loss
  // that has not happened yet.
  ctx.fillStyle = "rgba(239,83,80,0.15)";
  const shade = (fromIdx: number, toIdx: number) => {
    const x1 = timeScale.indexToX(fromIdx);
    ctx.fillRect(x1, paneRect.y, timeScale.indexToX(toIdx) - x1, paneRect.height);
  };
  let peak = equityPoints[0].equity;
  let peakIdx = equityPoints[0].idx;
  let drawdownFrom: number | null = null;
  for (const point of equityPoints) {
    if (point.equity < peak) {
      drawdownFrom ??= peakIdx;
      continue;
    }
    if (drawdownFrom !== null) {
      shade(drawdownFrom, point.idx);
      drawdownFrom = null;
    }
    if (point.equity > peak) {
      peak = point.equity;
      peakIdx = point.idx;
    }
  }
  if (drawdownFrom !== null) shade(drawdownFrom, equityPoints[equityPoints.length - 1].idx);

  // Equity line (use absolute y = paneRect.y + priceScale.priceToY)
  ctx.strokeStyle = theme.upColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();

  let started = false;
  for (const point of equityPoints) {
    const x = timeScale.indexToX(point.idx);
    const y = paneRect.y + priceScale.priceToY(point.equity);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();

  // Fill under equity line
  if (equityPoints.length > 0) {
    const lastPoint = equityPoints[equityPoints.length - 1];
    ctx.lineTo(timeScale.indexToX(lastPoint.idx), paneRect.y + paneRect.height);
    ctx.lineTo(timeScale.indexToX(equityPoints[0].idx), paneRect.y + paneRect.height);
    ctx.closePath();
    ctx.fillStyle = `${theme.upColor}15`;
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Profit factor as summary text. TrendCraft reports a run with no losing
 * trade as `Infinity`, which `JSON.stringify` writes as `null`; both read
 * as "∞" rather than toFixed's "Infinity" (or a throw on `null`).
 */
function formatProfitFactor(pf: number | null): string {
  if (pf === null || pf === Number.POSITIVE_INFINITY) return "∞";
  return Number.isFinite(pf) ? pf.toFixed(2) : "—";
}

/**
 * Render backtest summary bar at the top of the equity pane.
 */
export function renderBacktestSummary(
  ctx: CanvasRenderingContext2D,
  result: BacktestResultData,
  x: number,
  y: number,
  theme: ThemeColors,
  fontSize: number,
  locale?: import("../core/i18n").ChartLocale,
  fontFamily: string = DEFAULT_FONT_FAMILY,
): void {
  const isPositive = result.totalReturnPercent >= 0;
  const color = isPositive ? theme.upColor : theme.downColor;

  ctx.font = canvasFont(fontSize, fontFamily);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const parts = [
    {
      label: locale?.return_ ?? "Return",
      value: `${isPositive ? "+" : ""}${result.totalReturnPercent.toFixed(1)}%`,
      color,
    },
    { label: locale?.win ?? "Win", value: `${result.winRate.toFixed(0)}%`, color: theme.text },
    { label: locale?.sharpe ?? "Sharpe", value: result.sharpeRatio.toFixed(2), color: theme.text },
    {
      label: locale?.maxDD ?? "MaxDD",
      value: `${result.maxDrawdown.toFixed(1)}%`,
      color: theme.downColor,
    },
    {
      label: locale?.pf ?? "PF",
      value: formatProfitFactor(result.profitFactor),
      color: theme.text,
    },
    { label: locale?.trades ?? "Trades", value: `${result.tradeCount}`, color: theme.text },
  ];

  let currentX = x + 4;
  for (const part of parts) {
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(`${part.label}: `, currentX, y + 4);
    currentX += measureTextWidth(ctx, `${part.label}: `);
    ctx.fillStyle = part.color;
    ctx.fillText(part.value, currentX, y + 4);
    currentX += measureTextWidth(ctx, part.value) + 12;
  }
}
