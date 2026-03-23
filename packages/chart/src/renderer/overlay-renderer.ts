/**
 * Overlay Renderer — Price line, signal markers, trade overlays.
 * Extracted from canvas-chart.ts for maintainability.
 */

import type { DataLayer } from "../core/data-layer";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, PaneRect, SignalMarker, ThemeColors, TradeMarker } from "../core/types";

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

  const label = price.toFixed(2);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const metrics = ctx.measureText(label);
  const padX = 6;
  const padY = 3;
  const labelW = metrics.width + padX * 2;
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
