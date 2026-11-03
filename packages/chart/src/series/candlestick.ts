/**
 * Candlestick Series Renderer
 * Renders OHLCV candles with wicks and colored bodies.
 */

import { barLeft, oddPixelWidth } from "../core/draw-helper";
import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";
import { isFiniteOHLC } from "../core/validation";

export function renderCandlesticks(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
  /**
   * When provided, iterates `0..candles.length` and reads the screen x for
   * each from `indexToX(originalIndices[i])`. Used by the decimation path so
   * bucketed candles line up with non-decimated overlays on the same
   * timeScale.
   */
  originalIndices?: readonly number[] | Int32Array,
): void {
  const start = originalIndices ? 0 : timeScale.startIndex;
  const end = originalIndices ? candles.length : timeScale.endIndex;
  // Odd whole-pixel widths: the wick, the body and the crosshair share the
  // pixel column round(x), with the wick and crosshair in the body's middle.
  const bodyWidth = oddPixelWidth(timeScale.candleWidth);
  const wickWidth = oddPixelWidth(timeScale.candleWidth * 0.1);

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;
    // Skip candles with non-finite OHLC — canvas silently swallows draw
    // calls with NaN / Infinity coordinates, so a contaminated bar would
    // otherwise produce an invisible gap with no error.
    if (!isFiniteOHLC(candle)) continue;

    const x = timeScale.indexToX(originalIndices ? originalIndices[i] : i);
    const sx = Math.round(x) + 0.5; // snap to pixel grid for crisp 1px lines
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
    ctx.moveTo(sx, highY);
    ctx.lineTo(sx, lowY);
    ctx.stroke();

    // Body
    ctx.fillStyle = isUp ? theme.upColor : theme.downColor;
    const bodyLeft = barLeft(x, bodyWidth);
    ctx.fillRect(bodyLeft, bodyTop, bodyWidth, bodyHeight);

    // Body border for very small candles
    if (bodyHeight <= 1) {
      ctx.strokeStyle = isUp ? theme.upColor : theme.downColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bodyLeft, bodyTop);
      ctx.lineTo(bodyLeft + bodyWidth, bodyTop);
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
    // Same rule as the renderer: a bar it skips must not stretch the range.
    if (!c || !isFiniteOHLC(c)) continue;
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  return [min, max];
}
