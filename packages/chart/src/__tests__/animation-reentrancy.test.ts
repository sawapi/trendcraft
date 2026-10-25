/** An animation started from another's callbacks was dropped. */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewTransition } from "../core/animation";

describe("re-entrant animations", () => {
  let now = 0;
  let queued: FrameRequestCallback[] = [];
  const flush = () => {
    const run = queued;
    queued = [];
    now += 1000;
    for (const cb of run) cb(now);
  };
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queued.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(performance, "now").mockImplementation(() => now);
  afterEach(() => {
    queued = [];
  });

  it("runs an animation started from the previous one's onDone", () => {
    const t = new ViewTransition();
    const frames: number[] = [];
    let secondDone = false;
    t.animate(
      0,
      10,
      100,
      10,
      800,
      300,
      () => {},
      () => {
        t.animate(
          100,
          10,
          300,
          10,
          800,
          300,
          (start) => frames.push(start),
          () => {
            secondDone = true;
          },
        );
      },
    );
    flush(); // first animation completes, its onDone starts the second
    flush(); // second animation completes
    expect(frames.length).toBeGreaterThan(0);
    expect(secondDone).toBe(true);
    expect(t.isRunning).toBe(false);
  });

  it("runs only one loop when onFrame starts a new animation", () => {
    const t = new ViewTransition();
    let restarted = false;
    t.animate(0, 10, 100, 10, 800, 5000, () => {
      if (!restarted) {
        restarted = true;
        t.animate(50, 10, 300, 10, 800, 5000, () => {});
      }
    });
    const firstTick = queued.shift() as FrameRequestCallback;
    firstTick(now + 10); // onFrame starts a new animation mid-tick
    // Only the new animation's frame is scheduled; the old tick stopped.
    expect(queued.length).toBe(1);
  });

  it("stops the loop when onFrame cancels the animation", () => {
    const t = new ViewTransition();
    t.animate(0, 10, 100, 10, 800, 5000, () => t.cancel());
    const firstTick = queued.shift() as FrameRequestCallback;
    firstTick(now + 10); // onFrame cancels mid-tick
    expect(queued.length).toBe(0);
    expect(t.isRunning).toBe(false);
  });
});
