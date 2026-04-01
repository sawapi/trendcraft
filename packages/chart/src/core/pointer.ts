/**
 * Pointer Event Utilities — Unified mouse/touch handling.
 * Normalizes mouse clicks and single-finger taps into a common PointerInfo type.
 */

/** Normalized pointer event with canvas-local coordinates */
export type PointerInfo = {
  x: number;
  y: number;
  isTouch: boolean;
};

/** Extract canvas-local coordinates from a MouseEvent or Touch */
export function getPointerPos(e: MouseEvent | Touch, el: HTMLElement): PointerInfo {
  const rect = el.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
    isTouch: !("button" in e),
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

  const onMouseDown = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    downPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onClick = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (downPos) {
      const dx = x - downPos.x;
      const dy = y - downPos.y;
      if (dx * dx + dy * dy > TAP_THRESHOLD) return;
    }
    handler({ x, y, isTouch: false });
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
    handler({ x, y, isTouch: true });
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
