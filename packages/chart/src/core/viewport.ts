/**
 * Viewport — Manages user interaction state (pan, zoom, crosshair).
 * Translates DOM events into TimeScale/PriceScale operations.
 *
 * The DOM event handling is delegated to the `core/interaction/` module:
 * each input device (mouse, wheel, keyboard, touch) has its own handler file
 * and the `attach()` method below is just the orchestrator that wires them
 * together with a shared `InteractionContext` and `InertiaController`.
 */

import type { HotkeyMap } from "./hotkeys";
import { InertiaController } from "./interaction/inertia";
import { attachKeyboardHandlers } from "./interaction/keyboard-handler";
import { attachMouseHandlers } from "./interaction/mouse-handler";
import { attachTouchHandlers } from "./interaction/touch-handler";
import type {
  DragState,
  InteractionContext,
  PanInertiaState,
  PaneResizeState,
  ScrollbarRect,
  TouchHandlerState,
  ViewportState,
  WheelGestureState,
  ZoomInertiaState,
} from "./interaction/types";
import { attachWheelHandlers } from "./interaction/wheel-handler";
import type { TimeScale } from "./scale";
import type { HotkeyAction, PaneRect } from "./types";

export type { ScrollbarRect, ViewportState } from "./interaction/types";

export type ViewportAttachOptions = {
  /** Enable long-press crosshair lock on touch devices (default: true) */
  lockOnLongPress?: boolean;
  /** Enable wheel pan inertia (default: true) */
  wheelInertia?: boolean;
  /** Hotkey map override; pass `false` to disable keyboard shortcuts entirely. */
  hotkeys?: HotkeyMap | false;
  /** Called when a hotkey fires (drawing tool, 'cancel', 'toggleOverlays'). */
  onAction?: (action: HotkeyAction) => void;
};

export class Viewport {
  private _state: ViewportState = {
    isDragging: false,
    mouseX: 0,
    mouseY: 0,
    activePaneId: null,
    crosshairIndex: null,
  };

  private _drag: DragState = {
    startX: 0,
    startIndex: 0,
    scrollbarDragging: false,
    /**
     * When grabbing the scrollbar thumb, this holds the fraction (of scrollbar
     * width) between the pointer and the thumb's left edge at press-time — so
     * subsequent drag positions preserve that offset instead of centering the
     * visible range on the pointer. `null` when the press was on the track
     * (outside the thumb); in that case we page-jump to center on the cursor.
     */
    scrollbarGrabOffsetFrac: null,
  };

  private _onUpdate: (() => void) | null = null;

  get state(): Readonly<ViewportState> {
    return this._state;
  }

  setOnUpdate(cb: () => void): void {
    this._onUpdate = cb;
  }

  /**
   * Update the visible range from a scrollbar pointer position, honoring the
   * stored grab offset so the thumb stays pinned under the pointer where it
   * was first grabbed. Pass `null` grab offset for a center-on-cursor jump.
   */
  private _applyScrollbarDrag(mouseX: number, sb: ScrollbarRect, timeScale: TimeScale): void {
    if (sb.width <= 0) return;
    const total = timeScale.totalCount;
    if (total <= 0) return;
    const visible = timeScale.visibleCount;
    const maxStart = Math.max(0, total - visible);
    const pointerFrac = (mouseX - sb.x) / sb.width;

    let newStart: number;
    if (this._drag.scrollbarGrabOffsetFrac !== null) {
      const startFrac = pointerFrac - this._drag.scrollbarGrabOffsetFrac;
      newStart = Math.round(startFrac * total);
    } else {
      const targetCenter = Math.round(pointerFrac * total);
      newStart = targetCenter - Math.floor(visible / 2);
    }
    newStart = Math.max(0, Math.min(maxStart, newStart));
    timeScale.setVisibleRange(newStart, newStart + visible);
  }

  /**
   * On scrollbar press, determine whether the pointer landed on the thumb.
   * If yes, remember the grab offset so subsequent moves preserve it.
   * If no (track click), clear the offset so the drag behaves as
   * page-to-cursor (the legacy behavior).
   */
  private _beginScrollbarDrag(mouseX: number, sb: ScrollbarRect, timeScale: TimeScale): void {
    this._drag.scrollbarDragging = true;
    const total = timeScale.totalCount;
    if (sb.width <= 0 || total <= 0) {
      this._drag.scrollbarGrabOffsetFrac = null;
      return;
    }
    const startFrac = Math.max(0, timeScale.startIndex / total);
    const endFrac = Math.min(1, timeScale.endIndex / total);
    const thumbX = sb.x + startFrac * sb.width;
    const thumbW = Math.max(8, (endFrac - startFrac) * sb.width);
    if (mouseX >= thumbX && mouseX <= thumbX + thumbW) {
      this._drag.scrollbarGrabOffsetFrac = (mouseX - sb.x) / sb.width - startFrac;
    } else {
      this._drag.scrollbarGrabOffsetFrac = null;
      this._applyScrollbarDrag(mouseX, sb, timeScale);
    }
  }

  /**
   * Programmatic crosshair control for host code that wants to drive the
   * crosshair without a DOM pointer event (e.g. remote-driven playback).
   * Only touches `crosshairIndex` — mouseX/mouseY/activePaneId stay as the
   * user last left them. Pass `null` to hide.
   */
  setCrosshairByIndex(index: number | null, timeScale: TimeScale): void {
    if (index === null || index < 0 || index >= timeScale.totalCount) {
      this._state.crosshairIndex = null;
      return;
    }
    this._state.crosshairIndex = index;
  }

  /** Attach DOM event listeners to the canvas container. */
  attach(
    el: HTMLElement,
    timeScale: TimeScale,
    panes: () => PaneRect[],
    scrollbar: () => ScrollbarRect | null,
    gapAtY?: (y: number) => number | null,
    resizePanes?: (gapIndex: number, deltaY: number) => void,
    scrollSensitivity = 0.3,
    opts?: ViewportAttachOptions,
  ): () => void {
    // Make focusable for keyboard events
    el.tabIndex = 0;
    el.style.outline = "none";

    const hotkeyMap = opts?.hotkeys;
    const ctx: InteractionContext = {
      el,
      timeScale,
      panes,
      scrollbar,
      gapAtY,
      resizePanes,
      sens: Math.max(0.1, scrollSensitivity),
      longPressEnabled: opts?.lockOnLongPress ?? true,
      wheelInertiaEnabled: opts?.wheelInertia ?? true,
      hotkeyMap: hotkeyMap === false ? undefined : hotkeyMap,
      hotkeyDisabled: hotkeyMap === false,
      dispatch: opts?.onAction,
      onUpdate: () => this._onUpdate?.(),
      viewState: this._state,
      drag: this._drag,
      paneResize: { gap: null, startY: 0 },
      pan: { velocity: 0, raf: null, lastTouchX: 0, lastTouchMoveTime: 0 },
      zoom: { velocity: 0, raf: null, lastTime: 0, anchorX: null },
      wheel: { dir: null, timer: null, panVelocity: 0, lastPanTime: 0 },
      touch: {
        lastDist: 0,
        lastTapTime: 0,
        longPressTimer: null,
        longPressCrosshairLocked: false,
      },
      applyScrollbarDrag: (mouseX, sb) => this._applyScrollbarDrag(mouseX, sb, timeScale),
      beginScrollbarDrag: (mouseX, sb) => this._beginScrollbarDrag(mouseX, sb, timeScale),
    };

    const inertia = new InertiaController(timeScale, ctx.pan, ctx.zoom, ctx.onUpdate);

    const detachers = [
      attachMouseHandlers(ctx, inertia),
      attachWheelHandlers(ctx, inertia),
      attachKeyboardHandlers(ctx, inertia),
      attachTouchHandlers(ctx, inertia),
    ];

    return () => {
      inertia.dispose();
      for (const detach of detachers) detach();
    };
  }
}

// Re-export internal types not used here but referenced by external consumers
// of the interaction module (tests, future plugins).
export type {
  DragState,
  InteractionContext,
  PaneResizeState,
  PanInertiaState,
  TouchHandlerState,
  WheelGestureState,
  ZoomInertiaState,
};
