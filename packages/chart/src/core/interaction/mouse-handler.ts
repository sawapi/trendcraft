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
      ctx.beginScrollbarDrag(mx, sb);
      ctx.onUpdate();
      return;
    }

    ctx.viewState.isDragging = true;
    ctx.drag.startX = e.clientX;
    ctx.drag.startIndex = timeScale.startIndex;
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
      if (sb) ctx.applyScrollbarDrag(ctx.viewState.mouseX, sb);
      ctx.onUpdate();
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
      const dx = e.clientX - ctx.drag.startX;
      const deltaBars = -(dx / timeScale.barSpacing);
      const rawStart = ctx.drag.startIndex + deltaBars;
      timeScale.setStartIndexUnclamped(rawStart);
      rubberBandDampen(timeScale);
    }

    ctx.onUpdate();
  };

  const onMouseUp = () => {
    // Bounce-back if overscrolled via mouse drag. The inertia loop handles
    // both spring-back-from-overscroll and velocity-driven flick; here we
    // explicitly zero velocity because mouse drag doesn't track flick speed.
    if (ctx.viewState.isDragging && Math.abs(timeScale.overscroll) > 0.1) {
      inertia.stopPan();
      ctx.pan.velocity = 0;
      inertia.startPan();
    }
    ctx.viewState.isDragging = false;
    ctx.drag.scrollbarDragging = false;
    ctx.drag.scrollbarGrabOffsetFrac = null;
    ctx.paneResize.gap = null;
  };

  const onMouseLeave = () => {
    ctx.viewState.isDragging = false;
    ctx.drag.scrollbarDragging = false;
    ctx.drag.scrollbarGrabOffsetFrac = null;
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
