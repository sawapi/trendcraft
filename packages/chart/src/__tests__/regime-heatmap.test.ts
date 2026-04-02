import { describe, expect, it, vi } from "vitest";
import type { DataPoint } from "../core/types";
import { connectRegimeHeatmap, createRegimeHeatmap } from "../plugins/regime-heatmap";

function makeRegimeData(
  entries: { regime: number; label?: string; confidence?: number }[],
): DataPoint<{ regime: number; label?: string; confidence?: number }>[] {
  return entries.map((value, i) => ({ time: 1000 + i * 60, value }));
}

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
}

function mockTimeScale(startIndex = 0, endIndex = 5) {
  return {
    startIndex,
    endIndex,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  } as import("../core/scale").TimeScale;
}

const mockPaneRect = { id: "main", x: 0, y: 0, width: 800, height: 400 } as import(
  "../core/types",
).PaneRect;

describe("createRegimeHeatmap", () => {
  it("returns a valid PrimitivePlugin", () => {
    const data = makeRegimeData([{ regime: 2, label: "trending-up", confidence: 0.9 }]);
    const plugin = createRegimeHeatmap(data);

    expect(plugin.name).toBe("regimeHeatmap");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("below");
    expect(plugin.defaultState.data).toBe(data);
  });

  it("renders correct colors for each regime type", () => {
    const data = makeRegimeData([
      { regime: 2, label: "trending-up", confidence: 0.8 },
      { regime: 1, label: "ranging", confidence: 0.6 },
      { regime: 0, label: "trending-down", confidence: 0.7 },
    ]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 3);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as import(
        "../core/plugin-types",
      ).PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillRect).toHaveBeenCalledTimes(3);

    // Check colors via fillStyle assignments
    const fillStyles: string[] = [];
    let original = ctx.fillStyle;
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fillStyles.push(v);
        original = v;
      },
      get() {
        return original;
      },
    });

    // Re-render to capture fillStyle
    fillStyles.length = 0;
    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as import(
        "../core/plugin-types",
      ).PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(fillStyles[0]).toContain("38,166,154"); // trending-up = green
    expect(fillStyles[1]).toContain("255,193,7"); // ranging = yellow
    expect(fillStyles[2]).toContain("239,83,80"); // trending-down = red
  });

  it("uses regime index as fallback when label is absent", () => {
    const data = makeRegimeData([{ regime: 2, confidence: 0.5 }]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 1);

    const fillStyles: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fillStyles.push(v);
      },
      get() {
        return "";
      },
    });

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as import(
        "../core/plugin-types",
      ).PrimitiveRenderContext,
      plugin.defaultState,
    );

    // regime=2 → green (same as trending-up)
    expect(fillStyles[0]).toContain("38,166,154");
  });

  it("handles empty data gracefully", () => {
    const plugin = createRegimeHeatmap([]);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 5);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as import(
        "../core/plugin-types",
      ).PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("modulates alpha by confidence", () => {
    const data = makeRegimeData([
      { regime: 2, label: "trending-up", confidence: 0.0 },
      { regime: 2, label: "trending-up", confidence: 1.0 },
    ]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 2);

    const fillStyles: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fillStyles.push(v);
      },
      get() {
        return "";
      },
    });

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as import(
        "../core/plugin-types",
      ).PrimitiveRenderContext,
      plugin.defaultState,
    );

    // confidence=0 → alpha=0.06, confidence=1 → alpha=0.18
    expect(fillStyles[0]).toContain("0.060");
    expect(fillStyles[1]).toContain("0.180");
  });
});

describe("connectRegimeHeatmap", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const data = makeRegimeData([{ regime: 1, label: "ranging" }]);
    const handle = connectRegimeHeatmap(chart, data);

    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.update).toBe("function");
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const handle = connectRegimeHeatmap(chart, []);
    handle.remove();

    expect(chart.removePrimitive).toHaveBeenCalledWith("regimeHeatmap");
  });

  it("update() re-registers primitive with new data", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const handle = connectRegimeHeatmap(chart, []);
    const newData = makeRegimeData([{ regime: 2, label: "trending-up" }]);
    handle.update(newData);

    expect(chart.registerPrimitive).toHaveBeenCalledTimes(2);
  });
});
