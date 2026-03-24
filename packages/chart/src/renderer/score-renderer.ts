/**
 * Score Renderer — Visualizes per-bar scoring as background heatmap.
 * Green (high score / bullish) → Yellow (neutral) → Red (low score / bearish).
 */

import type { PriceScale, TimeScale } from "../core/scale";
import type { DataPoint, PaneRect } from "../core/types";

/**
 * Render score heatmap as colored background behind candlesticks.
 * Score 0-100: 0=red, 50=yellow, 100=green.
 */
export function renderScoreHeatmap(
  ctx: CanvasRenderingContext2D,
  scores: readonly DataPoint<number | null>[],
  timeScale: TimeScale,
  paneRect: PaneRect,
): void {
  const start = timeScale.startIndex;
  const end = timeScale.endIndex;
  const barWidth = Math.max(1, timeScale.barSpacing);

  ctx.save();
  ctx.beginPath();
  ctx.rect(paneRect.x, paneRect.y, paneRect.width, paneRect.height);
  ctx.clip();

  for (let i = start; i < end && i < scores.length; i++) {
    const point = scores[i];
    if (!point || point.value === null || point.value === undefined) continue;

    const score = Math.max(0, Math.min(100, point.value));
    const x = timeScale.indexToX(i);
    const color = scoreToColor(score);

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(x - barWidth / 2, paneRect.y, barWidth, paneRect.height);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Convert score (0-100) to heatmap color.
 * 0 → red, 50 → yellow, 100 → green.
 */
function scoreToColor(score: number): string {
  if (score <= 50) {
    // Red → Yellow
    const t = score / 50;
    const r = 239;
    const g = Math.round(83 + (255 - 83) * t);
    const b = Math.round(80 * (1 - t));
    return `rgb(${r},${g},${b})`;
  }
  // Yellow → Green
  const t = (score - 50) / 50;
  const r = Math.round(255 * (1 - t) + 38 * t);
  const g = Math.round(255 * (1 - t) + 166 * t);
  const b = Math.round(0 * (1 - t) + 154 * t);
  return `rgb(${r},${g},${b})`;
}
