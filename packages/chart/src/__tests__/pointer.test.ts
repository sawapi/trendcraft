// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPointerPos, onTap } from "../core/pointer";

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
  it("subtracts rect offset for MouseEvent", () => {
    const el = makeEl();
    const ev = new MouseEvent("click", { clientX: 110, clientY: 120 });
    const p = getPointerPos(ev, el);
    expect(p).toEqual({ x: 100, y: 100, isTouch: false });
  });

  it("treats Touch-like object (no button) as isTouch=true", () => {
    const el = makeEl();
    const touch = { clientX: 50, clientY: 40 } as unknown as Touch;
    const p = getPointerPos(touch, el);
    expect(p).toEqual({ x: 40, y: 20, isTouch: true });
  });
});

describe("onTap", () => {
  let el: HTMLElement;
  let handler: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    el = makeEl();
    handler = vi.fn();
  });

  it("fires on short click", () => {
    const off = onTap(el, handler);
    el.dispatchEvent(new MouseEvent("mousedown", { clientX: 100, clientY: 100 }));
    el.dispatchEvent(new MouseEvent("click", { clientX: 101, clientY: 101 }));
    expect(handler).toHaveBeenCalledWith({ x: 91, y: 81, isTouch: false });
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
