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
  ): () => void {
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
        const deltaBars = -Math.round(dx / timeScale.barSpacing);
        const newStart = this._dragStartIndex + deltaBars;
        timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
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

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const deltaBars = Math.round(e.deltaX / timeScale.barSpacing);
        timeScale.scrollBy(deltaBars);
      } else {
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        timeScale.zoom(factor, mouseX);
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

    // Touch support
    let lastTouchX = 0;
    let lastTouchDist = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this._state.isDragging = true;
        lastTouchX = e.touches[0].clientX;
        this._dragStartX = lastTouchX;
        this._dragStartIndex = timeScale.startIndex;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 1 && this._state.isDragging) {
        const dx = e.touches[0].clientX - this._dragStartX;
        const deltaBars = -Math.round(dx / timeScale.barSpacing);
        const newStart = this._dragStartIndex + deltaBars;
        timeScale.setVisibleRange(newStart, newStart + timeScale.visibleCount);
        this._onUpdate?.();
      } else if (e.touches.length === 2) {
        const dist = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
        if (lastTouchDist > 0) {
          const factor = dist / lastTouchDist;
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const rect = el.getBoundingClientRect();
          timeScale.zoom(factor, midX - rect.left);
          this._onUpdate?.();
        }
        lastTouchDist = dist;
      }
    };

    const onTouchEnd = () => {
      this._state.isDragging = false;
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
