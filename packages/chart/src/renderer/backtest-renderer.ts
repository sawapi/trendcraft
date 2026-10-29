/**
 * Backtest Renderer — Visualizes BacktestResult with equity curve,
 * drawdown periods, and exit-reason-colored trade markers.
 */

import type { DataLayer } from "../core/data-layer";
import { canvasFont, DEFAULT_FONT_FAMILY } from "../core/font";
import { measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { BacktestResultData, PaneRect, ThemeColors } from "../core/types";
import { type EquityView, maxDrawdownPercent } from "./equity-view";
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
 * Render the engine's equity curve in a subchart pane, with drawdown shading.
 * Draws nothing when the curve could not be placed on the candles
 * (see {@link equityView}).
 */
export function renderEquityCurve(
  ctx: CanvasRenderingContext2D,
  view: EquityView,
  paneRect: PaneRect,
  priceScale: PriceScale,
  timeScale: TimeScale,
  theme: ThemeColors,
): void {
  if (!view.ok || view.points.length === 0) return;
  const points = view.points;

  ctx.save();
  ctx.beginPath();
  ctx.rect(paneRect.x, paneRect.y, paneRect.width, paneRect.height);
  ctx.clip();

  // Drawdown periods (red shading): from the bar that set a peak until the
  // curve is back at it, or to the last drawn bar
  ctx.fillStyle = "rgba(239,83,80,0.15)";
  const shade = (fromIdx: number, toIdx: number) => {
    const x1 = timeScale.indexToX(fromIdx);
    ctx.fillRect(x1, paneRect.y, timeScale.indexToX(toIdx) - x1, paneRect.height);
  };
  let peak = points[0].equity;
  let peakIdx = points[0].idx;
  let drawdownFrom: number | null = null;
  for (const point of points) {
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
  if (drawdownFrom !== null) shade(drawdownFrom, points[points.length - 1].idx);

  // Equity line (use absolute y = paneRect.y + priceScale.priceToY)
  ctx.strokeStyle = theme.upColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const x = timeScale.indexToX(points[i].idx);
    const y = paneRect.y + priceScale.priceToY(points[i].equity);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Fill under equity line
  const lastPoint = points[points.length - 1];
  ctx.lineTo(timeScale.indexToX(lastPoint.idx), paneRect.y + paneRect.height);
  ctx.lineTo(timeScale.indexToX(points[0].idx), paneRect.y + paneRect.height);
  ctx.closePath();
  ctx.fillStyle = `${theme.upColor}15`;
  ctx.fill();

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
 *
 * While the loaded candles stop before the end of the run (a replay), the
 * figures are as of the last loaded candle: return and max drawdown from the
 * equity curve reached so far, trades and win rate from the trades closed by
 * then. Sharpe and profit factor describe the whole run and are left out
 * until it is loaded; so are return and max drawdown when there is no curve.
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
  partial?: { view: EquityView; lastTime: number },
): void {
  let returnPercent: number | null = result.totalReturnPercent;
  let maxDrawdown: number | null = result.maxDrawdown;
  let winRate = result.winRate;
  let tradeCount = result.tradeCount;
  if (partial) {
    const reached = partial.view.ok ? partial.view.reached : [];
    const equity = reached.length > 0 ? reached[reached.length - 1] : null;
    returnPercent =
      equity !== null && result.initialCapital > 0
        ? (equity / result.initialCapital - 1) * 100
        : null;
    maxDrawdown = reached.length > 0 ? maxDrawdownPercent(reached) : null;
    const closed = result.trades.filter((t) => t.exitTime <= partial.lastTime);
    tradeCount = closed.length;
    winRate =
      closed.length > 0
        ? (closed.filter((t) => t.returnPercent > 0).length / closed.length) * 100
        : 0;
  }

  ctx.font = canvasFont(fontSize, fontFamily);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const parts: { label: string; value: string; color: string }[] = [];
  if (returnPercent !== null) {
    const isPositive = returnPercent >= 0;
    parts.push({
      label: locale?.return_ ?? "Return",
      value: `${isPositive ? "+" : ""}${returnPercent.toFixed(1)}%`,
      color: isPositive ? theme.upColor : theme.downColor,
    });
  }
  parts.push({ label: locale?.win ?? "Win", value: `${winRate.toFixed(0)}%`, color: theme.text });
  if (!partial) {
    parts.push({
      label: locale?.sharpe ?? "Sharpe",
      value: result.sharpeRatio.toFixed(2),
      color: theme.text,
    });
  }
  if (maxDrawdown !== null) {
    parts.push({
      label: locale?.maxDD ?? "MaxDD",
      value: `${maxDrawdown.toFixed(1)}%`,
      color: theme.downColor,
    });
  }
  if (!partial) {
    parts.push({
      label: locale?.pf ?? "PF",
      value: formatProfitFactor(result.profitFactor),
      color: theme.text,
    });
  }
  parts.push({ label: locale?.trades ?? "Trades", value: `${tradeCount}`, color: theme.text });

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
