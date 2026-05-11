import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { TimeScale } from "../core/scale";
import type { ChartInstance, DataPoint, PaneRect } from "../core/types";
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
    fillText: vi.fn(),
    fill: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    measureText: vi.fn(() => ({ width: 80 }) as TextMetrics),
    fillStyle: "",
    font: "",
    textBaseline: "" as CanvasTextBaseline,
    textAlign: "" as CanvasTextAlign,
  } as unknown as CanvasRenderingContext2D;
}

function mockTimeScale(startIndex = 0, endIndex = 5) {
  return {
    startIndex,
    endIndex,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  } as TimeScale;
}

const mockPaneRect = { id: "main", x: 0, y: 0, width: 800, height: 400 } as PaneRect;

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
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
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
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
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
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
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
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("renders a corner badge with the most recent regime label and confidence", () => {
    const data = makeRegimeData([
      { regime: 0, label: "trending-down", confidence: 0.6 },
      { regime: 1, label: "ranging", confidence: 0.5 },
      { regime: 2, label: "trending-up", confidence: 0.72 },
    ]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 3);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    // Badge text: "<label> · <conf>%" — picks the most recent visible bar.
    expect(ctx.fillText).toHaveBeenCalledWith(
      "trending-up · 72%",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("omits the badge when showBadge is false", () => {
    const data = makeRegimeData([{ regime: 2, label: "trending-up", confidence: 0.9 }]);
    const plugin = createRegimeHeatmap(data, { showBadge: false });
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 1);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("falls back to 'regime N' label when the data point has no label string", () => {
    const data = makeRegimeData([{ regime: 2, confidence: 0.5 }]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 1);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillText).toHaveBeenCalledWith(
      "regime 2 · 50%",
      expect.any(Number),
      expect.any(Number),
    );
  });

  it("clamps the badge lookup to the visible range and stays empty when no visible bar has data", () => {
    // 5 bars total but only the first 2 carry regime data; the visible range
    // is the last 3 (3..5) so the badge has nothing to show within view.
    // It must NOT walk back into the off-screen bars at index 0/1 and
    // surface a stale label.
    const data: DataPoint<{ regime: number; label?: string; confidence?: number }>[] = [
      { time: 1000, value: { regime: 2, label: "trending-up", confidence: 0.9 } },
      { time: 1060, value: { regime: 2, label: "trending-up", confidence: 0.85 } },
      { time: 1120, value: null as unknown as { regime: number } },
      { time: 1180, value: null as unknown as { regime: number } },
      { time: 1240, value: null as unknown as { regime: number } },
    ];
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(2, 5); // visibleStart=2, visibleEnd=5

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("renders the badge without a percentage when confidence is missing", () => {
    const data = makeRegimeData([{ regime: 1, label: "ranging" }]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 1);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillText).toHaveBeenCalledWith("ranging", expect.any(Number), expect.any(Number));
  });

  it("treats an empty-string label as missing and falls back to 'regime N'", () => {
    // Some upstream normalizers emit `label: ""` to indicate "no label".
    // The badge text must not collapse to a blank or `" · 50%"` pill.
    const data = makeRegimeData([{ regime: 2, label: "", confidence: 0.5 }]);
    const plugin = createRegimeHeatmap(data);
    const ctx = mockCtx();
    const ts = mockTimeScale(0, 1);

    plugin.render(
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    expect(ctx.fillText).toHaveBeenCalledWith(
      "regime 2 · 50%",
      expect.any(Number),
      expect.any(Number),
    );
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
      { ctx, pane: mockPaneRect, timeScale: ts } as PrimitiveRenderContext,
      plugin.defaultState,
    );

    // confidence=0 → alpha=0.15, confidence=1 → alpha=0.40
    expect(fillStyles[0]).toContain("0.150");
    expect(fillStyles[1]).toContain("0.400");
  });
});

describe("connectRegimeHeatmap", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;

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
    } as unknown as ChartInstance;

    const handle = connectRegimeHeatmap(chart, []);
    handle.remove();

    expect(chart.removePrimitive).toHaveBeenCalledWith("regimeHeatmap");
  });

  it("update() re-registers primitive with new data", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;

    const handle = connectRegimeHeatmap(chart, []);
    const newData = makeRegimeData([{ regime: 2, label: "trending-up" }]);
    handle.update(newData);

    expect(chart.registerPrimitive).toHaveBeenCalledTimes(2);
  });

  it("update() preserves previously-applied options across data-only refreshes", () => {
    // After a host toggles `showBadge: false` once, subsequent data refreshes
    // must not silently revert to the original (showBadge: true) options.
    const registrations: Array<{ defaultState: { options: { showBadge: boolean } } }> = [];
    const chart = {
      registerPrimitive: vi.fn((p) => {
        registrations.push(p as (typeof registrations)[number]);
      }),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;

    const handle = connectRegimeHeatmap(chart, [], { showBadge: true });
    handle.update(makeRegimeData([{ regime: 2, label: "trending-up" }]), { showBadge: false });
    // Data-only refresh — should keep showBadge: false.
    handle.update(makeRegimeData([{ regime: 1, label: "ranging" }]));

    expect(registrations).toHaveLength(3);
    expect(registrations[0].defaultState.options.showBadge).toBe(true);
    expect(registrations[1].defaultState.options.showBadge).toBe(false);
    expect(registrations[2].defaultState.options.showBadge).toBe(false);
  });
});
