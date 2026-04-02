import { describe, expect, it, vi } from "vitest";
import { connectWyckoffPhase, createWyckoffPhase } from "../plugins/wyckoff-phase";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    arc: vi.fn(),
    fillStyle: "",
    fillText: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;

const mockTs = (start = 0, end = 5) =>
  ({
    startIndex: start,
    endIndex: end,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  }) as import("../core/scale").TimeScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as import(
  "../core/types",
).PaneRect;

const makeCtx = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, pane: mockPane, timeScale: mockTs() }) as import(
    "../core/plugin-types",
  ).PrimitiveRenderContext;

describe("createWyckoffPhase", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createWyckoffPhase([]);
    expect(plugin.name).toBe("wyckoffPhase");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders phase bar for each data point", () => {
    const phases = [
      { time: 1000, value: { phase: "accumulation", confidence: 80 } },
      { time: 1060, value: { phase: "markup", confidence: 60 } },
      { time: 1120, value: { phase: "distribution", confidence: 90 } },
    ];
    const plugin = createWyckoffPhase(phases);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).toHaveBeenCalledTimes(3);
  });

  it("renders VSA event markers as dots", () => {
    const phases = [{ time: 1000, value: { phase: "accumulation" } }];
    const vsa = [{ time: 1000, value: { barType: "spring", isEffortDivergence: false } }];
    const plugin = createWyckoffPhase(phases, vsa);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("skips normal VSA bars", () => {
    const phases = [{ time: 1000, value: { phase: "accumulation" } }];
    const vsa = [{ time: 1000, value: { barType: "normal", isEffortDivergence: false } }];
    const plugin = createWyckoffPhase(phases, vsa);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("handles empty data", () => {
    const plugin = createWyckoffPhase([]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("connectWyckoffPhase", () => {
  it("registers primitive and returns handle", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    const handle = connectWyckoffPhase(chart, { phases: [] });
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    connectWyckoffPhase(chart, { phases: [] }).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("wyckoffPhase");
  });
});
