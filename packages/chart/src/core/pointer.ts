/**
 * Pointer Event Utilities — Unified mouse/touch handling.
 * Normalizes mouse clicks and single-finger taps into a common PointerInfo type.
 */

/** Normalized pointer event with canvas-local coordinates */
export type PointerInfo = {
  x: number;
  y: number;
  isTouch: boolean;
  /** Modifier keys at the time of the event. False for synthetic events
   *  that don't carry modifier state. */
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
};

type ModifierSource = Pick<MouseEvent, "shiftKey" | "altKey" | "metaKey" | "ctrlKey">;

function readModifiers(e: ModifierSource | undefined): {
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
} {
  return {
    shiftKey: !!e?.shiftKey,
    altKey: !!e?.altKey,
    metaKey: !!e?.metaKey,
    ctrlKey: !!e?.ctrlKey,
  };
}

/** Extract canvas-local coordinates from a MouseEvent or Touch */
export function getPointerPos(e: MouseEvent | Touch, el: HTMLElement): PointerInfo {
  const rect = el.getBoundingClientRect();
  const isMouse = "button" in e;
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    isTouch: !isMouse,
    ...readModifiers(isMouse ? (e as MouseEvent) : undefined),
  };
}

const TAP_THRESHOLD = 25; // 5px squared

/**
 * Attach a "tap" listener that fires on both mouse click and single-finger touchend,
 * with drag discrimination (5px movement threshold).
 * Returns a cleanup function to remove all listeners.
 */
export function onTap(el: HTMLElement, handler: (pos: PointerInfo) => void): () => void {
  let downPos: { x: number; y: number } | null = null;

  // After a real touch tap, mobile browsers synthesize a mouse `click` for the
  // same gesture (touch→mouse compat). Stamp the touch tap and suppress that
  // synthesized click so a single tap fires the handler once, not twice
  // (mirrors the guard onDoubleTap already has for dblclick).
  let lastTouchTapAt = Number.NEGATIVE_INFINITY;
  let lastTouchTapPos: { x: number; y: number } | null = null;

  const onMouseDown = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    downPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onClick = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (lastTouchTapPos && pointerNowMs() - lastTouchTapAt < TOUCH_TO_MOUSE_COMPAT_MS) {
      const sx = x - lastTouchTapPos.x;
      const sy = y - lastTouchTapPos.y;
      if (sx * sx + sy * sy <= TAP_THRESHOLD) return;
    }
    if (downPos) {
      const dx = x - downPos.x;
      const dy = y - downPos.y;
      if (dx * dx + dy * dy > TAP_THRESHOLD) return;
    }
    handler({ x, y, isTouch: false, ...readModifiers(e) });
  };

  let touchStartPos: { x: number; y: number } | null = null;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const rect = el.getBoundingClientRect();
    const t = e.touches[0];
    touchStartPos = { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStartPos) return;
    // Use changedTouches for the released finger
    const t = e.changedTouches[0];
    if (!t) {
      touchStartPos = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    const dx = x - touchStartPos.x;
    const dy = y - touchStartPos.y;
    touchStartPos = null;
    if (dx * dx + dy * dy > TAP_THRESHOLD) return;
    // Stamp so the synthesized mouse click for this gesture is suppressed.
    lastTouchTapAt = pointerNowMs();
    lastTouchTapPos = { x, y };
    handler({ x, y, isTouch: true, ...readModifiers(e) });
  };

  el.addEventListener("mousedown", onMouseDown);
  el.addEventListener("click", onClick);
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchend", onTouchEnd, { passive: true });

  return () => {
    el.removeEventListener("mousedown", onMouseDown);
    el.removeEventListener("click", onClick);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchend", onTouchEnd);
  };
}

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_THRESHOLD = TAP_THRESHOLD;

/**
 * After a real touch double-tap, mobile browsers (iOS Safari, most Android
 * WebViews) synthesize a mouse `dblclick` for the same gesture as part of
 * their touch→mouse compatibility layer. Suppress the synthesized event
 * within this window so subscribers don't see the same double-tap twice.
 */
const TOUCH_TO_MOUSE_COMPAT_MS = 700;

function pointerNowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Attach a "double-tap" listener that fires on mouse `dblclick` and on two
 * finger taps within ~350 ms at near-identical positions. The chart emits
 * this as a generic event; whether the chart also runs a built-in default
 * action (e.g. `fitContent` on touch double-tap via `attachTouchHandlers`)
 * is independent — hosts can subscribe and add their own action layer.
 *
 * Touch path mirrors `onTap`'s gesture discrimination:
 *   - Multi-touch starts (pinch / two-finger pan) are ignored.
 *   - touchends whose finger moved more than `TAP_THRESHOLD` are rejected
 *     (pan/swipe, not a tap).
 *   - Any invalid intervening gesture cancels the pending first tap so a
 *     `tap → invalid → tap` sequence doesn't pair as a double-tap.
 *
 * Returns a cleanup function to remove all listeners.
 */
export function onDoubleTap(el: HTMLElement, handler: (pos: PointerInfo) => void): () => void {
  // Stamped whenever the touch path successfully fires the handler. The
  // mouse `dblclick` listener checks both timestamp and position: only the
  // synthesized dblclick generated for the *same* gesture is suppressed.
  // A real trackpad / mouse double-click somewhere else within the compat
  // window must still fire normally on hybrid devices.
  let lastTouchDoubleTapAt = Number.NEGATIVE_INFINITY;
  let lastTouchDoubleTapPos: { x: number; y: number } | null = null;

  const onDblClick = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (lastTouchDoubleTapPos && pointerNowMs() - lastTouchDoubleTapAt < TOUCH_TO_MOUSE_COMPAT_MS) {
      const dx = x - lastTouchDoubleTapPos.x;
      const dy = y - lastTouchDoubleTapPos.y;
      if (dx * dx + dy * dy <= DOUBLE_TAP_THRESHOLD) return;
    }
    handler({ x, y, isTouch: false, ...readModifiers(e) });
  };

  let lastTapTime = 0;
  let lastTapPos: { x: number; y: number } | null = null;
  let touchStartPos: { x: number; y: number } | null = null;
  let multiTouch = false;

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      multiTouch = true;
      touchStartPos = null;
      return;
    }
    multiTouch = false;
    const rect = el.getBoundingClientRect();
    const t = e.touches[0];
    touchStartPos = { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const wasMulti = multiTouch;
    const startPos = touchStartPos;
    multiTouch = false;
    touchStartPos = null;
    if (wasMulti || !startPos) {
      lastTapTime = 0;
      lastTapPos = null;
      return;
    }

    const t = e.changedTouches[0];
    if (!t) {
      lastTapTime = 0;
      lastTapPos = null;
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;

    const moveDx = x - startPos.x;
    const moveDy = y - startPos.y;
    if (moveDx * moveDx + moveDy * moveDy > TAP_THRESHOLD) {
      lastTapTime = 0;
      lastTapPos = null;
      return;
    }

    const now = pointerNowMs();
    if (lastTapPos && now - lastTapTime < DOUBLE_TAP_MS) {
      const dx = x - lastTapPos.x;
      const dy = y - lastTapPos.y;
      if (dx * dx + dy * dy <= DOUBLE_TAP_THRESHOLD) {
        lastTapTime = 0;
        lastTapPos = null;
        lastTouchDoubleTapAt = now;
        lastTouchDoubleTapPos = { x, y };
        handler({ x, y, isTouch: true, ...readModifiers(e) });
        return;
      }
    }
    lastTapTime = now;
    lastTapPos = { x, y };
  };

  el.addEventListener("dblclick", onDblClick);
  el.addEventListener("touchstart", onTouchStart, { passive: true });
  el.addEventListener("touchend", onTouchEnd, { passive: true });

  return () => {
    el.removeEventListener("dblclick", onDblClick);
    el.removeEventListener("touchstart", onTouchStart);
    el.removeEventListener("touchend", onTouchEnd);
  };
}
