/**
 * Hit test utilities for drawing tools
 */

import type { Drawing } from "../types";

const HIT_THRESHOLD = 8; // pixels

type CoordConverter = (dataPoint: [number, number]) => number[];

/**
 * Calculate distance from a point to a line segment
 */
function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Test if a pixel coordinate hits any drawing
 */
export function hitTestDrawings(
  drawings: Drawing[],
  pixelX: number,
  pixelY: number,
  convertToPixel: CoordConverter,
  chartWidth: number,
): Drawing | null {
  // Test in reverse order (topmost drawing first)
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    if (!d.visible) continue;

    if (isHit(d, pixelX, pixelY, convertToPixel, chartWidth)) {
      return d;
    }
  }
  return null;
}

function isHit(
  d: Drawing,
  px: number,
  py: number,
  toPixel: CoordConverter,
  chartWidth: number,
): boolean {
  switch (d.type) {
    case "hline": {
      const [, hlineY] = toPixel([0, d.price]);
      return Math.abs(py - hlineY) < HIT_THRESHOLD;
    }
    case "trendline": {
      const p1 = toPixel([d.point1.dateIndex, d.point1.price]);
      const p2 = toPixel([d.point2.dateIndex, d.point2.price]);
      return pointToSegmentDistance(px, py, p1[0], p1[1], p2[0], p2[1]) < HIT_THRESHOLD;
    }
    case "rect": {
      const r1 = toPixel([d.point1.dateIndex, d.point1.price]);
      const r2 = toPixel([d.point2.dateIndex, d.point2.price]);
      const minX = Math.min(r1[0], r2[0]);
      const maxX = Math.max(r1[0], r2[0]);
      const minY = Math.min(r1[1], r2[1]);
      const maxY = Math.max(r1[1], r2[1]);
      return px >= minX - 4 && px <= maxX + 4 && py >= minY - 4 && py <= maxY + 4;
    }
    case "text": {
      const tp = toPixel([d.dateIndex, d.price]);
      // Rough bounding box: fontSize height, estimated width
      const w = d.text.length * d.fontSize * 0.6;
      const h = d.fontSize * 1.4;
      return px >= tp[0] - 4 && px <= tp[0] + w + 4 && py >= tp[1] - h && py <= tp[1] + 4;
    }
    case "fibRetracement": {
      const f1 = toPixel([d.point1.dateIndex, d.point1.price]);
      const f2 = toPixel([d.point2.dateIndex, d.point2.price]);
      const priceDiff = d.point2.price - d.point1.price;
      for (const level of d.levels) {
        const levelPrice = d.point1.price + priceDiff * level;
        const lp = toPixel([0, levelPrice]);
        if (Math.abs(py - lp[1]) < HIT_THRESHOLD) {
          // Check X range
          const minX = Math.min(f1[0], f2[0]) - 20;
          const maxX = Math.max(chartWidth, Math.max(f1[0], f2[0]) + 20);
          if (px >= minX && px <= maxX) return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}
