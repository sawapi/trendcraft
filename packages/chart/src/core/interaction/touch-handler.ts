/**
 * Touch interaction handlers — single-touch pan, double-tap, long-press
 * crosshair lock, two-finger pinch zoom.
 */

import type { InertiaController } from "./inertia";
import type { InteractionContext } from "./types";
import { rubberBandDampen } from "./utils";

export function attachTouchHandlers(
  ctx: InteractionContext,
  inertia: InertiaController,
): () => void {
  const { el, timeScale, scrollbar, sens, longPressEnabled } = ctx;

  const onTouchStart = (e: TouchEvent) => {
    inertia.stopPan();
    if (e.touches.length === 1) {
      const now = Date.now();
      const touch = e.touches[0];

      // Scrollbar hit on touch
      const rect = el.getBoundingClientRect();
      const touchLocalX = touch.clientX - rect.left;
      const touchLocalY = touch.clientY - rect.top;
      const sb = scrollbar();
      if (sb && touchLocalY >= sb.y && touchLocalY <= sb.y + sb.height) {
        ctx.beginScrollbarDrag(touchLocalX, sb);
        ctx.onUpdate();
        return;
      }

      // Double-tap detection
      if (now - ctx.touch.lastTapTime < 300) {
        timeScale.fitContent();
        ctx.onUpdate();
        ctx.touch.lastTapTime = 0;
        return;
      }
      ctx.touch.lastTapTime = now;

      // Long-press detection (disabled when option is off)
      if (longPressEnabled) {
        ctx.touch.longPressTimer = setTimeout(() => {
          ctx.touch.longPressCrosshairLocked = true;
          const r = el.getBoundingClientRect();
          ctx.viewState.crosshairIndex = timeScale.xToIndex(touch.clientX - r.left);
          ctx.onUpdate();
        }, 500);
      }

      ctx.viewState.isDragging = true;
      ctx.pan.lastTouchX = touch.clientX;
      ctx.pan.lastTouchMoveTime = now;
      ctx.pan.velocity = 0;
      ctx.drag.startX = ctx.pan.lastTouchX;
      ctx.drag.startIndex = timeScale.startIndex;
    } else if (e.touches.length === 2) {
      // Switch from pan to pinch: cancel drag state
      if (ctx.touch.longPressTimer) {
        clearTimeout(ctx.touch.longPressTimer);
        ctx.touch.longPressTimer = null;
      }
      ctx.viewState.isDragging = false;
      ctx.touch.longPressCrosshairLocked = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      ctx.touch.lastDist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (ctx.touch.longPressTimer) {
      clearTimeout(ctx.touch.longPressTimer);
      ctx.touch.longPressTimer = null;
    }

    // Scrollbar drag (touch)
    if (ctx.drag.scrollbarDragging && e.touches.length === 1) {
      const sbTouch = e.touches[0];
      const rect = el.getBoundingClientRect();
      const localX = sbTouch.clientX - rect.left;
      const sb = scrollbar();
      if (sb) ctx.applyScrollbarDrag(localX, sb);
      ctx.onUpdate();
      return;
    }

    if (e.touches.length === 1 && ctx.viewState.isDragging) {
      const now = Date.now();
      const currentX = e.touches[0].clientX;

      const dt = now - ctx.pan.lastTouchMoveTime;
      if (dt > 0) {
        ctx.pan.velocity = ((currentX - ctx.pan.lastTouchX) / dt) * 16 * sens;
      }
      ctx.pan.lastTouchX = currentX;
      ctx.pan.lastTouchMoveTime = now;

      if (ctx.touch.longPressCrosshairLocked) {
        const rect = el.getBoundingClientRect();
        ctx.viewState.crosshairIndex = timeScale.xToIndex(currentX - rect.left);
        ctx.onUpdate();
        return;
      }

      const dx = currentX - ctx.drag.startX;
      const deltaBars = -(dx / timeScale.barSpacing);
      const rawStart = ctx.drag.startIndex + deltaBars;
      timeScale.setStartIndexUnclamped(rawStart);
      rubberBandDampen(timeScale);
      ctx.onUpdate();
    } else if (e.touches.length === 2) {
      const tdx = e.touches[0].clientX - e.touches[1].clientX;
      const tdy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (ctx.touch.lastDist > 0 && dist > 0) {
        // Amplify pinch: double the zoom delta for responsive feel
        const rawFactor = dist / ctx.touch.lastDist;
        const amplified = 1 + (rawFactor - 1) * 2.5;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const rect = el.getBoundingClientRect();
        timeScale.zoom(amplified, midX - rect.left);
        ctx.onUpdate();
      }
      ctx.touch.lastDist = dist;
    }
  };

  const onTouchEnd = () => {
    if (ctx.touch.longPressTimer) {
      clearTimeout(ctx.touch.longPressTimer);
      ctx.touch.longPressTimer = null;
    }

    // Start inertia if swiped fast enough, or bounce-back if overscrolled
    if (ctx.viewState.isDragging && !ctx.touch.longPressCrosshairLocked) {
      if (Math.abs(ctx.pan.velocity) > 3 || Math.abs(timeScale.overscroll) > 0.1) {
        inertia.startPan();
      }
    }

    ctx.viewState.isDragging = false;
    ctx.touch.longPressCrosshairLocked = false;
    ctx.touch.lastDist = 0;
  };

  el.addEventListener("touchstart", onTouchStart, { passive: false });
  el.addEventListener("touchmove", onTouchMove, { passive: false });
  el.addEventListener("touchend", onTouchEnd);

  return () => {
    if (ctx.touch.longPressTimer) {
      clearTimeout(ctx.touch.longPressTimer);
      ctx.touch.longPressTimer = null;
    }
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchmove", onTouchMove);
    el.removeEventListener("touchend", onTouchEnd);
  };
}
