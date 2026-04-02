import { describe, expect, it, vi } from "vitest";
import { connectTradeAnalysis, createTradeAnalysis } from "../plugins/trade-analysis";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  }) as unknown as CanvasRenderingContext2D;

const candles = Array.from({ length: 50 }, (_, i) => ({
  time: 1000 + i * 60,
  high: 110 + Math.random() * 5,
  low: 95 + Math.random() * 5,
}));

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

describe("createTradeAnalysis", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createTradeAnalysis([], []);
    expect(plugin.name).toBe("tradeAnalysis");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders MFE/MAE lines and trade markers", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 10 * 60,
        exitPrice: 108,
        returnPercent: 8,
        direction: "long" as const,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // MFE line + MAE line + trade line = 3 strokes
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    // Entry dot + exit dot = 2 arc+fill
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    // MFE/MAE dashed lines
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 2]);
  });

  it("renders shaded area between MFE and MAE", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 5 * 60,
        exitPrice: 105,
        returnPercent: 5,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // Shaded area fillRect
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("handles empty trades", () => {
    const plugin = createTradeAnalysis([], candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe("connectTradeAnalysis", () => {
  it("registers primitive and returns handle", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    const handle = connectTradeAnalysis(chart, [], []);
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = { registerPrimitive: vi.fn(), removePrimitive: vi.fn() } as unknown as import(
      "../core/types",
    ).ChartInstance;
    connectTradeAnalysis(chart, [], []).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("tradeAnalysis");
  });
});
