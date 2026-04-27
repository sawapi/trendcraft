import type { TimeScale } from "../scale";

/** Apply rubber-band dampening: diminishing returns past the edge. */
export function rubberBandDampen(timeScale: TimeScale): void {
  const over = timeScale.overscroll;
  if (over === 0) return;
  const maxStretch = timeScale.visibleCount * 0.15;
  const sign = over > 0 ? 1 : -1;
  const dampened = maxStretch * (1 - 1 / (1 + Math.abs(over) / maxStretch));
  timeScale.setStartIndexUnclamped(timeScale.clampedStartIndex + sign * dampened);
}
