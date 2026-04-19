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
    measureText: vi.fn((text: string) => ({ width: text.length * 5.5 })),
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

  it("uses short labels (Asia, LON, NY, Close)", () => {
    const data = [{ time: 1000, value: { zone: "Asian KZ", inKillZone: true } }];
    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 1)), plugin.defaultState);

    const call = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call?.[0]).toBe("Asia");
  });

  it("renders labels for well-separated spans", () => {
    // Two 1-bar spans 50 bars apart (barSpacing=8 → 400px gap) so both fit.
    const data: Array<{ time: number; value: { zone: string | null; inKillZone: boolean } }> = [];
    data.push({ time: 0, value: { zone: "Asian KZ", inKillZone: true } });
    for (let i = 1; i < 50; i++) {
      data.push({ time: i * 60, value: { zone: null, inKillZone: false } });
    }
    data.push({ time: 50 * 60, value: { zone: "NY Open KZ", inKillZone: true } });

    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, data.length)), plugin.defaultState);

    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("skips overlapping labels when spans are too dense", () => {
    // Two adjacent 1-bar spans: midX 4 and 12 (barSpacing=8). "Asia" width ≈ 22,
    // so label halves overlap and the second label must be skipped.
    const data = [
      { time: 1000, value: { zone: "Asian KZ", inKillZone: true } },
      { time: 1060, value: { zone: "London Open KZ", inKillZone: true } },
    ];
    const plugin = createSessionZones(data);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 2)), plugin.defaultState);

    expect(ctx.fillText).toHaveBeenCalledTimes(1);
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
