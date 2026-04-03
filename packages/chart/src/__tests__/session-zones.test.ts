import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { TimeScale } from "../core/scale";
import type { ChartInstance, PaneRect } from "../core/types";
import { connectSessionZones, createSessionZones } from "../plugins/session-zones";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    fillStyle: "",
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  }) as unknown as CanvasRenderingContext2D;

const mockTs = (start = 0, end = 5) =>
  ({
    startIndex: start,
    endIndex: end,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  }) as TimeScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as PaneRect;

const makeCtx = (ctx: CanvasRenderingContext2D, ts = mockTs()) =>
  ({ ctx, pane: mockPane, timeScale: ts }) as PrimitiveRenderContext;

describe("createSessionZones", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createSessionZones([]);
    expect(plugin.name).toBe("sessionZones");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("below");
  });

  it("renders background for kill zone bars", () => {
    const data = [
      { time: 1000, value: { zone: "Asian KZ", inKillZone: true } },
      { time: 1060, value: { zone: "Asian KZ", inKillZone: true } },
      { time: 1120, value: { zone: null, inKillZone: false } },
    ];
    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 3)), plugin.defaultState);

    // 2 kill zone bars + zone label
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("skips non-kill-zone bars", () => {
    const data = [
      { time: 1000, value: { zone: null, inKillZone: false } },
      { time: 1060, value: { zone: null, inKillZone: false } },
    ];
    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 2)), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("renders labels for different zone spans", () => {
    const data = [
      { time: 1000, value: { zone: "Asian KZ", inKillZone: true } },
      { time: 1060, value: { zone: "London Open KZ", inKillZone: true } },
    ];
    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 2)), plugin.defaultState);

    // 2 different zones → 2 labels (1 at transition + 1 at end)
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("handles empty data", () => {
    const plugin = createSessionZones([]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("connectSessionZones", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    const handle = connectSessionZones(chart, []);
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    connectSessionZones(chart, []).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("sessionZones");
  });
});
