// @vitest-environment happy-dom
/**
 * Layout isolation — one chart's pane changes must not reach another.
 *
 * The engine mutates its config in place (panes are pushed, spliced, and
 * their `flex` rewritten by divider drags). Holding the module-level default
 * by reference therefore made every runtime pane change rewrite the
 * create-time default for every chart constructed afterwards.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_LAYOUT, DEFAULT_LAYOUT_NO_VOLUME, LayoutEngine } from "../core/layout";
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

const candles = Array.from({ length: 50 }, (_, i) => ({
  time: 1_700_000_000_000 + i * 86_400_000,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
  volume: 1000,
}));

describe("LayoutEngine instance isolation", () => {
  it("does not leak an added pane to a later engine", () => {
    const a = new LayoutEngine();
    a.addPane({ id: "rsi", flex: 1 });

    expect(new LayoutEngine().hasPane("rsi")).toBe(false);
    expect(DEFAULT_LAYOUT.panes.map((p) => p.id)).toEqual(["main", "volume"]);
  });

  it("does not leak a removed pane to a later engine", () => {
    const a = new LayoutEngine();
    expect(a.removePane("volume")).toBe(true);

    expect(new LayoutEngine().hasPane("volume")).toBe(true);
    expect(DEFAULT_LAYOUT.panes.map((p) => p.id)).toEqual(["main", "volume"]);
  });

  it("does not leak a divider drag to a later engine", () => {
    const a = new LayoutEngine();
    a.setDimensions(800, 600, 60, 24);
    a.resizePanes(0, -150);
    expect(a.config.panes[0].flex).not.toBe(3);

    const b = new LayoutEngine();
    expect(b.config.panes[0].flex).toBe(3);
    expect(b.config.panes[1].flex).toBe(0.7);
    expect(DEFAULT_LAYOUT.panes[0].flex).toBe(3);
  });

  it("does not adopt the caller's pane object in addPane", () => {
    // LayoutEngine is public, so adding one pane config to two engines is a
    // natural thing to write. Sharing the object would let a divider drag on
    // one engine resize the other's pane.
    const shared = { id: "rsi", flex: 1 };
    const a = new LayoutEngine();
    const b = new LayoutEngine();
    a.setDimensions(800, 600, 60, 24);
    b.setDimensions(800, 600, 60, 24);
    a.addPane(shared);
    b.addPane(shared);

    a.resizePanes(1, 80);

    expect(a.config.panes[2].flex).not.toBe(1);
    expect(b.config.panes[2].flex).toBe(1);
    expect(shared.flex).toBe(1);
    expect(a.config.panes[2]).not.toBe(b.config.panes[2]);
    expect(a.config.panes[2]).not.toBe(shared);
  });

  it("does not normalise a caller's added pane to flex 1", () => {
    // The zero-flex fallback in recompute writes flex onto every pane. It must
    // write onto the engine's copies, not the objects the caller passed in.
    const added = { id: "z", flex: 0 };
    const le = new LayoutEngine();
    le.setLayout({ panes: [{ id: "main", flex: 0 }], gap: 4, scrollbar: true });
    le.addPane(added);
    le.setDimensions(800, 600, 60, 24);

    expect(le.config.panes[1].flex).toBe(1);
    expect(added.flex).toBe(0);
  });

  it("does not adopt the caller's config object in setLayout", () => {
    const caller = { panes: [{ id: "main", flex: 3 }], gap: 4, scrollbar: true };
    const engine = new LayoutEngine();
    engine.setLayout(caller);
    engine.addPane({ id: "rsi", flex: 1 });

    expect(caller.panes.map((p) => p.id)).toEqual(["main"]);
  });

  it("keeps two engines on the same template independent", () => {
    const a = new LayoutEngine();
    const b = new LayoutEngine();
    a.setLayout(DEFAULT_LAYOUT_NO_VOLUME);
    b.setLayout(DEFAULT_LAYOUT_NO_VOLUME);
    a.addPane({ id: "equity", flex: 1 });

    expect(b.hasPane("equity")).toBe(false);
    expect(DEFAULT_LAYOUT_NO_VOLUME.panes.map((p) => p.id)).toEqual(["main"]);
  });

  it("exposes the defaults as frozen templates", () => {
    expect(Object.isFrozen(DEFAULT_LAYOUT)).toBe(true);
    expect(Object.isFrozen(DEFAULT_LAYOUT.panes)).toBe(true);
    expect(Object.isFrozen(DEFAULT_LAYOUT.panes[0])).toBe(true);
    expect(Object.isFrozen(DEFAULT_LAYOUT_NO_VOLUME)).toBe(true);
  });
});

/**
 * Internal layout access — a chart exposes no public pane list, which is part
 * of why a phantom pane went unnoticed: it holds no series, so it is invisible
 * through `getAllSeries()` while still eating vertical space.
 */
type LayoutInternals = {
  _layout: {
    paneRects: readonly { id: string }[];
    config: { panes: { id: string; flex: number }[] };
    resizePanes(gapIndex: number, deltaY: number): void;
  };
};

function layoutOf(chart: unknown): LayoutInternals["_layout"] {
  return (chart as LayoutInternals)._layout;
}

function paneIds(chart: unknown): string[] {
  return layoutOf(chart).paneRects.map((r) => r.id);
}

function mainFlex(chart: unknown): number {
  return layoutOf(chart).config.panes[0].flex;
}

describe("chart instance isolation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("gives a chart created later the default panes", () => {
    const chartA = createChart(makeContainer(), { width: 800, height: 400 });
    chartA.setCandles(candles);
    chartA.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.close })),
      { pane: "rsi", label: "RSI" },
    );
    expect(paneIds(chartA)).toContain("rsi");

    const chartB = createChart(makeContainer(), { width: 800, height: 400 });
    expect(paneIds(chartB)).toEqual(["main", "volume"]);

    chartA.destroy();
    chartB.destroy();
  });

  it("keeps the volume pane on a chart created after another hid it", () => {
    const chartA = createChart(makeContainer(), { width: 800, height: 400 });
    chartA.setShowVolume(false);
    expect(paneIds(chartA)).not.toContain("volume");

    const chartB = createChart(makeContainer(), { width: 800, height: 400 });
    expect(paneIds(chartB)).toContain("volume");

    chartA.destroy();
    chartB.destroy();
  });

  it("keeps volume:false charts independent of each other", () => {
    const chartA = createChart(makeContainer(), { width: 800, height: 400, volume: false });
    const chartB = createChart(makeContainer(), { width: 800, height: 400, volume: false });
    chartA.setCandles(candles);
    chartA.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.close })),
      { pane: "macd", label: "MACD" },
    );

    expect(paneIds(chartA)).toContain("macd");
    expect(paneIds(chartB)).toEqual(["main"]);

    chartA.destroy();
    chartB.destroy();
  });

  it("does not let a divider drag on one chart resize a later one", () => {
    const chartA = createChart(makeContainer(), { width: 800, height: 400 });
    const before = mainFlex(chartA);
    layoutOf(chartA).resizePanes(0, -80);
    expect(mainFlex(chartA)).not.toBe(before);

    const chartB = createChart(makeContainer(), { width: 800, height: 400 });
    expect(mainFlex(chartB)).toBe(3);

    chartA.destroy();
    chartB.destroy();
  });
});
