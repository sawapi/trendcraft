/**
 * Marker Renderer — signal arrows and trade overlays.
 *
 * Part of the optional markers feature (`registerMarkers`): only
 * `src/features/markers.ts` imports this module, so the core bundle does not
 * carry it.
 */

import type { DataLayer } from "../core/data-layer";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, PaneRect, SignalMarker, TradeMarker } from "../core/types";
import { tradeSpan } from "./trade-span";

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
    // Skip trades outside the loaded candles; clip one crossing an edge
    const span = tradeSpan(dataLayer, trade.entryTime, trade.exitTime);
    if (!span) continue;

    const isWin = (trade.returnPercent ?? 0) >= 0;
    const x1 = timeScale.indexToX(span.entryIdx);
    const x2 = timeScale.indexToX(span.exitIdx);
    ctx.fillStyle = isWin ? "rgba(38,166,154,0.08)" : "rgba(239,83,80,0.08)";
    ctx.fillRect(x1, mainPane.y, x2 - x1, mainPane.height);

    const entryY = ps.priceToY(trade.entryPrice) + mainPane.y;
    if (span.entryInRange) {
      ctx.fillStyle = "#2196F3";
      ctx.beginPath();
      ctx.arc(x1, entryY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    const exitY = ps.priceToY(trade.exitPrice) + mainPane.y;
    if (span.exitInRange) {
      ctx.fillStyle = isWin ? "#26a69a" : "#ef5350";
      ctx.beginPath();
      ctx.arc(x2, exitY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!span.entryInRange || !span.exitInRange) continue;

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
