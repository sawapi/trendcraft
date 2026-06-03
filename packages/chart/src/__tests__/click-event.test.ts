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

function clickCanvas(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  init: MouseEventInit = {},
): void {
  const rect = canvas.getBoundingClientRect();
  canvas.dispatchEvent(
    new MouseEvent("mousedown", { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }),
  );
  canvas.dispatchEvent(
    new MouseEvent("click", {
      clientX: rect.left + x,
      clientY: rect.top + y,
      bubbles: true,
      ...init,
    }),
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
      shiftKey: boolean;
    };
    expect(payload.x).toBeGreaterThanOrEqual(0);
    expect(payload.y).toBeGreaterThanOrEqual(0);
    expect(payload.index).not.toBeNull();
    expect(payload.time).not.toBeNull();
    expect(payload.shiftKey).toBe(false);
    chart.destroy();
  });

  it("forwards modifier keys in the click payload", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("click", handler);

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 200, 100, { shiftKey: true, altKey: true });

    const payload = handler.mock.calls[0][0] as {
      shiftKey: boolean;
      altKey: boolean;
      metaKey: boolean;
      ctrlKey: boolean;
    };
    expect(payload.shiftKey).toBe(true);
    expect(payload.altKey).toBe(true);
    expect(payload.metaKey).toBe(false);
    expect(payload.ctrlKey).toBe(false);
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

  it("emits drawingToolChanged when the tool is set, completed, or cancelled", () => {
    // Toolbar UIs sync their highlighted state via this event so they don't
    // drift when the chart clears the tool internally (drawing completion,
    // Escape hotkey, etc.).
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("drawingToolChanged", handler);

    // Setting a tool emits with the new tool name.
    chart.setDrawingTool("hline");
    expect(handler).toHaveBeenLastCalledWith({ tool: "hline" });

    // Setting the same tool is a no-op (no extra emit).
    const callsBefore = handler.mock.calls.length;
    chart.setDrawingTool("hline");
    expect(handler.mock.calls.length).toBe(callsBefore);

    // Clearing emits null.
    chart.setDrawingTool(null);
    expect(handler).toHaveBeenLastCalledWith({ tool: null });

    chart.destroy();
  });

  it("emits drawingToolChanged with null after a drawing completes", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("drawingToolChanged", handler);

    chart.setDrawingTool("hline");
    handler.mockClear();

    // hline is one-click — first click completes immediately
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 200, 100);

    expect(handler).toHaveBeenCalledWith({ tool: null });
    chart.destroy();
  });

  it("does not fire doubleClick when a two-click drawing completes (same spot)", () => {
    // After the second click of a two-click drawing (rectangle, ray, etc.)
    // DrawingTool clears its internal active flag before the browser
    // dispatches the trailing native `dblclick`. The plain isActive() guard
    // would let that dblclick through and hosts (Strategy Studio) would
    // anchor Replay on the drawing's end-point.
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("doubleClick", handler);
    chart.setDrawingTool("rectangle");

    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    // First click — starts the rectangle
    clickCanvas(canvas, 200, 100);
    // Second click — completes the rectangle and clears _activeTool
    clickCanvas(canvas, 300, 200);
    // Browser then fires the trailing dblclick at the completing-click spot
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent("dblclick", {
        clientX: rect.left + 300,
        clientY: rect.top + 200,
        bubbles: true,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });

  it("re-arming the same multi-click tool clears the in-progress anchor", () => {
    // Regression: after the first click of a two-click drawing, re-selecting
    // the same tool (toolbar click, hotkey, etc.) must restart the gesture
    // rather than completing a stale rectangle from the previous start to
    // the new tap.
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    chart.setDrawingTool("rectangle");
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    // First click — sets the in-progress anchor (rectangle is two-click).
    clickCanvas(canvas, 200, 100);
    expect(chart.getDrawings()).toHaveLength(0);

    // Re-arm the same tool — should clear the in-progress anchor.
    chart.setDrawingTool("rectangle");

    // Confirm a second click fires a fresh first-anchor (no completion from
    // the abandoned start). The pre-fix bug would have closed a rectangle
    // here using the (200, 100) anchor, producing 1 drawing.
    clickCanvas(canvas, 250, 100);
    expect(chart.getDrawings()).toHaveLength(0);

    chart.destroy();
  });

  it("still fires doubleClick when the user double-clicks elsewhere after a one-click drawing", () => {
    // Regression: a pure time-based guard would drop *any* doubleClick
    // arriving within the guard window after a drawing tap, even when the
    // user intentionally double-clicks a far-away spot. The position match
    // ensures only the trailing dblclick paired with the drawing's
    // completing click is suppressed.
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("doubleClick", handler);

    // Place a one-click hline at one location.
    chart.setDrawingTool("hline");
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    clickCanvas(canvas, 200, 100);
    // Drawing tool should have cleared itself.
    // Now the user double-clicks at a different location — the dblclick
    // for that gesture must NOT be suppressed.
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent("dblclick", {
        clientX: rect.left + 600,
        clientY: rect.top + 300,
        bubbles: true,
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
    chart.destroy();
  });
});
