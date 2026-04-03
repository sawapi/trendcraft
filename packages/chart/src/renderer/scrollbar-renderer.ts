/**
 * Scrollbar Renderer — Minimap-style scrollbar showing visible range within full dataset.
 */

import type { TimeScale } from "../core/scale";
import type { ThemeColors } from "../core/types";

/**
 * Render a scrollbar showing the visible range within the total dataset.
 */
export function renderScrollbar(
  ctx: CanvasRenderingContext2D,
  timeScale: TimeScale,
  x: number,
  y: number,
  width: number,
  height: number,
  theme: ThemeColors,
): void {
  if (width <= 0 || height <= 0 || timeScale.totalCount <= 0) return;

  // Background
  ctx.fillStyle = theme.background;
  ctx.fillRect(x, y, width, height);

  // Top border
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + width, y + 0.5);
  ctx.stroke();

  // Track
  const trackPad = 2;
  const trackY = y + trackPad;
  const trackH = height - trackPad * 2;

  ctx.fillStyle = theme.grid;
  ctx.fillRect(x, trackY, width, trackH);

  // Thumb (visible range)
  const total = timeScale.totalCount;
  const startFrac = Math.max(0, timeScale.startIndex / total);
  const endFrac = Math.min(1, timeScale.endIndex / total);

  const thumbX = x + startFrac * width;
  const thumbW = Math.max(8, (endFrac - startFrac) * width);

  ctx.fillStyle = theme.textSecondary;
  ctx.globalAlpha = 0.4;
  ctx.fillRect(thumbX, trackY, thumbW, trackH);
  ctx.globalAlpha = 1;

  // Thumb borders
  ctx.strokeStyle = theme.textSecondary;
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(thumbX + 0.5, trackY + 0.5, thumbW - 1, trackH - 1);
  ctx.globalAlpha = 1;
}

/**
 * Check if a point is within the scrollbar area and convert to target index.
 */
export function scrollbarHitTest(
  mouseX: number,
  mouseY: number,
  x: number,
  y: number,
  width: number,
  height: number,
  timeScale: TimeScale,
): number | null {
  if (mouseY < y || mouseY > y + height) return null;
  if (mouseX < x || mouseX > x + width) return null;

  const frac = (mouseX - x) / width;
  const targetCenter = Math.round(frac * timeScale.totalCount);
  return Math.max(0, targetCenter - Math.floor(timeScale.visibleCount / 2));
}
