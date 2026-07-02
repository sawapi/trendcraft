// @vitest-environment happy-dom
/**
 * Lifecycle events — `resize`, `paneResize`, `seriesRemoved`.
 *
 * These three events were declared in the ChartEvent union and documented,
 * but never emitted. These tests pin the now-real emission semantics:
 *
 * - `resize` `{ width, height }` — fires once per actual CSS-px size change.
 *   chart.resize(), applyOptions() size changes, and ResizeObserver ticks all
 *   funnel through the same internal sizing path; same-size calls and
 *   DPR-only changes stay silent, and the constructor's initial sizing never
 *   reaches subscribers (none can exist yet).
 * - `paneResize` `{ paneId, height }` — fires per pointer-move during a user
 *   divider drag; payload names the pane above the dragged divider with its
 *   new height in CSS px. Clamped/no-op drags are silent.
 * - `seriesRemoved` `{ id }` — every removal path funnels through the series
 *   handle (host `handle.remove()`, connectIndicators teardown). Repeat
 *   remove() on the same handle is silent, and destroy() emits nothing
 *   (mirroring `seriesAdded`, which is also silent during teardown).
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

const sampleLine = sampleCandles.map((c) => ({ time: c.time, value: c.close }));

/** Internal layout access — needed to locate the divider gap for drag tests. */
type LayoutInternals = {
  _layout: {
    paneRects: readonly { id: string; y: number; height: number }[];
  };
};

describe("resize event", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits { width, height } once when chart.resize() changes the size", () => {
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const handler = vi.fn();
    chart.on("resize", handler);

    chart.resize(900, 500);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ width: 900, height: 500 });
    chart.destroy();
  });

  it("does not emit for a same-size call or a DPR-only change", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const handler = vi.fn();
    chart.on("resize", handler);

    // Same size — silent.
    chart.resize(800, 400);
    expect(handler).not.toHaveBeenCalled();

    // DPR-only change (window dragged to a Retina display) — the canvas
    // backing store re-scales but the CSS-px size is unchanged, so no emit.
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    chart.resize(800, 400);
    expect(handler).not.toHaveBeenCalled();

    chart.destroy();
  });

  it("emits once when applyOptions changes the size", () => {
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    const handler = vi.fn();
    chart.on("resize", handler);

    chart.applyOptions({ width: 640 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ width: 640, height: 400 });

    // Re-applying the same size stays silent.
    chart.applyOptions({ width: 640, height: 400 });
    expect(handler).toHaveBeenCalledTimes(1);
    chart.destroy();
  });
});

describe("paneResize event", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  function dragDivider(container: HTMLElement, chart: unknown, deltaY: number): void {
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const rects = (chart as LayoutInternals)._layout.paneRects;
    // The gap sits between pane 0 (main) and pane 1 (volume).
    const gapY = rects[0].y + rects[0].height + 1;
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(
      new MouseEvent("mousedown", {
        clientX: rect.left + 100,
        clientY: rect.top + gapY,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(
      new MouseEvent("mousemove", {
        clientX: rect.left + 100,
        clientY: rect.top + gapY + deltaY,
        bubbles: true,
      }),
    );
    canvas.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  }

  it("emits { paneId, height } when the user drags a pane divider", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const prevHeight = (chart as unknown as LayoutInternals)._layout.paneRects[0].height;
    const handler = vi.fn();
    chart.on("paneResize", handler);

    dragDivider(container, chart, 20);

    expect(handler).toHaveBeenCalledTimes(1);
    const payload = handler.mock.calls[0][0] as { paneId: string; height: number };
    expect(payload.paneId).toBe("main");
    // Divider moved down 20 CSS px → the main pane grows by ~20 px
    // (flex re-normalization can shift the result by sub-pixel amounts).
    expect(payload.height).toBeCloseTo(prevHeight + 20, 0);
    chart.destroy();
  });

  it("does not emit when the drag leaves the pane height unchanged", () => {
    const container = makeContainer();
    const chart = createChart(container, { width: 800, height: 400 });
    chart.setCandles(sampleCandles);

    const handler = vi.fn();
    chart.on("paneResize", handler);

    dragDivider(container, chart, 0);

    expect(handler).not.toHaveBeenCalled();
    chart.destroy();
  });
});

describe("seriesRemoved event", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits { id } when a series handle is removed, once per handle", () => {
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    chart.setCandles(sampleCandles);
    const handle = chart.addIndicator(sampleLine, { label: "SMA(20)" });

    const handler = vi.fn();
    chart.on("seriesRemoved", handler);

    handle.remove();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: handle.id });

    // Repeat remove() on the same handle is idempotent — no second emit.
    handle.remove();
    expect(handler).toHaveBeenCalledTimes(1);
    chart.destroy();
  });

  it("does not emit during destroy() teardown (mirrors seriesAdded)", () => {
    const chart = createChart(makeContainer(), { width: 800, height: 400 });
    chart.setCandles(sampleCandles);
    chart.addIndicator(sampleLine, { label: "A" });
    chart.addIndicator(
      sampleLine.map((p) => ({ ...p, value: p.value + 1 })),
      { label: "B" },
    );

    const handler = vi.fn();
    chart.on("seriesRemoved", handler);

    chart.destroy();
    expect(handler).not.toHaveBeenCalled();
  });
});
