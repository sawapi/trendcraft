// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewTransition } from "../core/animation";

describe("ViewTransition", () => {
  let now = 0;
  let rafQueue: Array<(now: number) => void> = [];

  beforeEach(() => {
    now = 1000;
    rafQueue = [];
    vi.stubGlobal("performance", { now: () => now });
    vi.stubGlobal("requestAnimationFrame", (cb: (now: number) => void) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      rafQueue[id - 1] = () => {};
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flush(dt: number): void {
    now += dt;
    const batch = rafQueue;
    rafQueue = [];
    for (const cb of batch) cb(now);
  }

  it("isRunning starts false", () => {
    const v = new ViewTransition();
    expect(v.isRunning).toBe(false);
  });

  it("skips animation when duration <= 0 (synchronous onFrame + onDone)", () => {
    const v = new ViewTransition();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    v.animate(0, 10, 50, 10, 800, 0, onFrame, onDone);
    expect(onFrame).toHaveBeenCalledWith(50, 10);
    expect(onDone).toHaveBeenCalled();
    expect(v.isRunning).toBe(false);
  });

  it("skips animation when center + count diff < 0.5", () => {
    const v = new ViewTransition();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    v.animate(0, 10, 0.1, 10, 800, 500, onFrame, onDone);
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalled();
    expect(v.isRunning).toBe(false);
  });

  it("runs animation over multiple RAF ticks", () => {
    const v = new ViewTransition();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    v.animate(0, 10, 50, 20, 800, 300, onFrame, onDone);
    expect(v.isRunning).toBe(true);
    flush(100); // 33%
    expect(onFrame).toHaveBeenCalled();
    expect(v.isRunning).toBe(true);
    flush(200); // 100%
    expect(onDone).toHaveBeenCalled();
    expect(v.isRunning).toBe(false);
  });

  it("cancel stops the loop and clears callbacks", () => {
    const v = new ViewTransition();
    const onFrame = vi.fn();
    const onDone = vi.fn();
    v.animate(0, 10, 50, 20, 800, 300, onFrame, onDone);
    v.cancel();
    expect(v.isRunning).toBe(false);
    flush(500);
    // onDone should not fire after cancel
    expect(onDone).not.toHaveBeenCalled();
  });

  it("animate called twice cancels the first", () => {
    const v = new ViewTransition();
    const a = vi.fn();
    const b = vi.fn();
    v.animate(0, 10, 50, 20, 800, 300, a);
    v.animate(0, 10, 80, 15, 800, 300, b);
    flush(300);
    // only b should receive frames
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it("handles toSpacing of 0 via max(0.1, spacing) clamp", () => {
    const v = new ViewTransition();
    const onFrame = vi.fn();
    expect(() => v.animate(0, 10, 50, 0, 800, 200, onFrame)).not.toThrow();
    flush(200);
    expect(onFrame).toHaveBeenCalled();
  });
});
