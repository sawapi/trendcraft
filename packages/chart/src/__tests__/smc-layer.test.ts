import { describe, expect, it, vi } from "vitest";
import { type SmcState, connectSmcLayer, createSmcLayer } from "../plugins/smc-layer";

const EMPTY_STATE: SmcState = {
  orderBlocks: [],
  fvgZones: [],
  sweepMarkers: [],
  bosLevels: [],
};

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  } as unknown as CanvasRenderingContext2D;
}

function mockTimeScale(startIndex = 0, endIndex = 50) {
  return {
    startIndex,
    endIndex,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  } as import("../core/scale").TimeScale;
}

function mockPriceScale() {
  return {
    priceToY: (price: number) => 400 - price * 2,
  } as import("../core/scale").PriceScale;
}

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as import(
  "../core/types",
).PaneRect;
const mockTheme = { text: "#fff", textSecondary: "#888" } as import("../core/types").ThemeColors;

function makeRenderContext(ctx: CanvasRenderingContext2D) {
  return {
    ctx,
    pane: mockPane,
    timeScale: mockTimeScale(),
    priceScale: mockPriceScale(),
    theme: mockTheme,
  } as import("../core/plugin-types").PrimitiveRenderContext;
}

describe("createSmcLayer", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createSmcLayer(EMPTY_STATE);
    expect(plugin.name).toBe("smcLayer");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("below");
  });

  it("renders nothing for empty state", () => {
    const plugin = createSmcLayer(EMPTY_STATE);
    const ctx = mockCtx();
    plugin.render(makeRenderContext(ctx), EMPTY_STATE);

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it("renders order blocks as filled rectangles", () => {
    const state: SmcState = {
      ...EMPTY_STATE,
      orderBlocks: [
        {
          type: "bullish",
          high: 110,
          low: 100,
          startIndex: 5,
          endIndex: null,
          strength: 80,
          mitigated: false,
        },
      ],
    };
    const plugin = createSmcLayer(state);
    const ctx = mockCtx();

    plugin.render(makeRenderContext(ctx), state);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("renders mitigated OB with lower alpha", () => {
    const state: SmcState = {
      ...EMPTY_STATE,
      orderBlocks: [
        {
          type: "bullish",
          high: 110,
          low: 100,
          startIndex: 5,
          endIndex: 10,
          strength: 80,
          mitigated: true,
        },
      ],
    };
    const plugin = createSmcLayer(state);
    const ctx = mockCtx();

    const fillStyles: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fillStyles.push(v);
      },
      get() {
        return "";
      },
    });

    plugin.render(makeRenderContext(ctx), state);

    // Mitigated alpha = 0.05
    const obFill = fillStyles.find((s) => s.includes("38,166,154"));
    expect(obFill).toBeDefined();
    expect(obFill).toContain("0.05");
  });

  it("renders FVG zones with dashed border", () => {
    const state: SmcState = {
      ...EMPTY_STATE,
      fvgZones: [
        {
          type: "bullish",
          high: 105,
          low: 100,
          startIndex: 3,
          endIndex: null,
          strength: 60,
          mitigated: false,
        },
      ],
    };
    const plugin = createSmcLayer(state);
    const ctx = mockCtx();

    plugin.render(makeRenderContext(ctx), state);

    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("renders sweep markers as triangles", () => {
    const state: SmcState = {
      ...EMPTY_STATE,
      sweepMarkers: [{ type: "bullish", index: 10, price: 95, label: "Sweep" }],
    };
    const plugin = createSmcLayer(state);
    const ctx = mockCtx();

    plugin.render(makeRenderContext(ctx), state);

    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("renders BOS levels as dashed lines with labels", () => {
    const state: SmcState = {
      ...EMPTY_STATE,
      bosLevels: [{ type: "bullish", price: 120, startIndex: 15, endIndex: null, label: "BOS" }],
    };
    const plugin = createSmcLayer(state);
    const ctx = mockCtx();

    plugin.render(makeRenderContext(ctx), state);

    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith("BOS", expect.any(Number), expect.any(Number));
  });
});

describe("connectSmcLayer", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const handle = connectSmcLayer(chart, {});

    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.update).toBe("function");
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const handle = connectSmcLayer(chart, {});
    handle.remove();

    expect(chart.removePrimitive).toHaveBeenCalledWith("smcLayer");
  });

  it("update() re-registers primitive with new data", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as import("../core/types").ChartInstance;

    const handle = connectSmcLayer(chart, {});
    handle.update({ bos: [] });

    expect(chart.registerPrimitive).toHaveBeenCalledTimes(2);
  });
});
