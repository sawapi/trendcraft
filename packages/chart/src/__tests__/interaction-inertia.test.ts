// @vitest-environment happy-dom
/**
 * Unit tests for InertiaController — physics in isolation.
 *
 * happy-dom provides requestAnimationFrame; we drive it via vi.useFakeTimers
 * with `toFake: ['requestAnimationFrame', 'cancelAnimationFrame']` so each
 * `runAllTimers()` deterministically advances the loop frame-by-frame until
 * it terminates.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InertiaController } from "../core/interaction/inertia";
import type { PanInertiaState, ZoomInertiaState } from "../core/interaction/types";
import { TimeScale } from "../core/scale";

function makeTs(total = 500, visible = 100, startIdx = 100): TimeScale {
  const ts = new TimeScale();
  ts.setWidth(800);
  ts.setTotalCount(total);
  ts.setVisibleRange(startIdx, startIdx + visible);
  return ts;
}

function makePan(): PanInertiaState {
  return { velocity: 0, raf: null, lastTouchX: 0, lastTouchMoveTime: 0 };
}

function makeZoom(): ZoomInertiaState {
  return { velocity: 0, raf: null, lastTime: 0, anchorX: null };
}

describe("InertiaController.pan", () => {
  let ts: TimeScale;
  let pan: PanInertiaState;
  let zoom: ZoomInertiaState;
  let onUpdate: ReturnType<typeof vi.fn>;
  let inertia: InertiaController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    ts = makeTs();
    pan = makePan();
    zoom = makeZoom();
    onUpdate = vi.fn();
    inertia = new InertiaController(ts, pan, zoom, onUpdate);
  });
  afterEach(() => {
    inertia.dispose();
    vi.useRealTimers();
  });

  it("decays velocity by 0.92 per frame and stops at <0.5", () => {
    pan.velocity = 10;
    inertia.startPan();
    expect(pan.raf).not.toBe(null);
    vi.advanceTimersToNextFrame();
    expect(Math.abs(pan.velocity)).toBeCloseTo(10 * 0.92, 5);
    // Run to completion
    vi.runAllTimers();
    expect(pan.raf).toBe(null);
    expect(Math.abs(pan.velocity)).toBeLessThan(0.5);
  });

  it("does nothing when velocity below threshold and no overscroll", () => {
    pan.velocity = 0.3;
    inertia.startPan();
    vi.advanceTimersToNextFrame();
    expect(pan.raf).toBe(null);
  });

  it("springs back when overscrolled", () => {
    // Force overscroll by setting startIndex past the right edge
    ts.setStartIndexUnclamped(450); // total=500, visible=100, max=400 → overscroll=50
    expect(Math.abs(ts.overscroll)).toBeGreaterThan(0.1);
    pan.velocity = 0;
    inertia.startPan();
    vi.advanceTimersToNextFrame();
    // After one spring frame, raw position should have moved back toward clamp
    expect(ts.rawStartIndex).toBeLessThan(450);
    vi.runAllTimers();
    // Should snap to clamped edge
    expect(Math.abs(ts.overscroll)).toBeLessThan(0.5);
    expect(pan.raf).toBe(null);
  });

  it("stopPan cancels the loop without resetting velocity", () => {
    pan.velocity = 10;
    inertia.startPan();
    inertia.stopPan();
    expect(pan.raf).toBe(null);
    expect(pan.velocity).toBe(10);
  });
});

describe("InertiaController.zoom", () => {
  let ts: TimeScale;
  let pan: PanInertiaState;
  let zoom: ZoomInertiaState;
  let onUpdate: ReturnType<typeof vi.fn>;
  let inertia: InertiaController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    ts = makeTs();
    pan = makePan();
    zoom = makeZoom();
    onUpdate = vi.fn();
    inertia = new InertiaController(ts, pan, zoom, onUpdate);
  });
  afterEach(() => {
    inertia.dispose();
    vi.useRealTimers();
  });

  it("applies zoom factor each frame and decays by 0.9", () => {
    zoom.velocity = 0.05;
    zoom.anchorX = 400;
    const beforeSpacing = ts.barSpacing;
    inertia.startZoom();
    // Run one frame
    vi.advanceTimersToNextFrame();
    expect(zoom.velocity).toBeCloseTo(0.05 * 0.9, 5);
    expect(ts.barSpacing).not.toBe(beforeSpacing);
  });

  it("terminates at |velocity| < 0.0005 and clears anchor", () => {
    zoom.velocity = 0.001;
    zoom.anchorX = 400;
    inertia.startZoom();
    vi.runAllTimers();
    expect(zoom.raf).toBe(null);
    expect(zoom.anchorX).toBe(null);
  });

  it("stopZoom cancels and resets velocity to 0", () => {
    zoom.velocity = 0.05;
    zoom.anchorX = 400;
    inertia.startZoom();
    inertia.stopZoom();
    expect(zoom.raf).toBe(null);
    expect(zoom.velocity).toBe(0);
  });
});

describe("InertiaController.dispose", () => {
  it("cancels both loops", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    const ts = makeTs();
    const pan = makePan();
    const zoom = makeZoom();
    const inertia = new InertiaController(ts, pan, zoom, () => {});
    pan.velocity = 10;
    zoom.velocity = 0.05;
    inertia.startPan();
    inertia.startZoom();
    inertia.dispose();
    expect(pan.raf).toBe(null);
    expect(zoom.raf).toBe(null);
    vi.useRealTimers();
  });
});
