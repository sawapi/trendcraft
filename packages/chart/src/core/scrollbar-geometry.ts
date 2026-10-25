/**
 * Scrollbar thumb geometry — single owner.
 *
 * The renderer draws this rect and the pointer hit-test grabs it. Both MUST
 * go through {@link scrollbarThumbRect}: deriving the geometry twice is how
 * the drawn thumb silently stops matching the grabbable one.
 */

import type { TimeScale } from "./scale";

/** Minimum thumb width in px so it stays grabbable on huge datasets. */
export const MIN_THUMB_WIDTH = 8;

export type ScrollbarThumb = {
  /** Left edge of the thumb in canvas px. */
  x: number;
  /** Thumb width in canvas px (already floored at {@link MIN_THUMB_WIDTH}). */
  width: number;
  /** Fraction of the track where the visible range starts — the quantity the
   *  drag logic anchors its grab offset to. */
  startFrac: number;
};

/**
 * Thumb rectangle along the scrollbar track for the current viewport, or
 * `null` when there is nothing to draw or grab (no data / zero-width track).
 */
export function scrollbarThumbRect(
  timeScale: TimeScale,
  trackX: number,
  trackWidth: number,
): ScrollbarThumb | null {
  const total = timeScale.totalCount;
  if (trackWidth <= 0 || total <= 0) return null;
  const startFrac = Math.max(0, timeScale.startIndex / total);
  const endFrac = Math.min(1, timeScale.endIndex / total);
  // The window can start past the last bar (a right margin, an overscroll
  // bounce), and the width floor can reach past the track's end: keep the
  // drawn and grabbable rect inside the track. startFrac stays the window's
  // own position, which is what a drag anchors to.
  const width = Math.min(
    trackWidth,
    Math.max(MIN_THUMB_WIDTH, Math.max(0, endFrac - startFrac) * trackWidth),
  );
  return {
    x: trackX + Math.min(startFrac * trackWidth, trackWidth - width),
    width,
    startFrac,
  };
}
