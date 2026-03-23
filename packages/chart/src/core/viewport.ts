/**
 * Viewport — Manages user interaction state (pan, zoom, crosshair).
 * Translates DOM events into TimeScale/PriceScale operations.
 */

import type { TimeScale } from "./scale";
import type { PaneRect, TimeValue } from "./types";

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
  private _onUpdate: (() => void) | null = null;

  get state(): Readonly<ViewportState> {
    return this._state;
  }

  setOnUpdate(cb: () => void): void {
    this._onUpdate = cb;
  }

  /** Attach DOM event listeners to the canvas container */
  attach(el: HTMLElement, timeScale: TimeScale, panes: () => PaneRect[]): () => void {
    const onMouseDown = (e: MouseEvent) => {
      this._state.isDragging = true;
      this._dragStartX = e.clientX;
      this._dragStartIndex = timeScale.startIndex;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      this._state.mouseX = e.clientX - rect.left;
      this._state.mouseY = e.clientY - rect.top;

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
    };

    const onMouseLeave = () => {
      this._state.isDragging = false;
      this._state.crosshairIndex = null;
      this._state.activePaneId = null;
      this._onUpdate?.();
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // Horizontal scroll → pan
        const deltaBars = Math.round(e.deltaX / timeScale.barSpacing);
        timeScale.scrollBy(deltaBars);
      } else {
        // Vertical scroll → zoom
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        timeScale.zoom(factor, mouseX);
      }
      this._onUpdate?.();
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("wheel", onWheel, { passive: false });

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

    // Return cleanup function
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }
}
