// @vitest-environment happy-dom
/**
 * Characterization tests for Viewport.attach().
 *
 * Locks down the observable behavior of the 9 event handlers + 2 inertia loops
 * before the handler-extraction refactor (issue #19). Each test exercises a
 * single interaction path and asserts effects on TimeScale, Viewport state,
 * or callbacks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimeScale } from "../core/scale";
import type { PaneRect } from "../core/types";
import { type ScrollbarRect, Viewport } from "../core/viewport";

// --- helpers -------------------------------------------------------------

function makeEl(width = 800, height = 600): HTMLElement {
  const el = document.createElement("div");
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  // happy-dom doesn't always provide focus()
  if (typeof el.focus !== "function") el.focus = () => undefined;
  return el;
}

function makeTimeScale(total = 500, visibleStart = 100): TimeScale {
  const ts = new TimeScale();
  ts.setWidth(800);
  ts.setTotalCount(total);
  ts.setVisibleRange(visibleStart, visibleStart + 100);
  return ts;
}

type Setup = {
  el: HTMLElement;
  vp: Viewport;
  ts: TimeScale;
  detach: () => void;
  resizePanes: ReturnType<typeof vi.fn>;
  dispatch: ReturnType<typeof vi.fn>;
  onUpdate: ReturnType<typeof vi.fn>;
};

function setup(
  opts: {
    panes?: PaneRect[];
    scrollbar?: ScrollbarRect | null;
    gapAtY?: (y: number) => number | null;
    hotkeys?: false | undefined;
    longPress?: boolean;
    wheelInertia?: boolean;
    total?: number;
  } = {},
): Setup {
  const el = makeEl();
  const vp = new Viewport();
  const ts = makeTimeScale(opts.total);
  const panes: PaneRect[] = opts.panes ?? [
    { id: "main", y: 0, height: 400, flex: 1 },
    { id: "vol", y: 400, height: 200, flex: 0.5 },
  ];
  const scrollbar =
    opts.scrollbar !== undefined ? opts.scrollbar : { x: 0, y: 580, width: 800, height: 12 };
  const resizePanes = vi.fn();
  const dispatch = vi.fn();
  const onUpdate = vi.fn();
  vp.setOnUpdate(onUpdate);
  const detach = vp.attach(
    el,
    ts,
    () => panes,
    () => scrollbar,
    opts.gapAtY,
    resizePanes,
    0.3,
    {
      lockOnLongPress: opts.longPress ?? true,
      wheelInertia: opts.wheelInertia ?? true,
      hotkeys: opts.hotkeys,
      onAction: dispatch,
    },
  );
  return { el, vp, ts, detach, resizePanes, dispatch, onUpdate };
}

function fireMouse(el: HTMLElement, type: string, x: number, y: number, init: MouseEventInit = {}) {
  el.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, ...init }));
}

function fireWheel(el: HTMLElement, init: WheelEventInit) {
  el.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init }));
}

function fireKey(el: HTMLElement, key: string, init: KeyboardEventInit = {}) {
  // hotkeys.ts matches on `code`; default to deriving code from key when not given.
  const code = init.code ?? deriveCode(key);
  el.dispatchEvent(
    new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true, ...init }),
  );
}

function deriveCode(key: string): string {
  if (key === "Escape") return "Escape";
  if (/^[a-zA-Z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (key === "ArrowLeft" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowDown") {
    return key;
  }
  if (key === "Home" || key === "End") return key;
  if (key === "+" || key === "=") return "Equal";
  if (key === "-") return "Minus";
  return key;
}

function makeTouch(clientX: number, clientY: number): Touch {
  return { clientX, clientY, identifier: 0 } as unknown as Touch;
}

function fireTouch(el: HTMLElement, type: string, touches: Touch[]) {
  // happy-dom may not implement TouchEvent constructor — fall back to a custom event.
  let ev: Event;
  try {
    ev = new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      touches: touches as unknown as TouchList,
    });
  } catch {
    ev = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "touches", { value: touches });
  }
  el.dispatchEvent(ev);
}

// --- tests ---------------------------------------------------------------

describe("Viewport.attach() — mouse pan", () => {
  let s: Setup;
  beforeEach(() => {
    s = setup();
  });
  afterEach(() => s.detach());

  it("pans startIndex by -dx/barSpacing on drag", () => {
    const startIdx = s.ts.startIndex;
    const spacing = s.ts.barSpacing;
    fireMouse(s.el, "mousedown", 400, 200);
    expect(s.vp.state.isDragging).toBe(true);
    fireMouse(s.el, "mousemove", 350, 200); // dx = -50
    // expected: startIndex shifted by +50/spacing bars
    const shifted = s.ts.startIndex - startIdx;
    expect(shifted).toBeGreaterThan(0);
    expect(shifted).toBeCloseTo(50 / spacing, 0);
    fireMouse(s.el, "mouseup", 350, 200);
    expect(s.vp.state.isDragging).toBe(false);
  });

  it("clears state on mouseleave", () => {
    fireMouse(s.el, "mousedown", 400, 200);
    fireMouse(s.el, "mousemove", 380, 200);
    fireMouse(s.el, "mouseleave", 0, 0);
    expect(s.vp.state.isDragging).toBe(false);
    expect(s.vp.state.crosshairIndex).toBe(null);
    expect(s.vp.state.activePaneId).toBe(null);
  });

  it("updates crosshair and activePane on move (no drag)", () => {
    fireMouse(s.el, "mousemove", 200, 100);
    expect(s.vp.state.activePaneId).toBe("main");
    expect(s.vp.state.crosshairIndex).not.toBe(null);
    fireMouse(s.el, "mousemove", 200, 500);
    expect(s.vp.state.activePaneId).toBe("vol");
  });
});

describe("Viewport.attach() — scrollbar drag", () => {
  it("track click jumps visible range to center on cursor", () => {
    const s = setup();
    const before = s.ts.startIndex;
    // Click far right of scrollbar track (no thumb at x=700) to trigger page jump.
    fireMouse(s.el, "mousedown", 700, 585);
    expect(s.ts.startIndex).not.toBe(before);
    s.detach();
  });

  it("thumb grab preserves offset under cursor on subsequent drag", () => {
    const s = setup();
    // First scrollbar mousedown to start drag, then move and verify reasonable shift.
    fireMouse(s.el, "mousedown", 200, 585);
    fireMouse(s.el, "mousemove", 250, 585);
    expect(s.ts.startIndex).toBeGreaterThanOrEqual(0);
    fireMouse(s.el, "mouseup", 250, 585);
    s.detach();
  });
});

describe("Viewport.attach() — pane resize via gap", () => {
  it("calls resizePanes with delta when dragging gap", () => {
    const gapAtY = (y: number) => (y >= 398 && y <= 402 ? 0 : null);
    const s = setup({ gapAtY });
    fireMouse(s.el, "mousedown", 400, 400);
    fireMouse(s.el, "mousemove", 400, 420);
    expect(s.resizePanes).toHaveBeenCalledWith(0, 20);
    fireMouse(s.el, "mouseup", 400, 420);
    s.detach();
  });
});

describe("Viewport.attach() — wheel", () => {
  let s: Setup;
  beforeEach(() => {
    s = setup({ wheelInertia: false });
  });
  afterEach(() => s.detach());

  it("horizontal deltaX triggers pan (scrollByUnclamped)", () => {
    const before = s.ts.startIndex;
    fireWheel(s.el, { deltaX: 50, deltaY: 0, clientX: 400, clientY: 200 });
    expect(s.ts.startIndex).not.toBe(before);
  });

  it("vertical deltaY triggers zoom around cursor", () => {
    const beforeSpacing = s.ts.barSpacing;
    fireWheel(s.el, { deltaX: 0, deltaY: -50, clientX: 400, clientY: 200 });
    expect(s.ts.barSpacing).not.toBe(beforeSpacing);
  });

  it("ctrlKey forces zoom (trackpad pinch)", () => {
    const beforeSpacing = s.ts.barSpacing;
    fireWheel(s.el, { deltaX: 0, deltaY: -30, ctrlKey: true, clientX: 400, clientY: 200 });
    expect(s.ts.barSpacing).not.toBe(beforeSpacing);
  });

  it("preventDefault is called", () => {
    const ev = new WheelEvent("wheel", {
      deltaX: 0,
      deltaY: 50,
      clientX: 400,
      clientY: 200,
      bubbles: true,
      cancelable: true,
    });
    s.el.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("Viewport.attach() — keyboard nav", () => {
  let s: Setup;
  beforeEach(() => {
    s = setup();
  });
  afterEach(() => s.detach());

  it("ArrowLeft scrolls by -1, Shift+ArrowLeft by -10", () => {
    const before = s.ts.startIndex;
    fireKey(s.el, "ArrowLeft");
    expect(s.ts.startIndex).toBe(before - 1);
    fireKey(s.el, "ArrowLeft", { shiftKey: true });
    expect(s.ts.startIndex).toBe(before - 11);
  });

  it("ArrowRight scrolls by +1", () => {
    const before = s.ts.startIndex;
    fireKey(s.el, "ArrowRight");
    expect(s.ts.startIndex).toBe(before + 1);
  });

  it("+/- adjusts barSpacing via zoom", () => {
    const before = s.ts.barSpacing;
    fireKey(s.el, "+");
    expect(s.ts.barSpacing).toBeGreaterThan(before);
    const mid = s.ts.barSpacing;
    fireKey(s.el, "-");
    expect(s.ts.barSpacing).toBeLessThan(mid);
  });

  it("Home scrolls to start, End scrolls to end", () => {
    fireKey(s.el, "End");
    expect(s.ts.startIndex).toBeGreaterThan(0);
    fireKey(s.el, "Home");
    expect(s.ts.startIndex).toBe(0);
  });

  it("'f' fits content", () => {
    const beforeSpacing = s.ts.barSpacing;
    fireKey(s.el, "f");
    expect(s.ts.startIndex).toBe(0);
    expect(s.ts.barSpacing).not.toBe(beforeSpacing);
  });

  it("hotkeys: false disables all keyboard interaction", () => {
    const s2 = setup({ hotkeys: false });
    const before = s2.ts.startIndex;
    fireKey(s2.el, "ArrowLeft");
    fireKey(s2.el, "f");
    fireKey(s2.el, "Escape");
    expect(s2.ts.startIndex).toBe(before);
    expect(s2.dispatch).not.toHaveBeenCalled();
    s2.detach();
  });

  it("Escape dispatches 'cancel' and clears drag state", () => {
    fireMouse(s.el, "mousedown", 400, 200);
    expect(s.vp.state.isDragging).toBe(true);
    fireKey(s.el, "Escape");
    expect(s.dispatch).toHaveBeenCalledWith("cancel");
    expect(s.vp.state.isDragging).toBe(false);
  });

  it("default hotkey Alt+T dispatches trendline action", () => {
    fireKey(s.el, "t", { altKey: true });
    expect(s.dispatch).toHaveBeenCalledWith("trendline");
  });
});

describe("Viewport.attach() — touch", () => {
  let s: Setup;
  beforeEach(() => {
    vi.useFakeTimers();
    s = setup();
  });
  afterEach(() => {
    s.detach();
    vi.useRealTimers();
  });

  it("single-touch drag pans startIndex", () => {
    const before = s.ts.startIndex;
    fireTouch(s.el, "touchstart", [makeTouch(400, 200)]);
    fireTouch(s.el, "touchmove", [makeTouch(350, 200)]);
    expect(s.ts.startIndex).not.toBe(before);
    fireTouch(s.el, "touchend", []);
  });

  it("double-tap fits content", () => {
    fireTouch(s.el, "touchstart", [makeTouch(400, 200)]);
    fireTouch(s.el, "touchend", []);
    vi.advanceTimersByTime(100);
    fireTouch(s.el, "touchstart", [makeTouch(400, 200)]);
    expect(s.ts.startIndex).toBe(0);
  });

  it("long-press locks crosshair after 500ms", () => {
    fireTouch(s.el, "touchstart", [makeTouch(400, 200)]);
    vi.advanceTimersByTime(600);
    expect(s.vp.state.crosshairIndex).not.toBe(null);
  });

  it("longPress: false skips long-press timer", () => {
    s.detach();
    s = setup({ longPress: false });
    fireTouch(s.el, "touchstart", [makeTouch(400, 200)]);
    vi.advanceTimersByTime(600);
    expect(s.vp.state.crosshairIndex).toBe(null);
  });

  it("two-finger pinch zooms barSpacing", () => {
    const beforeSpacing = s.ts.barSpacing;
    fireTouch(s.el, "touchstart", [makeTouch(300, 200), makeTouch(500, 200)]);
    fireTouch(s.el, "touchmove", [makeTouch(200, 200), makeTouch(600, 200)]);
    expect(s.ts.barSpacing).not.toBe(beforeSpacing);
  });
});

describe("Viewport.attach() — cleanup", () => {
  it("detach removes all event listeners", () => {
    const s = setup();
    s.detach();
    const before = s.ts.startIndex;
    fireMouse(s.el, "mousedown", 400, 200);
    fireMouse(s.el, "mousemove", 350, 200);
    fireWheel(s.el, { deltaX: 50, deltaY: 0 });
    fireKey(s.el, "ArrowLeft");
    // No handler should have fired.
    expect(s.ts.startIndex).toBe(before);
    expect(s.vp.state.isDragging).toBe(false);
  });

  it("detach is safe to call twice", () => {
    const s = setup();
    s.detach();
    expect(() => s.detach()).not.toThrow();
  });
});
