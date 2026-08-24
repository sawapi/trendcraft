/**
 * Mouse interaction handlers — mousedown / mousemove / mouseup / mouseleave.
 *
 * Owns: pan drag, scrollbar drag (delegates to ctx helpers), pane-resize gap drag,
 * crosshair tracking, active-pane detection, mouse-up bounce-back trigger.
 */

import type { InertiaController } from "./inertia";
import type { InteractionContext } from "./types";
import { rubberBandDampen } from "./utils";

export function attachMouseHandlers(
  ctx: InteractionContext,
  inertia: InertiaController,
): () => void {
  const { el, timeScale, panes, scrollbar, gapAtY, resizePanes } = ctx;

  const onMouseDown = (e: MouseEvent) => {
    el.focus();
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (gapAtY) {
      const gap = gapAtY(my);
      if (gap !== null) {
        ctx.paneResize.gap = gap;
        ctx.paneResize.startY = e.clientY;
        return;
      }
    }

    const sb = scrollbar();
    if (sb && my >= sb.y && my <= sb.y + sb.height) {
      // A track press jumps the viewport; a thumb grab does not. Track the
      // actual change so releasing an untouched thumb doesn't ratify.
      ctx.drag.viewportMutated = false;
      const before = timeScale.rawStartIndex;
      ctx.beginScrollbarDrag(mx, sb);
      if (timeScale.rawStartIndex !== before) {
        ctx.drag.viewportMutated = true;
        ctx.onViewportMutation(); // track press jumped the viewport
      } else {
        ctx.onUpdate(); // thumb grab: nothing moved yet
      }
      return;
    }

    ctx.viewState.isDragging = true;
    ctx.drag.viewportMutated = false; // becomes true only if the drag moves
    ctx.drag.startX = e.clientX;
    // Raw (fractional) start: the floored getter would snap the viewport by
    // the fractional part on the first pixel of drag — a resting fractional
    // position is the norm after setVisibleLogicalRange.
    ctx.drag.startIndex = timeScale.rawStartIndex;
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    ctx.viewState.mouseX = e.clientX - rect.left;
    ctx.viewState.mouseY = e.clientY - rect.top;

    if (ctx.paneResize.gap !== null && resizePanes) {
      const delta = e.clientY - ctx.paneResize.startY;
      resizePanes(ctx.paneResize.gap, delta);
      ctx.paneResize.startY = e.clientY;
      ctx.onUpdate();
      return;
    }

    if (gapAtY) {
      const gap = gapAtY(ctx.viewState.mouseY);
      el.style.cursor = gap !== null ? "ns-resize" : "crosshair";
    }

    if (ctx.drag.scrollbarDragging) {
      const sb = scrollbar();
      const before = timeScale.rawStartIndex;
      if (sb) ctx.applyScrollbarDrag(ctx.viewState.mouseX, sb);
      if (timeScale.rawStartIndex !== before) {
        ctx.drag.viewportMutated = true;
        ctx.onViewportMutation();
      } else {
        ctx.onUpdate();
      }
      return;
    }

    const currentPanes = panes();
    ctx.viewState.activePaneId = null;
    for (const pane of currentPanes) {
      if (ctx.viewState.mouseY >= pane.y && ctx.viewState.mouseY < pane.y + pane.height) {
        ctx.viewState.activePaneId = pane.id;
        break;
      }
    }

    ctx.viewState.crosshairIndex = timeScale.xToIndex(ctx.viewState.mouseX);

    if (ctx.viewState.isDragging) {
      const before = timeScale.rawStartIndex;
      const dx = e.clientX - ctx.drag.startX;
      const deltaBars = -(dx / timeScale.barSpacing);
      const rawStart = ctx.drag.startIndex + deltaBars;
      timeScale.setStartIndexUnclamped(rawStart);
      rubberBandDampen(timeScale);
      if (timeScale.rawStartIndex !== before) {
        ctx.drag.viewportMutated = true;
        ctx.onViewportMutation();
      } else {
        ctx.onUpdate(); // zero-delta move event: repaint only
      }
      return;
    }

    // Plain hover (crosshair only) — must not cancel a running range animation
    ctx.onUpdate();
  };

  // Shared gesture-end: mouseup AND a mouseleave that interrupts a drag.
  // Releasing the button outside the canvas never delivers mouseup here, so
  // without this the drag's grant/overscroll would go unresolved — leaving
  // a stale envelope (a consumed margin re-enterable without resistance)
  // and, when overscrolled, no bounce-back.
  const endDragGesture = () => {
    // Only a gesture that actually MOVED the viewport settles the clamp
    // envelope: a plain click (mousedown+up without movement) or an
    // untouched scrollbar thumb must not dissolve an in-bounds grant.
    if (ctx.drag.viewportMutated) {
      // Bounce-back if overscrolled via mouse drag. The inertia loop
      // handles both spring-back and velocity flick; velocity is zeroed
      // because mouse drag doesn't track flick speed.
      if (ctx.viewState.isDragging && Math.abs(timeScale.overscroll) > 0.1) {
        inertia.stopPan();
        ctx.pan.velocity = 0;
        inertia.startPan();
      } else {
        // Gesture settles right here (no bounce/inertia will follow):
        // ratify the resting position into the clamp envelope.
        timeScale.ratifySettledPosition();
      }
    }
    ctx.drag.viewportMutated = false;
    ctx.viewState.isDragging = false;
    ctx.endScrollbarDrag();
    ctx.paneResize.gap = null;
  };

  const onMouseUp = () => {
    endDragGesture();
  };

  const onMouseLeave = () => {
    endDragGesture();
    // Plain hover exit: clear the crosshair and repaint (never a
    // viewport mutation — must not cancel a running range animation).
    ctx.viewState.crosshairIndex = null;
    ctx.viewState.activePaneId = null;
    ctx.onUpdate();
  };

  el.addEventListener("mousedown", onMouseDown);
  el.addEventListener("mousemove", onMouseMove);
  el.addEventListener("mouseup", onMouseUp);
  el.addEventListener("mouseleave", onMouseLeave);

  return () => {
    el.removeEventListener("mousedown", onMouseDown);
    el.removeEventListener("mousemove", onMouseMove);
    el.removeEventListener("mouseup", onMouseUp);
    el.removeEventListener("mouseleave", onMouseLeave);
  };
}
