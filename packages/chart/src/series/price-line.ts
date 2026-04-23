/**
 * Price Line Renderer — Renders close prices as a continuous line.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, ThemeColors } from "../core/types";

export function renderPriceLineChart(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
  originalIndices?: readonly number[] | Int32Array,
): void {
  const start = originalIndices ? 0 : timeScale.startIndex;
  const end = originalIndices ? candles.length : timeScale.endIndex;

  ctx.strokeStyle = theme.upColor;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  let drawing = false;
  ctx.beginPath();
  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const x = timeScale.indexToX(originalIndices ? originalIndices[i] : i);
    const y = priceScale.priceToY(candle.close);

    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}
