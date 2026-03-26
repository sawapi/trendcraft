/**
 * OHLC Bar Renderer — Traditional OHLC bars (vertical line + left/right ticks).
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

export function renderOhlcBars(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const tickWidth = Math.max(2, timeScale.candleWidth * 0.4);

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const x = timeScale.indexToX(i);
    const isUp = candle.close >= candle.open;
    const color = isUp ? theme.upColor : theme.downColor;

    const highY = priceScale.priceToY(candle.high);
    const lowY = priceScale.priceToY(candle.low);
    const openY = priceScale.priceToY(candle.open);
    const closeY = priceScale.priceToY(candle.close);

    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, timeScale.candleWidth * 0.15);

    // Vertical line (high to low)
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    // Left tick (open)
    ctx.beginPath();
    ctx.moveTo(x - tickWidth, openY);
    ctx.lineTo(x, openY);
    ctx.stroke();

    // Right tick (close)
    ctx.beginPath();
    ctx.moveTo(x, closeY);
    ctx.lineTo(x + tickWidth, closeY);
    ctx.stroke();
  }
}
