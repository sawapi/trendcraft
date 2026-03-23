/**
 * Candlestick Series Renderer
 * Renders OHLCV candles with wicks and colored bodies.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

export function renderCandlesticks(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const candleWidth = timeScale.candleWidth;
  const halfCandle = candleWidth / 2;
  const wickWidth = Math.max(1, candleWidth * 0.1);

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const x = timeScale.indexToX(i);
    const isUp = candle.close >= candle.open;

    const openY = priceScale.priceToY(candle.open);
    const closeY = priceScale.priceToY(candle.close);
    const highY = priceScale.priceToY(candle.high);
    const lowY = priceScale.priceToY(candle.low);

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(1, Math.abs(closeY - openY));

    // Wick
    ctx.strokeStyle = isUp ? theme.upWick : theme.downWick;
    ctx.lineWidth = wickWidth;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    // Body
    ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
    ctx.fillRect(x - halfCandle, bodyTop, candleWidth, bodyHeight);

    // Body border for very small candles
    if (bodyHeight <= 1) {
      ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - halfCandle, bodyTop);
      ctx.lineTo(x + halfCandle, bodyTop);
      ctx.stroke();
    }
  }
}

/** Compute price range for visible candles */
export function candlePriceRange(
  candles: readonly CandleData[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = startIndex; i < endIndex && i < candles.length; i++) {
    const c = candles[i];
    if (!c) continue;
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return [min, max];
}
