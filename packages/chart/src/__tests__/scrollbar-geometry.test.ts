/**
 * The scrollbar thumb stays inside its track. The window can
 * start past the last bar (a right margin or an overscroll bounce), and the
 * minimum thumb width can reach past the track's end; either drew and
 * hit-tested a thumb partly or wholly outside the track.
 */

import { describe, expect, it } from "vitest";
import { TimeScale } from "../core/scale";
import { MIN_THUMB_WIDTH, scrollbarThumbRect } from "../core/scrollbar-geometry";

const TRACK_X = 10;
const TRACK_W = 700;

function scale(from: number, to: number, total = 300): TimeScale {
  const ts = new TimeScale();
  ts.setWidth(800);
  ts.setTotalCount(total);
  ts.setVisibleLogicalRange(from, to);
  return ts;
}

function expectInsideTrack(r: { x: number; width: number }, trackW = TRACK_W) {
  expect(r.x).toBeGreaterThanOrEqual(TRACK_X);
  expect(r.x + r.width).toBeLessThanOrEqual(TRACK_X + trackW + 1e-9);
}

describe("scrollbarThumbRect", () => {
  it("is unchanged for a window inside the data", () => {
    const r = scrollbarThumbRect(scale(30, 180), TRACK_X, TRACK_W);
    expect(r).not.toBeNull();
    expect(r?.x).toBeCloseTo(TRACK_X + 0.1 * TRACK_W, 9);
    expect(r?.width).toBeCloseTo(0.5 * TRACK_W, 0);
  });

  it("stays inside the track when the window starts past the last bar", () => {
    const r = scrollbarThumbRect(scale(310, 340), TRACK_X, TRACK_W);
    expect(r).not.toBeNull();
    if (r) expectInsideTrack(r);
    expect(r?.width).toBe(MIN_THUMB_WIDTH);
    // A drag still anchors to the window's own position.
    expect(r?.startFrac).toBeGreaterThan(1);
  });

  it("keeps the minimum width inside the track at the end", () => {
    // One bar of 300 is visible: the 8px floor would run past the track.
    const r = scrollbarThumbRect(scale(299, 360), TRACK_X, TRACK_W);
    expect(r).not.toBeNull();
    if (r) expectInsideTrack(r);
    expect(r?.width).toBe(MIN_THUMB_WIDTH);
  });

  it("never exceeds a track narrower than the minimum width", () => {
    const r = scrollbarThumbRect(scale(299, 360), TRACK_X, 5);
    expect(r).not.toBeNull();
    if (r) expectInsideTrack(r, 5);
  });
});
