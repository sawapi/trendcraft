import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";
import { createPricePatterns, type PricePatternSignal } from "../plugins/price-patterns";

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
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 30 }) as TextMetrics),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textBaseline: "",
    textAlign: "",
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

function makeSignal(overrides: Partial<PricePatternSignal> = {}): PricePatternSignal {
  return {
    type: "double_bottom",
    confidence: 80,
    pattern: {
      startTime: 1000,
      endTime: 2000,
      keyPoints: [
        { index: 5, price: 100, label: "First Trough" },
        { index: 15, price: 110, label: "Pull-back Peak" },
        { index: 25, price: 100, label: "Second Trough" },
      ],
      neckline: { startPrice: 110, endPrice: 110, currentPrice: 110 },
      target: 120,
    },
    ...overrides,
  };
}

describe("createPricePatterns", () => {
  it("returns a primitive plugin with stable identity", () => {
    const plugin = createPricePatterns([]);
    expect(plugin.name).toBe("trendcraft-price-patterns");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders nothing when no signals are present", () => {
    const plugin = createPricePatterns([]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    // Pane clip still fires (it always runs), but no fill / stroke happens.
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws zigzag + neckline + body shading + target for an in-range pattern", () => {
    const plugin = createPricePatterns([makeSignal()]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.stroke).toHaveBeenCalled(); // zigzag + neckline + target line
    expect(ctx.fill).toHaveBeenCalled(); // body shading + label pills
    expect(ctx.setLineDash).toHaveBeenCalledWith([5, 4]);
    expect(ctx.setLineDash).toHaveBeenCalledWith([3, 3]);
  });

  it("filters patterns below the minConfidence threshold", () => {
    const low = makeSignal({ confidence: 20 });
    const plugin = createPricePatterns([low], { minConfidence: 60 });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("dedups overlapping patterns by keeping the higher-confidence one", () => {
    const a = makeSignal({ confidence: 70 });
    const b = makeSignal({ confidence: 90 });
    const plugin = createPricePatterns([a, b]);
    expect(plugin.defaultState.renders).toHaveLength(1);
    expect(plugin.defaultState.renders[0].signal.confidence).toBe(90);
  });

  it("colors bearish pattern types with the bear palette", () => {
    const top = makeSignal({ type: "double_top" });
    const plugin = createPricePatterns([top]);
    expect(plugin.defaultState.renders[0].bullish).toBe(false);
  });

  it("respects bullishTypes override", () => {
    const top = makeSignal({ type: "custom_bull" });
    const plugin = createPricePatterns([top], { bullishTypes: ["custom_bull"] });
    expect(plugin.defaultState.renders[0].bullish).toBe(true);
  });

  it("skips a pattern entirely when its key points fall outside the visible range", () => {
    const offscreen = makeSignal({
      pattern: {
        startTime: 1000,
        endTime: 2000,
        keyPoints: [
          { index: 100, price: 100, label: "First Trough" },
          { index: 110, price: 110, label: "Second Trough" },
        ],
      },
    });
    const plugin = createPricePatterns([offscreen]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("suppresses an anchor label when overridden to null", () => {
    const plugin = createPricePatterns([makeSignal()], {
      anchorLabels: { "First Trough": null },
    });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    // fillText runs once per visible label; without the suppressed "First Trough"
    // we have "Bottom 2" + "Target".
    const calls = (ctx.fillText as unknown as { mock: { calls: unknown[] } }).mock.calls;
    expect(calls.length).toBe(2);
  });
});
