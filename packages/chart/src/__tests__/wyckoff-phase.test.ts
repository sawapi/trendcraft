import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { ChartInstance, PaneRect } from "../core/types";
import { connectWyckoffPhase, createWyckoffPhase } from "../plugins/wyckoff-phase";

const mockCtx = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 5.5 })),
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
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

const mockPs = () => ({ priceToY: (p: number) => 400 - p * 2 }) as PriceScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as PaneRect;

const makeCtx = (ctx: CanvasRenderingContext2D, ts = mockTs(), ps = mockPs()) =>
  ({ ctx, pane: mockPane, timeScale: ts, priceScale: ps }) as PrimitiveRenderContext;

describe("createWyckoffPhase", () => {
  it("returns a valid PrimitivePlugin", () => {
    const plugin = createWyckoffPhase([]);
    expect(plugin.name).toBe("wyckoffPhase");
    expect(plugin.pane).toBe("main");
    expect(plugin.zOrder).toBe("above");
  });

  it("renders timeline bar for each data point", () => {
    const phases = [
      { time: 1000, value: { phase: "accumulation", confidence: 80 } },
      { time: 1060, value: { phase: "markup", confidence: 60 } },
      { time: 1120, value: { phase: "distribution", confidence: 90 } },
    ];
    const plugin = createWyckoffPhase(phases);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 3)), plugin.defaultState);
    // Each bar in timeline bar → 3 fillRects (at minimum; the corner badge
    // adds one more). Confirm timeline rendered at least 3.
    const fillRectCalls = (ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(fillRectCalls).toBeGreaterThanOrEqual(3);
  });

  it("draws a range box when accumulation/distribution has valid rangeHigh/rangeLow", () => {
    const phases = [
      {
        time: 1000,
        value: { phase: "accumulation", confidence: 50, rangeHigh: 110, rangeLow: 100 },
      },
      {
        time: 1060,
        value: { phase: "accumulation", confidence: 60, rangeHigh: 110, rangeLow: 100 },
      },
      {
        time: 1120,
        value: { phase: "accumulation", confidence: 70, rangeHigh: 110, rangeLow: 100 },
      },
    ];
    const plugin = createWyckoffPhase(phases);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 3)), plugin.defaultState);
    // At least one strokeRect call for the range box border.
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("renders event label text at the bar where an event fires", () => {
    const phases = [
      {
        time: 1000,
        value: {
          phase: "accumulation",
          confidence: 40,
          event: "SC",
          rangeHigh: 110,
          rangeLow: 100,
        },
      },
    ];
    const plugin = createWyckoffPhase(phases);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 1)), plugin.defaultState);
    // Event label "SC" should have been drawn (at least once).
    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => c[0] === "SC")).toBe(true);
  });

  it("renders the corner phase badge with current phase text", () => {
    const phases = [
      { time: 1000, value: { phase: "distribution", confidence: 72, subPhase: "phase_B" } },
    ];
    const plugin = createWyckoffPhase(phases);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 1)), plugin.defaultState);
    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const badgeCall = calls.find((c) => typeof c[0] === "string" && c[0].includes("Wyckoff:"));
    expect(badgeCall).toBeDefined();
    expect(badgeCall?.[0]).toContain("Distribution");
    expect(badgeCall?.[0]).toContain("72");
  });

  it("renders VSA event markers as dots", () => {
    const phases = [{ time: 1000, value: { phase: "accumulation" } }];
    const vsa = [{ time: 1000, value: { barType: "spring", isEffortDivergence: false } }];
    const plugin = createWyckoffPhase(phases, vsa);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 1)), plugin.defaultState);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("skips normal VSA bars", () => {
    const phases = [{ time: 1000, value: { phase: "accumulation" } }];
    const vsa = [{ time: 1000, value: { barType: "normal", isEffortDivergence: false } }];
    const plugin = createWyckoffPhase(phases, vsa, [], {
      showEventLabels: false, // event-label dots use arc too, so disable to isolate VSA check
    });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx, mockTs(0, 1)), plugin.defaultState);
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("handles empty data", () => {
    const plugin = createWyckoffPhase([]);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("connectWyckoffPhase", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    const handle = connectWyckoffPhase(chart, { phases: [] });
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    connectWyckoffPhase(chart, { phases: [] }).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("wyckoffPhase");
  });
});
