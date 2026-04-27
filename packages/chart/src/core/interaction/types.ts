/**
 * Shared types for the interaction module.
 *
 * The `attach()` method on `Viewport` used to be a 537-line closure that owned
 * 9 event handlers, 2 inertia loops, and ~15 mutable variables. The handlers
 * were tightly coupled through shared mutable state. To split them into
 * testable units we externalize the shared state here so each handler file
 * can take a typed reference instead of capturing local variables from the
 * same enclosing scope.
 */

import type { HotkeyMap } from "../hotkeys";
import type { TimeScale } from "../scale";
import type { HotkeyAction, PaneRect } from "../types";

export type ScrollbarRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Public read-only viewport state (cursor, drag flag, crosshair). */
export type ViewportState = {
  isDragging: boolean;
  mouseX: number;
  mouseY: number;
  activePaneId: string | null;
  crosshairIndex: number | null;
};

/** Drag-related instance state shared across mouse / touch / keyboard handlers. */
export type DragState = {
  startX: number;
  startIndex: number;
  scrollbarDragging: boolean;
  /** See Viewport._scrollbarGrabOffsetFrac for semantics. */
  scrollbarGrabOffsetFrac: number | null;
};

/** Pane-resize gap drag state — only used by mouse handlers. */
export type PaneResizeState = {
  gap: number | null;
  startY: number;
};

/** Pan inertia (touch flick + wheel handoff + bounce-back). */
export type PanInertiaState = {
  velocity: number;
  raf: number | null;
  lastTouchX: number;
  lastTouchMoveTime: number;
};

/** Zoom inertia (trackpad pinch + wheel zoom continuation). */
export type ZoomInertiaState = {
  velocity: number;
  raf: number | null;
  lastTime: number;
  anchorX: number | null;
};

/** Wheel-specific gesture lock + velocity tracking. */
export type WheelGestureState = {
  /** "pan" | "zoom" | null — locks the active gesture for ~150ms */
  dir: "pan" | "zoom" | null;
  timer: ReturnType<typeof setTimeout> | null;
  panVelocity: number;
  lastPanTime: number;
};

/** Touch-specific shared state (pinch baseline + double-tap + long-press). */
export type TouchHandlerState = {
  lastDist: number;
  lastTapTime: number;
  longPressTimer: ReturnType<typeof setTimeout> | null;
  longPressCrosshairLocked: boolean;
};

/**
 * Bundle handed to each interaction handler. References are shared — handlers
 * mutate the contained state objects directly so changes are visible to other
 * handlers and to the inertia loops.
 */
export type InteractionContext = {
  // Stable dependencies (set once at attach time)
  el: HTMLElement;
  timeScale: TimeScale;
  panes: () => PaneRect[];
  scrollbar: () => ScrollbarRect | null;
  gapAtY?: (y: number) => number | null;
  resizePanes?: (gap: number, dy: number) => void;
  sens: number;
  longPressEnabled: boolean;
  wheelInertiaEnabled: boolean;
  hotkeyMap: HotkeyMap | undefined;
  hotkeyDisabled: boolean;
  dispatch?: (action: HotkeyAction) => void;
  onUpdate: () => void;

  // Mutable shared state (owned by Viewport; handed by reference)
  viewState: ViewportState;
  drag: DragState;
  paneResize: PaneResizeState;
  pan: PanInertiaState;
  zoom: ZoomInertiaState;
  wheel: WheelGestureState;
  touch: TouchHandlerState;

  // Scrollbar-press helpers (kept on Viewport to preserve their docstrings).
  applyScrollbarDrag: (mouseX: number, sb: ScrollbarRect) => void;
  beginScrollbarDrag: (mouseX: number, sb: ScrollbarRect) => void;
};
