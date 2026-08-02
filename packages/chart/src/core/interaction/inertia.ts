/**
 * InertiaController — owns the pan/zoom inertia animation loops.
 *
 * Both loops were previously inlined into `Viewport.attach()` and shared
 * mutable state with the event handlers. They're consolidated here so the
 * physics (friction, bounce-back, velocity blending) is testable in isolation
 * and the event handlers only see a small imperative API.
 *
 * Pan-inertia behavior (preserved from the original implementation):
 *   - When `overscroll` exceeds 0.1 bars, the loop springs back toward
 *     `clampedStartIndex` with a stiffness of 0.2 and snaps when within 0.5
 *     bars of the target. Velocity is held at 0 during bounce-back.
 *   - Otherwise the loop applies `velocity / barSpacing` per frame and decays
 *     velocity by 0.92 each frame; it stops when |velocity| < 0.5.
 *
 * Zoom-inertia behavior:
 *   - Friction 0.9 per frame; loop terminates when |velocity| < 0.0005 and
 *     clears the anchor so the next gesture re-anchors on its first event.
 */

import type { TimeScale } from "../scale";
import type { PanInertiaState, ZoomInertiaState } from "./types";

export class InertiaController {
  /** True once the current pan/zoom inertia RUN actually moved the scale.
   *  Unchanged (absorbed) frames neither notify the mutation channel nor,
   *  at termination, ratify — an inertia run fully absorbed by the zoom
   *  cap or clamp envelope is a no-op gesture. */
  private panMoved = false;
  private zoomMoved = false;

  constructor(
    private readonly timeScale: TimeScale,
    private readonly pan: PanInertiaState,
    private readonly zoom: ZoomInertiaState,
    private readonly onUpdate: () => void,
  ) {}

  /** Begin pan inertia / bounce-back. Caller sets `pan.velocity` first. */
  startPan(): void {
    this.cancelPanFrame();
    this.panMoved = false;
    this.pan.raf = requestAnimationFrame(this.runPan);
  }

  /** Cancel pan inertia loop. Velocity is preserved (set explicitly to reset). */
  stopPan(): void {
    this.cancelPanFrame();
  }

  /**
   * Begin zoom inertia. Caller sets `zoom.velocity` and `zoom.anchorX` first.
   * If a previous zoom-inertia loop is running, its RAF is cancelled but the
   * caller-supplied velocity is preserved — this is what enables velocity
   * blending across consecutive wheel events.
   */
  startZoom(): void {
    this.cancelZoomFrame();
    this.zoomMoved = false;
    this.zoom.raf = requestAnimationFrame(this.runZoom);
  }

  /** Cancel zoom inertia loop and reset velocity. */
  stopZoom(): void {
    this.cancelZoomFrame();
    this.zoom.velocity = 0;
  }

  private cancelPanFrame(): void {
    if (this.pan.raf !== null) {
      cancelAnimationFrame(this.pan.raf);
      this.pan.raf = null;
    }
  }

  private cancelZoomFrame(): void {
    if (this.zoom.raf !== null) {
      cancelAnimationFrame(this.zoom.raf);
      this.zoom.raf = null;
    }
  }

  /** Cancel both loops — for use by detach() / cancel hotkey. */
  dispose(): void {
    this.stopPan();
    this.stopZoom();
  }

  // --- private loops -----------------------------------------------------

  private runPan = (): void => {
    const ts = this.timeScale;
    const over = ts.overscroll;

    if (Math.abs(over) > 0.1) {
      // Bounce-back: spring toward clamped position (always a real move —
      // the overscroll guard guarantees a nonzero spring)
      const target = ts.clampedStartIndex;
      const raw = ts.rawStartIndex;
      const springForce = (target - raw) * 0.2;
      ts.setStartIndexUnclamped(raw + springForce);
      this.pan.velocity = 0;
      this.panMoved = true;

      if (Math.abs(ts.overscroll) < 0.5) {
        ts.setStartIndexUnclamped(ts.clampedStartIndex);
        this.pan.raf = null;
        ts.ratifySettledPosition(); // bounce settled — envelope tracks the rest
        this.onUpdate();
        return;
      }
      this.onUpdate();
      this.pan.raf = requestAnimationFrame(this.runPan);
      return;
    }

    if (Math.abs(this.pan.velocity) < 0.5) {
      this.pan.raf = null;
      // Only a run that actually moved settles the envelope.
      if (this.panMoved) ts.ratifySettledPosition();
      return;
    }
    const before = ts.rawStartIndex;
    const deltaBars = -this.pan.velocity / ts.barSpacing;
    ts.scrollByUnclamped(deltaBars);
    this.pan.velocity *= 0.92;
    if (ts.rawStartIndex !== before) {
      this.panMoved = true;
      this.onUpdate();
      this.pan.raf = requestAnimationFrame(this.runPan);
      return;
    }
    // Fully absorbed frame: TERMINATE instead of decaying silently. A loop
    // idling with residual velocity is a trap — the moment anything moves
    // the scale off the absorbing limit (e.g. a programmatic animation
    // starts), the stale velocity would spring back to life and cancel it.
    this.pan.raf = null;
    if (this.panMoved) ts.ratifySettledPosition();
  };

  private runZoom = (): void => {
    if (Math.abs(this.zoom.velocity) < 0.0005) {
      this.zoom.raf = null;
      this.zoom.anchorX = null;
      // Only a run that actually zoomed settles the envelope: a run fully
      // absorbed at the zoom cap is a no-op gesture.
      if (this.zoomMoved) this.timeScale.ratifySettledPosition();
      return;
    }
    const before = this.timeScale.barSpacing;
    const factor = 1 - this.zoom.velocity;
    this.timeScale.zoom(factor, this.zoom.anchorX ?? undefined);
    this.zoom.velocity *= 0.9;
    if (this.timeScale.barSpacing !== before) {
      this.zoomMoved = true;
      this.onUpdate();
      this.zoom.raf = requestAnimationFrame(this.runZoom);
      return;
    }
    // Fully absorbed frame (zoom cap): terminate — see runPan for why a
    // silently idling loop with residual velocity is dangerous.
    this.zoom.raf = null;
    this.zoom.anchorX = null;
    this.zoom.velocity = 0;
    if (this.zoomMoved) this.timeScale.ratifySettledPosition();
  };
}
