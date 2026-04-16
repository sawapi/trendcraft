// @vitest-environment happy-dom
/**
 * destroy() idempotency and render-loop guard.
 *
 * Verifies that destroy() can be called multiple times safely and that the
 * render loop stops scheduling new frames after destroy(). Reproduces the
 * edge case where destroy() is called from inside a callback emitted during
 * rendering (e.g. a plugin error handler) — the loop must not reschedule.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createChart } from "../index";

beforeAll(() => {
  const noop = () => {};
  const context2d = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    context2d;
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "800px";
  el.style.height = "400px";
  document.body.appendChild(el);
  return el;
}

describe("CanvasChart destroy()", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("is idempotent — calling destroy twice does not throw", () => {
    const chart = createChart(makeContainer());
    expect(() => {
      chart.destroy();
      chart.destroy();
    }).not.toThrow();
  });

  it("stops scheduling RAF after destroy", () => {
    const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame");
    const cancelSpy = vi.spyOn(globalThis, "cancelAnimationFrame");
    const chart = createChart(makeContainer());

    const rafCallsBeforeDestroy = rafSpy.mock.calls.length;
    chart.destroy();
    expect(cancelSpy).toHaveBeenCalled();

    // No new RAF should be scheduled after destroy completes
    const rafCallsAfterDestroy = rafSpy.mock.calls.length;
    expect(rafCallsAfterDestroy).toBe(rafCallsBeforeDestroy);

    rafSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
