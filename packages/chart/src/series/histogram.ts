/**
 * Histogram Series Renderer
 * Renders vertical bars for volume, MACD histogram, etc.
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, DataPoint, ThemeColors } from "../core/types";

export type HistogramRenderOptions = {
  /** Positive bar color */
  upColor: string;
  /** Negative bar color */
  downColor: string;
  /** Bar width as fraction of bar spacing (default: 0.6) */
  widthFraction?: number;
};

/**
 * Render volume bars colored by candle direction.
 */
export function renderVolume(
  ctx: CanvasRenderingContext2D,
  candles: readonly CandleData[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  theme: ThemeColors,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing * 0.6);
  const halfBar = barWidth / 2;

  for (let i = start; i < end && i < candles.length; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const x = timeScale.indexToX(i);
    const isUp = candle.close >= candle.open;
    const volY = priceScale.priceToY(candle.volume);
    const zeroY = priceScale.priceToY(0);

    ctx.fillStyle = isUp ? theme.volumeUp : theme.volumeDown;
    ctx.fillRect(x - halfBar, volY, barWidth, zeroY - volY);
  }
}

/**
 * Render a generic histogram (e.g., MACD histogram).
 * Bars above zero use upColor, bars below use downColor.
 */
export function renderHistogram(
  ctx: CanvasRenderingContext2D,
  values: readonly (number | null)[],
  timeScale: TimeScale,
  priceScale: PriceScale,
  options: HistogramRenderOptions,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const widthFraction = options.widthFraction ?? 0.6;
  const barWidth = Math.max(1, timeScale.barSpacing * widthFraction);
  const halfBar = barWidth / 2;
  const zeroY = priceScale.priceToY(0);

  for (let i = start; i < end && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;

    const x = timeScale.indexToX(i);
    const valY = priceScale.priceToY(val);

    ctx.fillStyle = val >= 0 ? options.upColor : options.downColor;
    const top = Math.min(valY, zeroY);
    const height = Math.max(1, Math.abs(valY - zeroY));
    ctx.fillRect(x - halfBar, top, barWidth, height);
  }
}

/** Compute volume range for visible candles */
export function volumeRange(
  candles: readonly CandleData[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let max = 0;
  for (let i = startIndex; i < endIndex && i < candles.length; i++) {
    const v = candles[i]?.volume;
    if (v !== undefined && v > max) max = v;
  }
  return [0, max];
}

/** Compute range for histogram values */
export function histogramRange(
  values: readonly (number | null)[],
  startIndex: number,
  endIndex: number,
): [number, number] {
  let min = 0;
  let max = 0;
  for (let i = startIndex; i < endIndex && i < values.length; i++) {
    const val = values[i];
    if (val === null || val === undefined) continue;
    if (val < min) min = val;
    if (val > max) max = val;
  }
  return [min, max];
}
