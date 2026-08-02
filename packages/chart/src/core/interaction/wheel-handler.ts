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

    // A new wheel SESSION starts only when no settle timer is pending. A
    // direction flip inside the 150ms window is the same compound gesture —
    // resetting viewportMutated there would drop movement that preceded the
    // flip and skip its ratification (leaving a stale grant behind when the
    // flipped-to axis is fully absorbed by the zoom/scroll limits).
    if (ctx.wheel.timer === null) {
      ctx.wheel.viewportMutated = false;
      ctx.wheel.panVelocity = 0;
    }

    // Reset the direction lock immediately if the dominant axis flipped —
    // same session, new axis. The old axis's residual velocity must not
    // cross the flip: a stale horizontal panVelocity would otherwise be
    // handed to pan inertia as a "flick" when the timer fires after a
    // pan→zoom reversal.
    if (ctx.wheel.dir !== null && ctx.wheel.dir !== eventDir) {
      ctx.wheel.dir = null;
      ctx.zoom.anchorX = null;
      inertia.stopZoom();
      ctx.wheel.panVelocity = 0;
    }

    if (ctx.wheel.dir === null) {
      ctx.wheel.dir = eventDir;
    }

    if (ctx.wheel.timer) clearTimeout(ctx.wheel.timer);
    ctx.wheel.timer = setTimeout(() => {
      ctx.wheel.dir = null;
      // Settle side effects belong ONLY to a session that actually moved
      // the viewport (gated on the session's OWN flag, never DragState's —
      // a concurrent pointer drag owns that). A fully-absorbed session must
      // neither ratify NOR bounce: the overscroll it observes can be a
      // running range animation's transient interpolation state (the grant
      // already points at the animation's target), and bouncing that
      // hijacks the animation to the envelope edge.
      if (ctx.wheel.viewportMutated) {
        // Hand residual wheel velocity to the pan-inertia loop. Falls back
        // to bounce-back when overscrolled but not actively flicking.
        const flick = wheelInertiaEnabled && Math.abs(ctx.wheel.panVelocity) > 3;
        if (flick || Math.abs(timeScale.overscroll) > 0.1) {
          inertia.stopPan();
          ctx.pan.velocity = flick ? ctx.wheel.panVelocity : 0;
          inertia.startPan();
        } else if (ctx.zoom.raf === null) {
          // Session over with no inertia running: the gesture settles here —
          // the inertia loops ratify their own termination otherwise.
          timeScale.ratifySettledPosition();
        }
      }
      ctx.wheel.viewportMutated = false;
      ctx.wheel.panVelocity = 0;
      // Session boundary marker: the null timer is what lets the next wheel
      // event know it starts a NEW session (a mid-session direction flip
      // keeps the pending timer and therefore the session state above).
      ctx.wheel.timer = null;
    }, 150);

    let eventChanged = false;
    if (ctx.wheel.dir === "pan") {
      const beforePan = timeScale.rawStartIndex;
      const deltaBars = e.deltaX / timeScale.barSpacing;
      timeScale.scrollByUnclamped(deltaBars);
      eventChanged = timeScale.rawStartIndex !== beforePan;
      const now = performance.now();
      if (eventChanged) {
        const dt = now - ctx.wheel.lastPanTime;
        // pan.velocity convention: positive = reveal past (content moves right),
        // so invert deltaX which is positive when scrolling forward in time.
        const sample = dt > 0 && dt < 100 ? (-e.deltaX / dt) * 16 * sens : 0;
        if (dt > 0 && dt < 100) {
          ctx.wheel.panVelocity = ctx.wheel.panVelocity * 0.5 + sample * 0.5;
        } else {
          ctx.wheel.panVelocity = sample;
        }
      } else {
        // Mirror the zoom branch: a pan fully absorbed by the envelope
        // contributes no velocity — and wipes what's left. This is one of
        // two layers (the other: the timer gates its settle side effects
        // on viewportMutated): before them, residual velocity from
        // absorbed events started pan inertia at session end, whose
        // absorbed no-op run skipped the ratification a preceding real
        // movement (e.g. a zoom before a direction flip) still owed — or,
        // with an animation running, sprang to life the moment the
        // animation moved the viewport off the absorbing boundary and
        // cancelled it.
        ctx.wheel.panVelocity = 0;
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

      const beforeZoom = timeScale.barSpacing;
      timeScale.zoom(factor, ctx.zoom.anchorX);
      eventChanged = timeScale.barSpacing !== beforeZoom;

      const dt = now - ctx.zoom.lastTime;
      if (dt < 50) {
        ctx.zoom.velocity = ctx.zoom.velocity * 0.3 + zoomDelta * 0.7;
      } else {
        ctx.zoom.velocity = zoomDelta;
      }
      ctx.zoom.lastTime = now;

      // Skipped entirely when wheelInertia is off so the zoom stops the
      // moment the user lifts their fingers — and for a fully-absorbed
      // event (zoom cap): arming inertia with velocity that cannot act now
      // would leave a loop idling until something ELSE moves the spacing
      // off the cap, then fire the stale velocity into it.
      if (wheelInertiaEnabled && eventChanged) {
        inertia.startZoom();
      }
    }
    if (eventChanged) {
      ctx.wheel.viewportMutated = true;
      ctx.onViewportMutation();
    } else {
      // Fully absorbed by the zoom/scroll limits: nothing moved, so a
      // running range animation must survive this event.
      ctx.onUpdate();
    }
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
