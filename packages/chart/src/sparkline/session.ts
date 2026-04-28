import type { SparklineSession } from "./types";

/**
 * Compute total active duration (session length minus break durations).
 */
export function activeDuration(session: SparklineSession): number {
  const total = session.end - session.start;
  if (!session.breaks || session.breaks.length === 0) return total;
  let breakDur = 0;
  for (const b of session.breaks) {
    const s = Math.max(b.start, session.start);
    const e = Math.min(b.end, session.end);
    if (e > s) breakDur += e - s;
  }
  return Math.max(0, total - breakDur);
}

/**
 * Active duration elapsed from session start to time `t` (excluding any
 * break time that falls before `t`). Returns null if `t` is outside the
 * session window or inside a break.
 */
export function activeElapsed(t: number, session: SparklineSession): number | null {
  if (t < session.start || t > session.end) return null;
  let elapsed = t - session.start;
  if (session.breaks) {
    for (const b of session.breaks) {
      if (t >= b.start && t < b.end) return null; // inside break
      if (t >= b.end) {
        const s = Math.max(b.start, session.start);
        const e = Math.min(b.end, session.end);
        if (e > s) elapsed -= e - s;
      }
    }
  }
  return Math.max(0, elapsed);
}

/**
 * Map an in-session time to its fractional position in [0, 1] across the
 * canvas width. Returns null when `t` is outside the session or inside a break.
 */
export function timeToFraction(t: number, session: SparklineSession): number | null {
  const elapsed = activeElapsed(t, session);
  if (elapsed === null) return null;
  const total = activeDuration(session);
  if (total <= 0) return null;
  return elapsed / total;
}

/**
 * Pixel-space layout for a session. Distributes the canvas width into
 * one pixel range per active segment (gap-separated) and provides forward
 * (time → x) and inverse (x → time) lookups. Used by the sparkline
 * renderer/hover so visible break gaps stay consistent across both.
 */
export type SessionLayout = {
  /** Total CSS pixel width. */
  width: number;
  /** Gap pixel width per break. */
  gapPx: number;
  /** Sorted breaks (filtered to ones inside the session). */
  breaks: Array<{ start: number; end: number }>;
  /** Active duration excluding breaks (ms). */
  activeMs: number;
  /** Pixel width devoted to data segments (= width - gaps). */
  usablePx: number;
  /**
   * Returns x in [0, width] for a given time, or null if the time is
   * outside the session window or inside a break.
   */
  timeToX(t: number): number | null;
  /**
   * Inverse: returns the closest session time for a given x. If x falls
   * inside a break gap, returns null.
   */
  xToTime(x: number): number | null;
  /** True if the given x falls inside a visual break gap. */
  isInBreakGap(x: number): boolean;
  /**
   * Index of the active segment containing `t` (0 = pre-first-break, 1 =
   * post-first-break, …). Returns -1 when `t` is in a break or outside
   * the session. Use to detect when consecutive data points cross a break.
   */
  segmentIndexOf(t: number): number;
};

export function buildSessionLayout(
  session: SparklineSession,
  width: number,
  breakGapPx: number,
): SessionLayout {
  const breaks = (session.breaks ?? [])
    .map((b) => ({
      start: Math.max(b.start, session.start),
      end: Math.min(b.end, session.end),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);
  const activeMs = activeDuration(session);
  const gapPx = Math.max(0, breakGapPx);
  const totalGapPx = gapPx * breaks.length;
  const usablePx = Math.max(0, width - totalGapPx);
  const pxPerMs = activeMs > 0 ? usablePx / activeMs : 0;

  const segmentBoundaries: number[] = [session.start];
  for (const b of breaks) {
    segmentBoundaries.push(b.start, b.end);
  }
  segmentBoundaries.push(session.end);

  return {
    width,
    gapPx,
    breaks,
    activeMs,
    usablePx,
    timeToX(t) {
      if (t < session.start || t > session.end) return null;
      // Walk segments: each odd-index segment in segmentBoundaries is a break.
      let elapsedActiveMs = 0;
      let crossedBreaks = 0;
      for (let i = 0; i < segmentBoundaries.length - 1; i += 2) {
        const segStart = segmentBoundaries[i];
        const segEnd = segmentBoundaries[i + 1];
        if (t <= segEnd) {
          elapsedActiveMs += t - segStart;
          return elapsedActiveMs * pxPerMs + crossedBreaks * gapPx;
        }
        elapsedActiveMs += segEnd - segStart;
        // If t is inside the upcoming break (i+1..i+2), null.
        const breakIdx = i / 2;
        if (breakIdx < breaks.length) {
          if (t < breaks[breakIdx].end) return null;
          crossedBreaks += 1;
        }
      }
      return null;
    },
    xToTime(x) {
      if (x < 0 || x > width || pxPerMs === 0) return null;
      // Walk segments by accumulating their pixel widths.
      let cursorPx = 0;
      for (let i = 0; i < segmentBoundaries.length - 1; i += 2) {
        const segStart = segmentBoundaries[i];
        const segEnd = segmentBoundaries[i + 1];
        const segMs = segEnd - segStart;
        const segPx = segMs * pxPerMs;
        if (x <= cursorPx + segPx) {
          return segStart + (x - cursorPx) / pxPerMs;
        }
        cursorPx += segPx;
        // Then a break gap (if any).
        const breakIdx = i / 2;
        if (breakIdx < breaks.length) {
          if (x < cursorPx + gapPx) return null; // inside gap
          cursorPx += gapPx;
        }
      }
      return null;
    },
    segmentIndexOf(t) {
      if (t < session.start || t > session.end) return -1;
      let idx = 0;
      for (const b of breaks) {
        if (t < b.start) return idx;
        if (t < b.end) return -1; // in break
        idx += 1;
      }
      return idx;
    },
    isInBreakGap(x) {
      let cursorPx = 0;
      for (let i = 0; i < segmentBoundaries.length - 1; i += 2) {
        const segMs = segmentBoundaries[i + 1] - segmentBoundaries[i];
        cursorPx += segMs * pxPerMs;
        const breakIdx = i / 2;
        if (breakIdx < breaks.length) {
          if (x >= cursorPx && x < cursorPx + gapPx) return true;
          cursorPx += gapPx;
        }
      }
      return false;
    },
  };
}

/** Resolve `breakGap` option to pixels. */
export function resolveBreakGapPx(breakGap: number | "auto" | undefined, width: number): number {
  if (breakGap === 0) return 0;
  if (typeof breakGap === "number") return Math.max(0, breakGap);
  // 'auto' (default)
  return Math.max(2, Math.round(width * 0.03));
}

/**
 * Inverse of {@link timeToFraction}: given a fractional position [0, 1],
 * return the corresponding session time. Skips over break ranges.
 */
export function fractionToTime(frac: number, session: SparklineSession): number {
  const total = activeDuration(session);
  let target = Math.max(0, Math.min(total, frac * total));
  let t = session.start;
  if (!session.breaks || session.breaks.length === 0) return t + target;
  // Walk forward through ordered breaks, consuming active duration.
  const sorted = [...session.breaks].sort((a, b) => a.start - b.start);
  for (const b of sorted) {
    const beforeBreak = b.start - t;
    if (target <= beforeBreak) return t + target;
    target -= beforeBreak;
    t = b.end;
  }
  return t + target;
}
