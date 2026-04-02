import { describe, expect, it, vi } from "vitest";
import { connectSrConfluence, createSrConfluence } from "../plugins/sr-confluence";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  }) as unknown as CanvasRenderingContext2D;

const mockTs = () =>
  ({ startIndex: 0, endIndex: 50, barSpacing: 8, indexToX: (i: number) => i * 8 + 4 }) as import(
    "../core/scale",
  ).TimeScale;

const mockPs = () =>
  ({ priceToY: (p: number) => 400 - p * 2 }) as import("../core/scale").PriceScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as import(
  "../core/types",
).PaneRect;

const makeCtx = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, pane: mockPane, timeScale: mockTs(), priceScale: mockPs() }) as import(
    "../core/plugin-types",
  ).PrimitiveRenderContext;

describe("createSrConfluence", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createSrConfluence([]);
    expect(plugin.name).toBe("srConfluence");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("below");
  });

  it("renders zones as filled bands with borders", () => {
    const zones = [
      {
        price: 100,
        low: 98,
        high: 102,
        strength: 80,
        touchCount: 5,
        sourceDiversity: 3,
        sources: ["swing", "pivot", "vwap"],
      },
      {
        price: 120,
        low: 118,
        high: 122,
        strength: 40,
        touchCount: 2,
        sourceDiversity: 1,
        sources: ["swing"],
      },
    ];
    const plugin = createSrConfluence(zones);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("handles empty zones", () => {
    const plugin = createSrConfluence([]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("connectSrConfluence", () => {
  it("registers primitive and returns handle", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    const handle = connectSrConfluence(chart, []);
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    connectSrConfluence(chart, []).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("srConfluence");
  });
});
