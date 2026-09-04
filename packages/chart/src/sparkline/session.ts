import type { SparklineSession } from "./types";

/**
 * Breaks clamped to the session, sorted, and merged so that overlapping or
 * touching ones count as one.
 *
 * The single owner of "which stretches of this session are closed". Summing
 * unmerged breaks double-counts the overlap, which shortens the active
 * duration and stretches every pixel: two breaks of 30 and 10 minutes that
 * overlap by 10 made a 100-unit session look 60 units long, so `timeToX`
 * returned 113 for a session end on a 100px canvas — outside the [0, width]
 * range it documents.
 */
function normalizeBreaks(session: SparklineSession): Array<{ start: number; end: number }> {
  const clamped = (session.breaks ?? [])
    .map((b) => ({
      start: Math.max(b.start, session.start),
      end: Math.min(b.end, session.end),
    }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const merged: Array<{ start: number; end: number }> = [];
  for (const b of clamped) {
    const last = merged[merged.length - 1];
    if (last && b.start <= last.end) {
      if (b.end > last.end) last.end = b.end;
    } else {
      merged.push({ ...b });
    }
  }
  return merged;
}

/** Session length minus the time it is closed. `breaks` must be normalized. */
function activeMsOf(
  session: SparklineSession,
  breaks: ReadonlyArray<{ start: number; end: number }>,
): number {
  let breakDur = 0;
  for (const b of breaks) breakDur += b.end - b.start;
  return Math.max(0, session.end - session.start - breakDur);
}

/** Where a timestamp sits in a session: which active segment, and at what x. */
export type SessionPoint = {
  /**
   * Index of the active segment containing the time (0 = pre-first-break,
   * 1 = post-first-break, …), or -1 when the time is inside a break or
   * outside the session.
   */
  segment: number;
  /** Pixel position in [0, width], or null whenever `segment` is -1. */
  x: number | null;
};

/**
 * Pixel-space layout for a session. Distributes the canvas width into
 * one pixel range per active segment (gap-separated) and provides forward
 * (time → x) and inverse (x → time) lookups. Used by the sparkline
 * renderer/hover so visible break gaps stay consistent across both.
 *
 * Boundary convention — a break is OPEN at both ends, so `break.start` is the
 * last instant of the segment before it and `break.end` the first instant of
 * the segment after it. A feed that stamps bars at their close puts the last
 * pre-break bar at exactly `break.start` (11:30 for a JPX lunch break), and
 * `breakGap: 0` is documented as making that bar adjacent to the 12:30 one —
 * so it has to be a rendered pre-break point, not a break-internal one.
 * In pixel space the same convention makes the gap the OPEN interval
 * `(gapStart, gapStart + gapPx)`: both edge pixels carry data.
 *
 * `classify` is the single owner of that convention. `timeToX` and
 * `segmentIndexOf` are projections of it and cannot disagree with it; they
 * used to be separate walks and did — `timeToX(break.start)` returned a pixel
 * while `segmentIndexOf(break.start)` returned -1, so the same candle rendered
 * in candle mode and vanished in line mode.
 */
export type SessionLayout = {
  /** Total CSS pixel width. */
  width: number;
  /** Gap pixel width per break. */
  gapPx: number;
  /** Breaks inside the session, sorted and merged (overlaps count once). */
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
  /**
   * Segment index and pixel position in one pass. Prefer this over calling
   * `timeToX` and `segmentIndexOf` separately: it is the owner both of those
   * delegate to, and it walks the segments once instead of twice.
   */
  classify(t: number): SessionPoint;
};

/** Shared "no position" answer; frozen so a caller cannot mutate the sentinel. */
const OUTSIDE: SessionPoint = Object.freeze({ segment: -1, x: null });

export function buildSessionLayout(
  session: SparklineSession,
  width: number,
  breakGapPx: number,
): SessionLayout {
  const breaks = normalizeBreaks(session);
  const activeMs = activeMsOf(session, breaks);
  // The gaps have to fit on the canvas. Without this, a `breakGap` wider than
  // the canvas pushed segment offsets past `width` — `classify` returned x=500
  // on a 100px canvas — and the three lookups then disagreed about a pixel that
  // was not on the canvas at all.
  const requestedGapPx = Math.max(0, breakGapPx);
  const gapPx =
    breaks.length > 0 ? Math.min(requestedGapPx, width / breaks.length) : requestedGapPx;
  const totalGapPx = gapPx * breaks.length;
  const usablePx = Math.max(0, width - totalGapPx);
  const pxPerMs = activeMs > 0 ? usablePx / activeMs : 0;

  // One table of segment bounds in BOTH units, built once. The forward
  // (time → x) lookup, the inverse (x → time) lookup and the gap test all read
  // it, so none of them can describe the layout differently from the others —
  // they used to walk the geometry separately and disagree, both about which
  // side of a break `break.start` falls on and, on some width/gap
  // combinations, about whether the canvas's last pixel was inside a gap.
  const segments: Array<{ startMs: number; endMs: number; startPx: number; endPx: number }> = [];
  {
    const boundaries: number[] = [session.start];
    for (const b of breaks) boundaries.push(b.start, b.end);
    boundaries.push(session.end);
    // One active segment per break, plus one: `boundaries` holds 2n+2 entries
    // for n breaks. Deriving this as `(length - 1) / 2` gave n + 0.5, which no
    // integer `s` ever equals, so the pin below silently never fired.
    const count = boundaries.length / 2;
    let elapsedActiveMs = 0;
    for (let i = 0, s = 0; i < boundaries.length - 1; i += 2, s++) {
      const startMs = boundaries[i];
      const endMs = boundaries[i + 1];
      const rawStartPx = elapsedActiveMs * pxPerMs + s * gapPx;
      elapsedActiveMs += endMs - startMs;
      // The layout spans [0, width] by definition. Deriving the final edge
      // from the accumulated milliseconds instead lands ~1e-14 short on some
      // width/gap combinations (3 of 96 sampled), and the inverse lookup then
      // reported "in a gap" for the very pixel the forward lookup returned for
      // `session.end`.
      const isLast = s === count - 1;
      const endPx = isLast ? width : elapsedActiveMs * pxPerMs + s * gapPx;
      // A segment with no duration must occupy no pixels either. A break that
      // runs to `session.end` leaves exactly that: a zero-length trailing
      // segment whose pinned `endPx` was `width` while its `startPx` still
      // carried the accumulation's drift, so the pixel it reported for
      // `session.end` fell inside the gap that ended at the same place.
      const startPx = startMs === endMs ? endPx : rawStartPx;
      segments.push({ startMs, endMs, startPx, endPx });
    }
  }

  // Defined as a plain function, not a method: `timeToX` and `segmentIndexOf`
  // must not depend on `this`, or destructuring a layout would break them.
  const classify = (t: number): SessionPoint => {
    if (t < session.start || t > session.end) return OUTSIDE;
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s];
      // `<=` puts `t === break.start` in the segment that ENDS there.
      if (t <= seg.endMs) {
        // Snap at the edges rather than interpolating to them, so the pixel a
        // segment ends at is exactly the pixel the gap starts after.
        const x = t === seg.endMs ? seg.endPx : seg.startPx + (t - seg.startMs) * pxPerMs;
        return { segment: s, x };
      }
      // `t` is past this segment: it is inside the break that follows, unless
      // it has already reached the next segment's start.
      if (s + 1 < segments.length && t < segments[s + 1].startMs) return OUTSIDE;
    }
    return OUTSIDE;
  };

  return {
    width,
    gapPx,
    breaks,
    activeMs,
    usablePx,
    classify,
    timeToX: (t) => classify(t).x,
    segmentIndexOf: (t) => classify(t).segment,
    xToTime(x) {
      if (x < 0 || x > width) return null;
      for (let s = 0; s < segments.length; s++) {
        const seg = segments[s];
        if (x <= seg.endPx) {
          // Snap at the edges, and never divide by a zero scale: a session with
          // no active time collapses every segment to a point, and rejecting the
          // whole canvas for that used to make the inverse lookup disagree with
          // the forward one about pixels it had just produced.
          if (x === seg.endPx) return seg.endMs;
          if (pxPerMs === 0 || x <= seg.startPx) return seg.startMs;
          return seg.startMs + (x - seg.startPx) / pxPerMs;
        }
        if (s + 1 < segments.length && x < segments[s + 1].startPx) return null; // in a gap
      }
      return null;
    },
    isInBreakGap(x) {
      // Open at both edges: a gap runs between the pixel `classify` returns for
      // `break.start` and the one it returns for `break.end`, so both carry
      // data and only the interior is empty. Treating the lower edge as inside
      // the gap made hover return -1 for a candle painted at that very pixel.
      for (let s = 0; s + 1 < segments.length; s++) {
        if (x > segments[s].endPx && x < segments[s + 1].startPx) return true;
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
