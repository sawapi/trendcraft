// @vitest-environment happy-dom
/**
 * DPR (devicePixelRatio) tracking — auto-update on resize.
 *
 * `window.devicePixelRatio` can change mid-session when the user drags
 * the browser window between displays of different DPR (Retina ↔
 * external monitor) or changes OS scaling. The chart's canvas internal
 * resolution must follow that change to stay crisp on the new display.
 *
 * Without this guard, the chart caches the construction-time DPR and
 * the canvas remains at the original internal resolution, producing
 * blurry output after the move.
 */

import { beforeAll, describe, expect, it } from "vitest";
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

describe("DPR tracking", () => {
  it("re-reads window.devicePixelRatio on resize when no explicit pixelRatio is pinned", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(800); // 800 css × 1 dpr
    expect(canvas.height).toBe(400);

    // Simulate moving the window to a Retina display (DPR 1 → 2).
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    chart.resize(800, 400);

    // Canvas internal resolution must follow the new DPR; CSS size unchanged.
    expect(canvas.width).toBe(1600); // 800 × 2
    expect(canvas.height).toBe(800);
    expect(canvas.style.width).toBe("800px");
    expect(canvas.style.height).toBe("400px");

    chart.destroy();
  });

  it("honors explicit pixelRatio override (does not auto-track DPR)", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    const chart = createChart(makeContainer(), { width: 800, height: 400, pixelRatio: 3 });
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(2400); // 800 × 3 (pinned)

    // Even if the underlying DPR changes, the pinned value stays.
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    chart.resize(800, 400);
    expect(canvas.width).toBe(2400); // still 800 × 3

    chart.destroy();
  });

  it("falls back to 1 when devicePixelRatio is 0 / undefined / non-finite", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 0 });
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;

    expect(canvas.width).toBe(800); // 800 × 1 fallback

    chart.destroy();
  });

  it.each([
    ["NaN", Number.NaN],
    ["+Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["negative", -2],
  ])("rejects non-finite / negative DPR (%s) and falls back to 1 on subsequent resize", (_label, badDpr) => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const canvas = document.querySelector("canvas") as HTMLCanvasElement;

    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: badDpr });
    chart.resize(800, 400);

    expect(canvas.width).toBe(800); // 800 × 1 (clamped)
    expect(canvas.height).toBe(400);
    expect(Number.isFinite(canvas.width)).toBe(true);

    chart.destroy();
  });
});
