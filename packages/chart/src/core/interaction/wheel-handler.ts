/**
 * Wheel interaction handler — pan / zoom + gesture direction lock + inertia handoff.
 *
 * Direction lock: holds "pan" or "zoom" for ~150ms after the last wheel event,
 * but re-evaluates when the dominant axis flips so users can quickly switch.
 *
 * Inertia handoff: when the gesture lock expires, residual horizontal pan
 * velocity is fed into the shared pan-inertia loop so trackpad flicks
 * decelerate naturally instead of stopping dead. Zoom inertia is started on
 * each frame and cancelled by the next wheel event if the gesture continues.
 */

import type { InertiaController } from "./inertia";
import type { InteractionContext } from "./types";

export function attachWheelHandlers(
  ctx: InteractionContext,
  inertia: InertiaController,
): () => void {
  const { el, timeScale, sens, wheelInertiaEnabled } = ctx;

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // ctrlKey indicates trackpad pinch — always treat as zoom
    const eventDir: "pan" | "zoom" = e.ctrlKey
      ? "zoom"
      : Math.abs(e.deltaX) > Math.abs(e.deltaY)
        ? "pan"
        : "zoom";

    // Reset lock immediately if direction flipped
    if (ctx.wheel.dir !== null && ctx.wheel.dir !== eventDir) {
      ctx.wheel.dir = null;
      ctx.zoom.anchorX = null;
      inertia.stopZoom();
    }

    if (ctx.wheel.dir === null) ctx.wheel.dir = eventDir;

    if (ctx.wheel.timer) clearTimeout(ctx.wheel.timer);
    ctx.wheel.timer = setTimeout(() => {
      ctx.wheel.dir = null;
      // Hand residual wheel velocity to the pan-inertia loop. Falls back to
      // bounce-back when overscrolled but not actively flicking.
      const flick = wheelInertiaEnabled && Math.abs(ctx.wheel.panVelocity) > 3;
      if (flick || Math.abs(timeScale.overscroll) > 0.1) {
        inertia.stopPan();
        ctx.pan.velocity = flick ? ctx.wheel.panVelocity : 0;
        inertia.startPan();
      }
      ctx.wheel.panVelocity = 0;
    }, 150);

    if (ctx.wheel.dir === "pan") {
      const deltaBars = e.deltaX / timeScale.barSpacing;
      timeScale.scrollByUnclamped(deltaBars);
      const now = performance.now();
      const dt = now - ctx.wheel.lastPanTime;
      // pan.velocity convention: positive = reveal past (content moves right),
      // so invert deltaX which is positive when scrolling forward in time.
      const sample = dt > 0 && dt < 100 ? (-e.deltaX / dt) * 16 * sens : 0;
      if (dt > 0 && dt < 100) {
        ctx.wheel.panVelocity = ctx.wheel.panVelocity * 0.5 + sample * 0.5;
      } else {
        ctx.wheel.panVelocity = sample;
      }
      ctx.wheel.lastPanTime = now;
    } else {
      // Zoom: proportional to deltaY magnitude for smooth trackpad support
      const clampedDelta = Math.max(-50, Math.min(50, e.deltaY));
      const zoomDelta = e.ctrlKey ? clampedDelta * 0.01 : (clampedDelta / 500) * sens;
      const factor = 1 - zoomDelta;

      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      // Lock anchor on first zoom event
      if (ctx.zoom.anchorX === null) ctx.zoom.anchorX = mouseX;

      const now = performance.now();

      // If inertia is running, absorb its velocity and stop it
      if (ctx.zoom.raf !== null) {
        cancelAnimationFrame(ctx.zoom.raf);
        ctx.zoom.raf = null;
      }

      timeScale.zoom(factor, ctx.zoom.anchorX);

      const dt = now - ctx.zoom.lastTime;
      if (dt < 50) {
        ctx.zoom.velocity = ctx.zoom.velocity * 0.3 + zoomDelta * 0.7;
      } else {
        ctx.zoom.velocity = zoomDelta;
      }
      ctx.zoom.lastTime = now;

      // Skipped entirely when wheelInertia is off so the zoom stops the moment
      // the user lifts their fingers.
      if (wheelInertiaEnabled) {
        inertia.startZoom();
      }
    }
    ctx.onUpdate();
  };

  el.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    if (ctx.wheel.timer) {
      clearTimeout(ctx.wheel.timer);
      ctx.wheel.timer = null;
    }
    el.removeEventListener("wheel", onWheel);
  };
}
