import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { ChartInstance, PaneRect } from "../core/types";
import {
  type VolumeProfileData,
  connectVolumeProfile,
  createVolumeProfile,
} from "../plugins/volume-profile";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  }) as unknown as CanvasRenderingContext2D;

const mockTs = () =>
  ({ startIndex: 0, endIndex: 50, barSpacing: 8, indexToX: (i: number) => i * 8 + 4 }) as TimeScale;

const mockPs = () => ({ priceToY: (p: number) => 400 - p * 2 }) as PriceScale;
const mockPane: PaneRect = { id: "main", x: 0, y: 0, width: 800, height: 400 };
const makeCtx = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, pane: mockPane, timeScale: mockTs(), priceScale: mockPs() }) as PrimitiveRenderContext;

const profile: VolumeProfileData = {
  periodLow: 90,
  periodHigh: 110,
  poc: 100,
  vah: 105,
  val: 95,
  levels: [
    { priceLow: 90, priceHigh: 92, priceMid: 91, volume: 100, volumePercent: 0.05 },
    { priceLow: 95, priceHigh: 97, priceMid: 96, volume: 300, volumePercent: 0.15 },
    { priceLow: 99, priceHigh: 101, priceMid: 100, volume: 800, volumePercent: 0.4 },
    { priceLow: 103, priceHigh: 105, priceMid: 104, volume: 500, volumePercent: 0.25 },
    { priceLow: 108, priceHigh: 110, priceMid: 109, volume: 300, volumePercent: 0.15 },
  ],
};

describe("createVolumeProfile", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createVolumeProfile(profile);
    expect(plugin.name).toBe("volumeProfile");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders a bar per level plus a POC line when showPoc is true (default)", () => {
    const plugin = createVolumeProfile(profile);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // One fillRect per level
    expect(ctx.fillRect).toHaveBeenCalledTimes(profile.levels.length);
    // POC line + POC label + strip divider
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalledWith("POC", expect.any(Number), expect.any(Number));
  });

  it("omits the POC line when showPoc is false", () => {
    const plugin = createVolumeProfile(profile, { showPoc: false });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // Only the divider line, no POC label
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("no-ops on an empty profile", () => {
    const empty: VolumeProfileData = {
      ...profile,
      levels: [],
    };
    const plugin = createVolumeProfile(empty);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("accepts widthFraction as absolute pixels when > 1", () => {
    const plugin = createVolumeProfile(profile, { widthFraction: 120 });
    expect(plugin.defaultState.widthFraction).toBe(120);
  });

  it("uses custom colors from options", () => {
    const plugin = createVolumeProfile(profile, {
      barColor: "red",
      valueAreaColor: "blue",
      pocColor: "green",
    });
    expect(plugin.defaultState.barColor).toBe("red");
    expect(plugin.defaultState.valueAreaColor).toBe("blue");
    expect(plugin.defaultState.pocColor).toBe("green");
  });
});

describe("connectVolumeProfile", () => {
  function mockChart() {
    const registrations: Array<{ name: string }> = [];
    const removals: string[] = [];
    const chart = {
      registerPrimitive: vi.fn((p: { name: string }) => {
        registrations.push(p);
      }),
      removePrimitive: vi.fn((name: string) => {
        removals.push(name);
      }),
    } as unknown as ChartInstance;
    return { chart, registrations, removals };
  }

  it("registers the primitive on connect", () => {
    const env = mockChart();
    connectVolumeProfile(env.chart, profile);
    expect(env.registrations).toHaveLength(1);
    expect(env.registrations[0].name).toBe("volumeProfile");
  });

  it("re-registers on update()", () => {
    const env = mockChart();
    const handle = connectVolumeProfile(env.chart, profile);
    handle.update({ ...profile, poc: 102 });
    expect(env.registrations).toHaveLength(2);
  });

  it("removes via remove()", () => {
    const env = mockChart();
    const handle = connectVolumeProfile(env.chart, profile);
    handle.remove();
    expect(env.removals).toEqual(["volumeProfile"]);
  });
});
