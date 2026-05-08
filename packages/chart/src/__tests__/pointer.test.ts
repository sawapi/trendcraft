// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPointerPos, onDoubleTap, onTap } from "../core/pointer";

function makeEl(rect: Partial<DOMRect> = {}): HTMLElement {
  const el = document.createElement("div");
  const full = {
    left: 10,
    top: 20,
    right: 810,
    bottom: 620,
    width: 800,
    height: 600,
    x: 10,
    y: 20,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect;
  el.getBoundingClientRect = () => full;
  return el;
}

describe("getPointerPos", () => {
  it("subtracts rect offset for MouseEvent and reads modifiers", () => {
    const el = makeEl();
    const ev = new MouseEvent("click", { clientX: 110, clientY: 120, shiftKey: true });
    const p = getPointerPos(ev, el);
    expect(p).toEqual({
      x: 100,
      y: 100,
      isTouch: false,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
  });

  it("treats Touch-like object (no button) as isTouch=true with no modifiers", () => {
    const el = makeEl();
    const touch = { clientX: 50, clientY: 40 } as unknown as Touch;
    const p = getPointerPos(touch, el);
    expect(p).toEqual({
      x: 40,
      y: 20,
      isTouch: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
  });
});

describe("onTap", () => {
  let el: HTMLElement;
  let handler: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    el = makeEl();
    handler = vi.fn();
  });

  it("fires on short click and forwards modifier keys", () => {
    const off = onTap(el, handler);
    el.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100 }));
    el.dispatchEvent(
      new MouseEvent("click", { clientX: 101, clientY: 101, shiftKey: true, altKey: true }),
    );
    expect(handler).toHaveBeenCalledWith({
      x: 91,
      y: 81,
      isTouch: false,
      shiftKey: true,
      altKey: true,
      metaKey: false,
      ctrlKey: false,
    });
    off();
  });

  it("suppresses click when movement exceeds drag threshold", () => {
    const off = onTap(el, handler);
    el.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100 }));
    el.dispatchEvent(new MouseEvent("click", { clientX: 150, clientY: 150 }));
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("fires click when no prior mousedown (downPos null branch)", () => {
    const off = onTap(el, handler);
    el.dispatchEvent(new MouseEvent("click", { clientX: 200, clientY: 200 }));
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("fires on single-finger tap via touchend", () => {
    const off = onTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", { value: [{ clientX: 50, clientY: 60 }] });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 51, clientY: 61 }] });
    el.dispatchEvent(end);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].isTouch).toBe(true);
    off();
  });

  it("ignores multi-touch starts", () => {
    const off = onTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", {
      value: [
        { clientX: 1, clientY: 1 },
        { clientX: 2, clientY: 2 },
      ],
    });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 1, clientY: 1 }] });
    el.dispatchEvent(end);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("suppresses tap when finger moves beyond threshold", () => {
    const off = onTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", { value: [{ clientX: 100, clientY: 100 }] });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 150, clientY: 150 }] });
    el.dispatchEvent(end);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("handles touchend with empty changedTouches", () => {
    const off = onTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", { value: [{ clientX: 100, clientY: 100 }] });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [] });
    expect(() => el.dispatchEvent(end)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("touchend without prior touchstart is ignored", () => {
    const off = onTap(el, handler);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 1, clientY: 1 }] });
    el.dispatchEvent(end);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("cleanup removes all listeners", () => {
    const off = onTap(el, handler);
    off();
    el.dispatchEvent(new MouseEvent("click", { clientX: 100, clientY: 100 }));
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("onDoubleTap", () => {
  let el: HTMLElement;
  let handler: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    el = makeEl();
    handler = vi.fn();
  });

  function tapAt(el: HTMLElement, x: number, y: number): void {
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", { value: [{ clientX: x, clientY: y }] });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: x, clientY: y }] });
    el.dispatchEvent(end);
  }

  it("fires on native dblclick (mouse path) with modifier keys", () => {
    const off = onDoubleTap(el, handler);
    el.dispatchEvent(new MouseEvent("dblclick", { clientX: 110, clientY: 120, shiftKey: true }));
    expect(handler).toHaveBeenCalledWith({
      x: 100,
      y: 100,
      isTouch: false,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      ctrlKey: false,
    });
    off();
  });

  it("fires on two close touchend events", () => {
    const off = onDoubleTap(el, handler);
    tapAt(el, 50, 60);
    expect(handler).not.toHaveBeenCalled();
    tapAt(el, 51, 61);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].isTouch).toBe(true);
    off();
  });

  it("does not fire when second tap lands far from the first", () => {
    const off = onDoubleTap(el, handler);
    tapAt(el, 50, 60);
    tapAt(el, 200, 200);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("does not fire when taps are too far apart in time", async () => {
    const off = onDoubleTap(el, handler);
    vi.useFakeTimers();
    try {
      tapAt(el, 50, 60);
      vi.advanceTimersByTime(500);
      tapAt(el, 51, 61);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      off();
    }
  });

  it("ignores touchend with empty changedTouches", () => {
    const off = onDoubleTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", { value: [{ clientX: 50, clientY: 50 }] });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [] });
    expect(() => el.dispatchEvent(end)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("ignores touch sequences that pan beyond the tap threshold", () => {
    const off = onDoubleTap(el, handler);
    const swipe = (sx: number, sy: number, ex: number, ey: number) => {
      const start = new Event("touchstart") as unknown as TouchEvent;
      Object.defineProperty(start, "touches", { value: [{ clientX: sx, clientY: sy }] });
      el.dispatchEvent(start);
      const end = new Event("touchend") as unknown as TouchEvent;
      Object.defineProperty(end, "changedTouches", { value: [{ clientX: ex, clientY: ey }] });
      el.dispatchEvent(end);
    };
    swipe(20, 60, 100, 60);
    swipe(20, 60, 100, 60);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("ignores multi-touch gestures (pinch / two-finger pan)", () => {
    const off = onDoubleTap(el, handler);
    const start = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(start, "touches", {
      value: [
        { clientX: 30, clientY: 60 },
        { clientX: 80, clientY: 60 },
      ],
    });
    el.dispatchEvent(start);
    const end = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 31, clientY: 61 }] });
    el.dispatchEvent(end);
    tapAt(el, 32, 62);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("cancels a pending first tap when an invalid gesture follows", () => {
    const off = onDoubleTap(el, handler);
    tapAt(el, 50, 60);
    const swStart = new Event("touchstart") as unknown as TouchEvent;
    Object.defineProperty(swStart, "touches", { value: [{ clientX: 50, clientY: 60 }] });
    el.dispatchEvent(swStart);
    const swEnd = new Event("touchend") as unknown as TouchEvent;
    Object.defineProperty(swEnd, "changedTouches", { value: [{ clientX: 200, clientY: 60 }] });
    el.dispatchEvent(swEnd);
    tapAt(el, 51, 61);
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("cleanup removes all listeners", () => {
    const off = onDoubleTap(el, handler);
    off();
    el.dispatchEvent(new MouseEvent("dblclick", { clientX: 100, clientY: 100 }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("suppresses synthesized mouse dblclick at the same spot after a touch double-tap", () => {
    // Mobile browsers (iOS Safari, Android WebView) generate compatibility
    // mouse events for touch gestures, including a synthesized `dblclick`
    // at the same coordinates as the touch end. Suppress that copy so the
    // host's handler doesn't fire twice for one gesture.
    const off = onDoubleTap(el, handler);
    tapAt(el, 50, 60);
    tapAt(el, 51, 61);
    expect(handler).toHaveBeenCalledTimes(1);
    el.dispatchEvent(new MouseEvent("dblclick", { clientX: 51, clientY: 61, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1); // still 1, not 2
    off();
  });

  it("still fires mouse dblclick at a different spot within the compat window", () => {
    // Hybrid devices (touch + trackpad) can produce a real mouse double-
    // click shortly after a touch double-tap. As long as the position
    // doesn't match, the de-dup must not swallow it.
    const off = onDoubleTap(el, handler);
    tapAt(el, 50, 60);
    tapAt(el, 51, 61);
    expect(handler).toHaveBeenCalledTimes(1);
    el.dispatchEvent(new MouseEvent("dblclick", { clientX: 400, clientY: 300, bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(2);
    off();
  });

  it("re-allows synthesized dblclick once the touch compat window expires", async () => {
    const off = onDoubleTap(el, handler);
    vi.useFakeTimers();
    try {
      tapAt(el, 50, 60);
      tapAt(el, 51, 61);
      expect(handler).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(800);
      // Same spot, but the window has expired.
      el.dispatchEvent(new MouseEvent("dblclick", { clientX: 51, clientY: 61, bubbles: true }));
      expect(handler).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      off();
    }
  });
});
