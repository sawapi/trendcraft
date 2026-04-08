/**
 * Backtest Renderer — Visualizes BacktestResult with equity curve,
 * drawdown periods, and exit-reason-colored trade markers.
 */

import type { DataLayer } from "../core/data-layer";
import { autoFormatPrice, measureTextWidth } from "../core/format";
import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";

/** Simplified backtest result shape (compatible with trendcraft BacktestResult) */
export type BacktestResultData = {
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  tradeCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: {
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    returnPercent: number;
    direction?: string;
    exitReason?: string;
  }[];
  drawdownPeriods: {
    startTime: number;
    troughTime: number;
    recoveryTime?: number;
    maxDepthPercent: number;
    peakEquity: number;
    troughEquity: number;
  }[];
};

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
    const entryIdx = dataLayer.indexAtTime(trade.entryTime);
    const exitIdx = dataLayer.indexAtTime(trade.exitTime);
    const isWin = trade.returnPercent >= 0;
    const exitColor = EXIT_REASON_COLORS[trade.exitReason ?? "signal"] ?? "#787b86";

    const x1 = timeScale.indexToX(entryIdx);
    const x2 = timeScale.indexToX(exitIdx);

    // Holding period shading
    ctx.fillStyle = isWin ? "rgba(38,166,154,0.06)" : "rgba(239,83,80,0.06)";
    ctx.fillRect(x1, mainPane.y, x2 - x1, mainPane.height);

    // Entry marker (blue circle)
    const entryY = ps.priceToY(trade.entryPrice) + mainPane.y;
    ctx.fillStyle = "#2196F3";
    ctx.beginPath();
    ctx.arc(x1, entryY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Exit marker (colored by exit reason)
    const exitY = ps.priceToY(trade.exitPrice) + mainPane.y;
    ctx.fillStyle = exitColor;
    ctx.beginPath();
    ctx.arc(x2, exitY, 4, 0, Math.PI * 2);
    ctx.fill();

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

  // Start at first candle
  equityPoints.push({ idx: 0, equity });

  // Add entry points (equity stays flat until exit)
  for (const trade of result.trades) {
    const entryIdx = dataLayer.indexAtTime(trade.entryTime);
    equityPoints.push({ idx: entryIdx, equity }); // Flat until entry
    const exitIdx = dataLayer.indexAtTime(trade.exitTime);
    equity *= 1 + trade.returnPercent / 100;
    equityPoints.push({ idx: exitIdx, equity }); // Jump at exit
  }

  // Extend to last candle
  equityPoints.push({ idx: dataLayer.candleCount - 1, equity });

  if (equityPoints.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(paneRect.x, paneRect.y, paneRect.width, paneRect.height);
  ctx.clip();

  // Drawdown periods (red shading)
  for (const dd of result.drawdownPeriods) {
    const startIdx = dataLayer.indexAtTime(dd.startTime);
    const endIdx = dd.recoveryTime
      ? dataLayer.indexAtTime(dd.recoveryTime)
      : dataLayer.candleCount - 1;

    const x1 = timeScale.indexToX(startIdx);
    const x2 = timeScale.indexToX(endIdx);

    ctx.fillStyle = "rgba(239,83,80,0.15)";
    ctx.fillRect(x1, paneRect.y, x2 - x1, paneRect.height);
  }

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
 * Render backtest summary bar at bottom of equity pane.
 */
export function renderBacktestSummary(
  ctx: CanvasRenderingContext2D,
  result: BacktestResultData,
  x: number,
  y: number,
  theme: ThemeColors,
  fontSize: number,
  locale?: import("../core/i18n").ChartLocale,
): void {
  const isPositive = result.totalReturnPercent >= 0;
  const color = isPositive ? theme.upColor : theme.downColor;

  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
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
    { label: locale?.pf ?? "PF", value: result.profitFactor.toFixed(2), color: theme.text },
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
