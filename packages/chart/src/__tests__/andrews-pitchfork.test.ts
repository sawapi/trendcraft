import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { ChartInstance, PaneRect } from "../core/types";
import {
  type PitchforkAnchors,
  connectAndrewsPitchfork,
  createAndrewsPitchfork,
} from "../plugins/andrews-pitchfork";

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
    closePath: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  }) as unknown as CanvasRenderingContext2D;

const mockTs = () =>
  ({
    startIndex: 0,
    endIndex: 50,
    barSpacing: 8,
    indexToX: (i: number) => i * 8 + 4,
  }) as TimeScale;

const mockPs = () => ({ priceToY: (p: number) => 400 - p * 2 }) as PriceScale;
const mockPane: PaneRect = { id: "main", x: 0, y: 0, width: 800, height: 400 };
const makeCtx = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, pane: mockPane, timeScale: mockTs(), priceScale: mockPs() }) as PrimitiveRenderContext;

const anchors: PitchforkAnchors = {
  p0: { index: 5, price: 100 },
  p1: { index: 15, price: 120 },
  p2: { index: 25, price: 105 },
};

describe("createAndrewsPitchfork", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createAndrewsPitchfork(anchors);
    expect(plugin.name).toBe("andrewsPitchfork");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("below");
  });

  it("renders three parallel lines, the handle connector, and anchor dots", () => {
    const plugin = createAndrewsPitchfork(anchors);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // Fill for pitchfork body (one polygon) + 3 anchor dots → 4 fills
    expect(ctx.fill).toHaveBeenCalledTimes(4);
    // One stroke each for: handle connector, median line, two handle lines together
    expect(ctx.stroke).toHaveBeenCalledTimes(3);
    // Three anchor arcs
    expect(ctx.arc).toHaveBeenCalledTimes(3);
  });

  it("bails out on a degenerate configuration where p0 aligns vertically with midpoint", () => {
    const degenerate: PitchforkAnchors = {
      p0: { index: 10, price: 100 },
      p1: { index: 10, price: 110 }, // same x as p0 → midpoint x = 10 too
      p2: { index: 10, price: 90 },
    };
    const plugin = createAndrewsPitchfork(degenerate);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // Should return early without drawing anything
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("uses custom colors when provided", () => {
    const plugin = createAndrewsPitchfork(anchors, {
      color: "rgba(255,0,0,1)",
      fillColor: "rgba(255,0,0,0.2)",
    });
    expect(plugin.defaultState.color).toBe("rgba(255,0,0,1)");
    expect(plugin.defaultState.fillColor).toBe("rgba(255,0,0,0.2)");
  });
});

describe("connectAndrewsPitchfork", () => {
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

  it("registers the pitchfork primitive on connect", () => {
    const env = mockChart();
    connectAndrewsPitchfork(env.chart, anchors);
    expect(env.registrations).toHaveLength(1);
    expect(env.registrations[0].name).toBe("andrewsPitchfork");
  });

  it("re-registers with new anchors on update()", () => {
    const env = mockChart();
    const handle = connectAndrewsPitchfork(env.chart, anchors);
    handle.update({
      p0: { index: 1, price: 50 },
      p1: { index: 2, price: 60 },
      p2: { index: 3, price: 55 },
    });
    expect(env.registrations).toHaveLength(2);
  });

  it("removes via remove()", () => {
    const env = mockChart();
    const handle = connectAndrewsPitchfork(env.chart, anchors);
    handle.remove();
    expect(env.removals).toEqual(["andrewsPitchfork"]);
  });
});
