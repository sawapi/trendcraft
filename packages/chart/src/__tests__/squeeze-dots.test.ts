import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";
import { createSqueezeDots } from "../plugins/squeeze-dots";

function mockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

const mockTimeScale = {
  startIndex: 0,
  endIndex: 50,
  barSpacing: 8,
  indexToX: (i: number) => i * 8 + 4,
} as TimeScale;

const mockPriceScale = { priceToY: (p: number) => 400 - p * 2 } as PriceScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as PaneRect;
const mockTheme = { text: "#fff", textSecondary: "#888" } as ThemeColors;

function makeCtx(ctx: CanvasRenderingContext2D): PrimitiveRenderContext {
  return {
    ctx,
    pane: mockPane,
    timeScale: mockTimeScale,
    priceScale: mockPriceScale,
    theme: mockTheme,
  } as PrimitiveRenderContext;
}

const candles = Array.from({ length: 30 }, (_, i) => ({ time: 1000 + i }));

describe("createSqueezeDots", () => {
  it("returns a primitive plugin with correct identity", () => {
    const plugin = createSqueezeDots([], candles);
    expect(plugin.name).toBe("squeezeDots");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders nothing when no signals are present", () => {
    const plugin = createSqueezeDots([], candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("draws a dot for each squeeze bar plus a release dot after the run", () => {
    const signals = [
      { time: 1005, type: "squeeze" as const },
      { time: 1006, type: "squeeze" as const },
      { time: 1007, type: "squeeze" as const },
    ];
    const plugin = createSqueezeDots(signals, candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    // 3 squeeze bars + 1 release bar at index 1008 = 4 fillRect calls
    expect(ctx.fillRect).toHaveBeenCalledTimes(4);
  });

  it("does not emit a release dot when the squeeze runs to the last candle", () => {
    const lastIdx = candles.length - 1;
    const signals = [{ time: candles[lastIdx].time, type: "squeeze" as const }];
    const plugin = createSqueezeDots(signals, candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    // 1 squeeze bar, no release bar
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it("respects showRail option", () => {
    const signals = [{ time: 1005, type: "squeeze" as const }];
    const plugin = createSqueezeDots(signals, candles, { showRail: false });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.setLineDash).not.toHaveBeenCalled();
  });
});
