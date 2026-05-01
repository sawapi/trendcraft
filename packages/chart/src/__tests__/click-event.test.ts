// @vitest-environment happy-dom
/**
 * Chart-wide `click` event — fires on any pointer tap not consumed by the
 * drawing tool, with the resolved candle index/time. Hosts use this to
 * implement features like Replay anchoring.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createChart } from "../index";

beforeAll(() => {
  const noop = () => {};
  const ctx = new Proxy(
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
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

function makeContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.width = "800px";
  el.style.height = "400px";
  document.body.appendChild(el);
  return el;
}

const sampleCandles = Array.from({ length: 50 }, (_, i) => ({
  time: 1700000000000 + i * 86400000,
  open: 100 + i,
  high: 105 + i,
  low: 95 + i,
  close: 102 + i,
  volume: 1000,
}));

function clickCanvas(canvas: HTMLCanvasElement, x: number, y: number): void {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new MouseEvent("mousedown", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }),
  );
  canvas.dispatchEvent(
    new MouseEvent("click", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }),
  );
}

describe("chart click event", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits click with x/y coordinates and candle index/time", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("click", handler);

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 200, 100);

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0] as {
      x: number;
      y: number;
      index: number | null;
      time: number | null;
    };
    expect(payload.x).toBeGreaterThanOrEqual(0);
    expect(payload.y).toBeGreaterThanOrEqual(0);
    expect(payload.index).not.toBeNull();
    expect(payload.time).not.toBeNull();
    chart.destroy();
  });

  it("does not fire click while a drawing tool is active", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("click", handler);
    chart.setDrawingTool("hline");

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 200, 100);

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });

  it("does not fire click on out-of-range taps while drawing tool is active", () => {
    // The drawing tool's handleTap returns early when no candle resolves at
    // the cursor (volume pane, beyond data range, etc.). Those taps must
    // still be swallowed by drawing mode — otherwise hosts watching for
    // generic clicks (e.g. Replay anchoring) fire spuriously while the user
    // is trying to draw.
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("click", handler);
    chart.setDrawingTool("trendline");

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 9000, 9000);

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });
});
