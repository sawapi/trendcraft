/**
 * Viewport — Manages user interaction state (pan, zoom, crosshair).
 * Translates DOM events into TimeScale/PriceScale operations.
 */

import type { TimeScale } from "./scale";
import type { PaneRect } from "./types";

export type ScrollbarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewportState = {
  /** Is user currently dragging */
  isDragging: boolean;
  /** Last mouse position in chart coordinates */
  mouseX: number;
  mouseY: number;
  /** Current pane under cursor */
  activePaneId: string | null;
  /** Crosshair snapped index */
  crosshairIndex: number | null;
};

export class Viewport {
  private _state: ViewportState = {
    isDragging: false,
    mouseX: 0,
    mouseY: 0,
    activePaneId: null,
    crosshairIndex: null,
  };

  private _dragStartX = 0;
  private _dragStartIndex = 0;
  private _scrollbarDragging = false;
  private _onUpdate: (() => void) | null = null;

  get state(): Readonly<ViewportState> {
    return this._state;
  }

  setOnUpdate(cb: () => void): void {
    this._onUpdate = cb;
  }

  /** Attach DOM event listeners to the canvas container */
  attach(
    el: HTMLElement,
    timeScale: TimeScale,
    panes: () => PaneRect[],
    scrollbar: () => ScrollbarRect | null,
    gapAtY?: (y: number) => number | null,
    resizePanes?: (gapIndex: number, deltaY: number) => void,
    scrollSensitivity = 0.3,
  ): () => void {
    const sens = Math.max(0.1, scrollSensitivity);
    // Make focusable for keyboard events
    el.tabIndex = 0;
    el.style.outline = "none";

    let paneResizeGap: number | null = null;
    let paneResizeStartY = 0;

    const onMouseDown = (e: MouseEvent) => {
      el.focus();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Check pane gap hit (resize)
      if (gapAtY) {
        const gap = gapAtY(my);
        if (gap !== null) {
          paneResizeGap = gap;
          paneResizeStartY = e.clientY;
          return;
        }
      }

      // Check scrollbar hit
      const sb = scrollbar();
      if (sb && my >= sb.y && my <= sb.y + sb.height) {
        this._scrollbarDragging = true;
        const frac = (mx - sb.x) / sb.width;
        const targetCenter = Math.round(frac * timeScale.totalCount);
        const newStart = Math.max(0, targetCenter - Math.floor(timeScale.visibleCount / 2));
        timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
        this._onUpdate?.();
        return;
      }

      this._state.isDragging = true;
      this._dragStartX = e.clientX;
      this._dragStartIndex = timeScale.startIndex;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      this._state.mouseX = e.clientX - rect.left;
      this._state.mouseY = e.clientY - rect.top;

      // Pane resize drag
      if (paneResizeGap !== null && resizePanes) {
        const delta = e.clientY - paneResizeStartY;
        resizePanes(paneResizeGap, delta);
        paneResizeStartY = e.clientY;
        this._onUpdate?.();
        return;
      }

      // Cursor style for gap hover
      if (gapAtY) {
        const gap = gapAtY(this._state.mouseY);
        el.style.cursor = gap !== null ? "ns-resize" : "crosshair";
      }

      // Scrollbar drag
      if (this._scrollbarDragging) {
        const sb = scrollbar();
        if (sb && sb.width > 0) {
          const frac = (this._state.mouseX - sb.x) / sb.width;
          const targetCenter = Math.round(frac * timeScale.totalCount);
          const newStart = Math.max(0, targetCenter - Math.floor(timeScale.visibleCount / 2));
          timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
        }
        this._onUpdate?.();
        return;
      }

      // Find active pane
      const currentPanes = panes();
      this._state.activePaneId = null;
      for (const pane of currentPanes) {
        if (this._state.mouseY >= pane.y && this._state.mouseY < pane.y + pane.height) {
          this._state.activePaneId = pane.id;
          break;
        }
      }

      // Snap crosshair to nearest candle
      this._state.crosshairIndex = timeScale.xToIndex(this._state.mouseX);

      if (this._state.isDragging) {
        const dx = e.clientX - this._dragStartX;
        const deltaBars = -(dx / timeScale.barSpacing);
        timeScale.scrollTo(this._dragStartIndex + deltaBars);
      }

      this._onUpdate?.();
    };

    const onMouseUp = () => {
      this._state.isDragging = false;
      this._scrollbarDragging = false;
      paneResizeGap = null;
    };

    const onMouseLeave = () => {
      this._state.isDragging = false;
      this._scrollbarDragging = false;
      this._state.crosshairIndex = null;
      this._state.activePaneId = null;
      this._onUpdate?.();
    };

    // Gesture direction lock: holds current direction, but re-evaluates
    // when the dominant axis changes (allows quick pan↔zoom switching)
    let gestureDir: "pan" | "zoom" | null = null;
    let gestureTimer: ReturnType<typeof setTimeout> | null = null;
    let zoomAnchorX: number | null = null;

    // Zoom inertia state
    let zoomVelocity = 0;
    let zoomInertiaRaf: number | null = null;
    let lastZoomTime = 0;

    const stopZoomInertia = () => {
      if (zoomInertiaRaf !== null) {
        cancelAnimationFrame(zoomInertiaRaf);
        zoomInertiaRaf = null;
      }
      zoomVelocity = 0;
    };

    const runZoomInertia = () => {
      if (Math.abs(zoomVelocity) < 0.0005) {
        zoomInertiaRaf = null;
        zoomAnchorX = null;
        return;
      }
      const factor = 1 - zoomVelocity;
      timeScale.zoom(factor, zoomAnchorX ?? undefined);
      zoomVelocity *= 0.9; // Friction
      this._onUpdate?.();
      zoomInertiaRaf = requestAnimationFrame(runZoomInertia);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Determine direction from this event
      // ctrlKey indicates trackpad pinch — always treat as zoom
      const eventDir: "pan" | "zoom" = e.ctrlKey
        ? "zoom"
        : Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? "pan"
          : "zoom";

      // If direction changed, reset lock immediately
      if (gestureDir !== null && gestureDir !== eventDir) {
        gestureDir = null;
        zoomAnchorX = null;
        stopZoomInertia();
      }

      if (gestureDir === null) gestureDir = eventDir;

      // Reset lock after 150ms of no wheel events (gesture ended)
      if (gestureTimer) clearTimeout(gestureTimer);
      gestureTimer = setTimeout(() => {
        gestureDir = null;
      }, 150);

      if (gestureDir === "pan") {
        // Horizontal scroll (pan) — sub-pixel smooth scrolling
        const deltaBars = e.deltaX / timeScale.barSpacing;
        timeScale.scrollBy(deltaBars);
      } else {
        // Zoom: proportional to deltaY magnitude for smooth trackpad support
        const clampedDelta = Math.max(-50, Math.min(50, e.deltaY));
        const zoomDelta = e.ctrlKey ? clampedDelta * 0.01 : (clampedDelta / 500) * sens;
        const factor = 1 - zoomDelta;

        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;

        // Lock anchor on first zoom event
        if (zoomAnchorX === null) zoomAnchorX = mouseX;

        const now = performance.now();

        // If inertia is running, absorb its velocity and stop it
        if (zoomInertiaRaf !== null) {
          cancelAnimationFrame(zoomInertiaRaf);
          zoomInertiaRaf = null;
        }

        timeScale.zoom(factor, zoomAnchorX);

        // Blend velocity: smooth transition between active zoom and inertia
        const dt = now - lastZoomTime;
        if (dt < 50) {
          // Events arriving quickly — blend with previous velocity
          zoomVelocity = zoomVelocity * 0.3 + zoomDelta * 0.7;
        } else {
          zoomVelocity = zoomDelta;
        }
        lastZoomTime = now;

        // Start inertia immediately on each frame — it will be cancelled
        // by the next wheel event if the gesture is still active.
        // This eliminates the pause between last event and inertia start.
        zoomInertiaRaf = requestAnimationFrame(runZoomInertia);
      }
      this._onUpdate?.();
    };

    // Keyboard shortcuts
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          timeScale.scrollBy(e.shiftKey ? -10 : -1);
          break;
        case "ArrowRight":
          timeScale.scrollBy(e.shiftKey ? 10 : 1);
          break;
        case "+":
        case "=":
          timeScale.zoom(1.15);
          break;
        case "-":
          timeScale.zoom(0.87);
          break;
        case "Home":
          timeScale.setVisibleRange(0, timeScale.visibleCount);
          break;
        case "End":
          timeScale.scrollToEnd();
          break;
        case "f":
          timeScale.fitContent();
          break;
        default:
          return; // Don't prevent default for unhandled keys
      }
      e.preventDefault();
      this._onUpdate?.();
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKeyDown);

    // Touch support with inertia, double-tap, and long-press
    let lastTouchX = 0;
    let lastTouchDist = 0;
    let touchVelocity = 0;
    let lastTouchMoveTime = 0;
    let inertiaRaf: number | null = null;
    let lastTapTime = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let longPressCrosshairLocked = false;

    const stopInertia = () => {
      if (inertiaRaf !== null) {
        cancelAnimationFrame(inertiaRaf);
        inertiaRaf = null;
      }
    };

    const runInertia = () => {
      if (Math.abs(touchVelocity) < 0.5) {
        inertiaRaf = null;
        return;
      }
      const deltaBars = -touchVelocity / timeScale.barSpacing;
      timeScale.scrollBy(Math.round(deltaBars));
      touchVelocity *= 0.92; // Friction (stronger damping for less floaty feel)
      this._onUpdate?.();
      inertiaRaf = requestAnimationFrame(runInertia);
    };

    const onTouchStart = (e: TouchEvent) => {
      stopInertia();
      if (e.touches.length === 1) {
        const now = Date.now();
        const touch = e.touches[0];

        // Check scrollbar hit on touch
        const rect = el.getBoundingClientRect();
        const touchLocalX = touch.clientX - rect.left;
        const touchLocalY = touch.clientY - rect.top;
        const sb = scrollbar();
        if (sb && touchLocalY >= sb.y && touchLocalY <= sb.y + sb.height) {
          this._scrollbarDragging = true;
          const frac = (touchLocalX - sb.x) / sb.width;
          const targetCenter = Math.round(frac * timeScale.totalCount);
          const newStart = Math.max(0, targetCenter - Math.floor(timeScale.visibleCount / 2));
          timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
          this._onUpdate?.();
          return;
        }

        // Double-tap detection
        if (now - lastTapTime < 300) {
          timeScale.fitContent();
          this._onUpdate?.();
          lastTapTime = 0;
          return;
        }
        lastTapTime = now;

        // Long-press detection
        longPressTimer = setTimeout(() => {
          longPressCrosshairLocked = true;
          const rect = el.getBoundingClientRect();
          this._state.crosshairIndex = timeScale.xToIndex(touch.clientX - rect.left);
          this._onUpdate?.();
        }, 500);

        this._state.isDragging = true;
        lastTouchX = touch.clientX;
        lastTouchMoveTime = now;
        touchVelocity = 0;
        this._dragStartX = lastTouchX;
        this._dragStartIndex = timeScale.startIndex;
      } else if (e.touches.length === 2) {
        // Switch from pan to pinch: cancel drag state
        if (longPressTimer) clearTimeout(longPressTimer);
        this._state.isDragging = false;
        longPressCrosshairLocked = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastTouchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // Scrollbar drag (touch)
      if (this._scrollbarDragging && e.touches.length === 1) {
        const sbTouch = e.touches[0];
        const rect = el.getBoundingClientRect();
        const localX = sbTouch.clientX - rect.left;
        const sb = scrollbar();
        if (sb && sb.width > 0) {
          const frac = (localX - sb.x) / sb.width;
          const targetCenter = Math.round(frac * timeScale.totalCount);
          const newStart = Math.max(0, targetCenter - Math.floor(timeScale.visibleCount / 2));
          timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
        }
        this._onUpdate?.();
        return;
      }

      if (e.touches.length === 1 && this._state.isDragging) {
        const now = Date.now();
        const currentX = e.touches[0].clientX;

        // Track velocity for inertia
        const dt = now - lastTouchMoveTime;
        if (dt > 0) {
          touchVelocity = ((currentX - lastTouchX) / dt) * 16 * sens; // Normalize to ~60fps + sensitivity
        }
        lastTouchX = currentX;
        lastTouchMoveTime = now;

        // Long-press crosshair tracking
        if (longPressCrosshairLocked) {
          const rect = el.getBoundingClientRect();
          this._state.crosshairIndex = timeScale.xToIndex(currentX - rect.left);
          this._onUpdate?.();
          return;
        }

        const dx = currentX - this._dragStartX;
        const deltaBars = -(dx / timeScale.barSpacing);
        timeScale.scrollTo(this._dragStartIndex + deltaBars);
        this._onUpdate?.();
      } else if (e.touches.length === 2) {
        const tdx = e.touches[0].clientX - e.touches[1].clientX;
        const tdy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (lastTouchDist > 0 && dist > 0) {
          // Amplify pinch: double the zoom delta for responsive feel
          const rawFactor = dist / lastTouchDist;
          const amplified = 1 + (rawFactor - 1) * 2.5;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const rect = el.getBoundingClientRect();
          timeScale.zoom(amplified, midX - rect.left);
          this._onUpdate?.();
        }
        lastTouchDist = dist;
      }
    };

    const onTouchEnd = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      // Start inertia if swiped fast enough
      if (this._state.isDragging && !longPressCrosshairLocked && Math.abs(touchVelocity) > 3) {
        inertiaRaf = requestAnimationFrame(runInertia);
      }

      this._state.isDragging = false;
      longPressCrosshairLocked = false;
      lastTouchDist = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }
}
