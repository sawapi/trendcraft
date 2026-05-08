import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { PaneRect, ThemeColors } from "../core/types";
import {
  createPricePatterns,
  filterPricePatterns,
  type PricePatternSignal,
} from "../plugins/price-patterns";

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

  it("classifies bearish PatternType values with direction='bear'", () => {
    const top = makeSignal({ type: "double_top" });
    const plugin = createPricePatterns([top]);
    expect(plugin.defaultState.renders[0].direction).toBe("bear");
  });

  it("classifies every documented bullish PatternType with direction='bull'", () => {
    const bullishTypes = [
      "double_bottom",
      "inverse_head_shoulders",
      "cup_handle",
      "triangle_ascending",
      "falling_wedge",
      "bull_flag",
      "bull_pennant",
      "gartley_bullish",
      "butterfly_bullish",
      "bat_bullish",
      "crab_bullish",
      "shark_bullish",
    ];
    for (const type of bullishTypes) {
      const plugin = createPricePatterns([makeSignal({ type })]);
      expect(plugin.defaultState.renders[0].direction, `${type} should be bull`).toBe("bull");
    }
  });

  it("classifies every documented bearish PatternType with direction='bear'", () => {
    const bearishTypes = [
      "double_top",
      "head_shoulders",
      "triangle_descending",
      "rising_wedge",
      "bear_flag",
      "bear_pennant",
      "gartley_bearish",
      "butterfly_bearish",
      "bat_bearish",
      "crab_bearish",
      "shark_bearish",
    ];
    for (const type of bearishTypes) {
      const plugin = createPricePatterns([makeSignal({ type })]);
      expect(plugin.defaultState.renders[0].direction, `${type} should be bear`).toBe("bear");
    }
  });

  it("classifies direction-neutral PatternType values with direction='neutral'", () => {
    // Without the neutral track, ambiguous-breakout types would fall
    // through to the bearish palette. Channels (ascending/descending/
    // horizontal) and symmetric triangles describe the *envelope* shape
    // but commit no breakout direction, so they should render neutral
    // until a host explicitly classifies them via `bullishTypes` /
    // `bearishTypes`.
    const neutralTypes = [
      "triangle_symmetrical",
      "channel_horizontal",
      "channel_ascending",
      "channel_descending",
    ];
    for (const type of neutralTypes) {
      const plugin = createPricePatterns([makeSignal({ type })]);
      expect(plugin.defaultState.renders[0].direction, `${type} should be neutral`).toBe("neutral");
    }
  });

  it("respects bullishTypes override", () => {
    const top = makeSignal({ type: "custom_bull" });
    const plugin = createPricePatterns([top], { bullishTypes: ["custom_bull"] });
    expect(plugin.defaultState.renders[0].direction).toBe("bull");
  });

  it("respects bearishTypes override", () => {
    const sig = makeSignal({ type: "custom_bear" });
    const plugin = createPricePatterns([sig], { bearishTypes: ["custom_bear"] });
    expect(plugin.defaultState.renders[0].direction).toBe("bear");
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

  it("filterPricePatterns matches the internal filter so callers can pre-check", () => {
    // Three signals: one below the default 60 confidence floor, two above
    // but with overlapping envelopes — only the higher-confidence one of
    // the two should survive, plus zero from the low-confidence one.
    const lowConf = makeSignal({ confidence: 30 });
    const a = makeSignal({ confidence: 75 });
    const b = makeSignal({ confidence: 90 });
    const out = filterPricePatterns([lowConf, a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(90);
  });

  it("filterPricePatterns honors maxPatterns", () => {
    const sigs = Array.from({ length: 5 }, (_, i) =>
      makeSignal({
        confidence: 70 + i,
        pattern: {
          startTime: i * 10000,
          endTime: i * 10000 + 100,
          keyPoints: [{ index: i, price: 100, label: "First Trough" }],
        },
      }),
    );
    expect(filterPricePatterns(sigs, { maxPatterns: 3 })).toHaveLength(3);
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
