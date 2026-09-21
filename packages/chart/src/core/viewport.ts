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
  InteractionSettings,
  PaneResizeState,
  PanInertiaState,
  ScrollbarRect,
  TouchHandlerState,
  ViewportState,
  WheelGestureState,
  ZoomInertiaState,
} from "./interaction/types";
import { attachWheelHandlers } from "./interaction/wheel-handler";
import type { TimeScale } from "./scale";
import { scrollbarThumbRect } from "./scrollbar-geometry";
import type { HotkeyAction, PaneRect } from "./types";

export type { ScrollbarRect, ViewportState } from "./interaction/types";

/**
 * Runtime-updatable interaction settings — see {@link Viewport.setInteractionOptions}.
 * Defaults (0.3 / true / true / built-in map) are owned by the viewport; an
 * `undefined` field leaves the current value alone.
 */
export type InteractionOptionsUpdate = {
  /** Scroll/pan sensitivity multiplier (clamped to a minimum of 0.1). */
  scrollSensitivity?: number;
  /** Long-press crosshair lock on touch devices. */
  lockOnLongPress?: boolean;
  /** Inertia tail after a wheel/trackpad gesture (pan and zoom). */
  wheelInertia?: boolean;
  /** Custom bindings, or `false` to disable every keyboard binding. */
  hotkeys?: HotkeyMap | false;
};

/**
 * Options for {@link Viewport.attach}: the interaction settings (initial values
 * for what `setInteractionOptions` can later change) plus the host callbacks.
 */
/** Interaction defaults — the single owner of 0.3 / true / true / built-in map. */
export const DEFAULT_INTERACTION_SETTINGS: Readonly<InteractionSettings> = {
  sens: 0.3,
  longPressEnabled: true,
  wheelInertiaEnabled: true,
  hotkeyMap: undefined,
  hotkeyDisabled: false,
};

export type ViewportAttachOptions = Omit<InteractionOptionsUpdate, "scrollSensitivity"> & {
  /** Called when a hotkey fires (drawing tool, 'cancel', 'toggleOverlays'). */
  onAction?: (action: HotkeyAction) => void;
  /**
   * Returns whether a drawing tool is currently armed. When `true`, touch
   * handlers suppress gesture defaults (double-tap fitContent, long-press
   * crosshair lock) so the second tap of a two-click drawing isn't also
   * interpreted as a viewport reset.
   */
  isDrawingActive?: () => boolean;
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
    viewportMutated: false,
  };

  private _onUpdate: (() => void) | null = null;
  private _onViewportMutation: (() => void) | null = null;

  get state(): Readonly<ViewportState> {
    return this._state;
  }

  setOnUpdate(cb: () => void): void {
    this._onUpdate = cb;
  }

  /** Called only for user viewport gestures (see InteractionContext). */
  setOnViewportMutation(cb: () => void): void {
    this._onViewportMutation = cb;
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
    // Far right lands where scrollToEnd/End lands — honors rightOffset and
    // session-gap layouts. `total - visible` here would strand the thumb's
    // rightmost position flush against the last bar, eating the margin.
    const maxStart = timeScale.scrollToEndTarget;
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
    // Geometry shared with the renderer — the grabbable thumb IS the drawn one.
    const thumb = scrollbarThumbRect(timeScale, sb.x, sb.width);
    if (!thumb) {
      this._drag.scrollbarGrabOffsetFrac = null;
      return;
    }
    if (mouseX >= thumb.x && mouseX <= thumb.x + thumb.width) {
      this._drag.scrollbarGrabOffsetFrac = (mouseX - sb.x) / sb.width - thumb.startFrac;
    } else {
      this._drag.scrollbarGrabOffsetFrac = null;
      this._applyScrollbarDrag(mouseX, sb, timeScale);
    }
  }

  /**
   * Release the scrollbar drag.
   *
   * The flag and its grab offset are one unit — `scrollbarDragging` gates the
   * scrollbar branch in every pointer handler, and `scrollbarGrabOffsetFrac`
   * is the position it drags from — so they are cleared together here rather
   * than restated at each gesture-end site.
   */
  private _endScrollbarDrag(): void {
    this._drag.scrollbarDragging = false;
    this._drag.scrollbarGrabOffsetFrac = null;
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

  /**
   * Interaction settings shared by reference with the attached handlers, so
   * an update here is seen by the next event. `attach()` starts from
   * {@link DEFAULT_INTERACTION_SETTINGS} and applies its arguments through
   * `setInteractionOptions()`, the one place that clamps and maps values.
   */
  private readonly _settings: InteractionSettings = { ...DEFAULT_INTERACTION_SETTINGS };

  /**
   * Update interaction settings at runtime. Only the provided fields change:
   * `undefined` (or `null` from an untyped caller) leaves a field alone, and a
   * non-finite `scrollSensitivity` is ignored. Handlers read the settings per
   * event, so a change applies from the next gesture on; an inertia tail that
   * is already running is not interrupted.
   *
   * @example
   * ```ts
   * import { Viewport } from "@trendcraft/chart/headless";
   *
   * const viewport = new Viewport();
   * viewport.setInteractionOptions({ hotkeys: false }); // host takes over the keyboard
   * viewport.setInteractionOptions({ scrollSensitivity: 1 });
   * ```
   */
  setInteractionOptions(update: InteractionOptionsUpdate): void {
    const s = this._settings;
    const { scrollSensitivity, lockOnLongPress, wheelInertia, hotkeys } = update;
    if (Number.isFinite(scrollSensitivity)) s.sens = Math.max(0.1, scrollSensitivity as number);
    if (lockOnLongPress != null) s.longPressEnabled = lockOnLongPress;
    if (wheelInertia != null) s.wheelInertiaEnabled = wheelInertia;
    if (hotkeys != null) {
      s.hotkeyDisabled = hotkeys === false;
      s.hotkeyMap = hotkeys === false ? undefined : hotkeys;
    }
  }

  /**
   * Attach DOM event listeners to the canvas container. Interaction settings
   * start from the defaults on every attach; the arguments override them and
   * `setInteractionOptions()` changes them later.
   */
  attach(
    el: HTMLElement,
    timeScale: TimeScale,
    panes: () => PaneRect[],
    scrollbar: () => ScrollbarRect | null,
    gapAtY?: (y: number) => number | null,
    resizePanes?: (gapIndex: number, deltaY: number) => void,
    scrollSensitivity?: number,
    opts?: ViewportAttachOptions,
  ): () => void {
    // Make focusable for keyboard events
    el.tabIndex = 0;
    el.style.outline = "none";

    Object.assign(this._settings, DEFAULT_INTERACTION_SETTINGS);
    this.setInteractionOptions({
      scrollSensitivity,
      lockOnLongPress: opts?.lockOnLongPress,
      wheelInertia: opts?.wheelInertia,
      hotkeys: opts?.hotkeys,
    });
    const ctx: InteractionContext = {
      el,
      timeScale,
      panes,
      scrollbar,
      gapAtY,
      resizePanes,
      settings: this._settings,
      dispatch: opts?.onAction,
      onUpdate: () => this._onUpdate?.(),
      onViewportMutation: () => {
        this._onViewportMutation?.();
        this._onUpdate?.();
      },
      viewState: this._state,
      drag: this._drag,
      paneResize: { gap: null, startY: 0 },
      pan: { velocity: 0, raf: null, lastTouchX: 0, lastTouchMoveTime: 0 },
      zoom: { velocity: 0, raf: null, lastTime: 0, anchorX: null },
      wheel: { dir: null, timer: null, panVelocity: 0, lastPanTime: 0, viewportMutated: false },
      touch: {
        lastDist: 0,
        lastTapTime: 0,
        longPressTimer: null,
        longPressCrosshairLocked: false,
      },
      applyScrollbarDrag: (mouseX, sb) => this._applyScrollbarDrag(mouseX, sb, timeScale),
      beginScrollbarDrag: (mouseX, sb) => this._beginScrollbarDrag(mouseX, sb, timeScale),
      endScrollbarDrag: () => this._endScrollbarDrag(),
      isDrawingActive: opts?.isDrawingActive,
    };

    // Inertia frames move the viewport, so they go through the mutation
    // channel (a fling arriving during a programmatic animation cancels it,
    // exactly like the gesture that spawned the fling).
    const inertia = new InertiaController(timeScale, ctx.pan, ctx.zoom, ctx.onViewportMutation);

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
