import { describe, expect, it, vi } from "vitest";
import type { PrimitiveRenderContext } from "../core/plugin-types";
import type { PriceScale, TimeScale } from "../core/scale";
import type { ChartInstance, PaneRect } from "../core/types";
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
    fillText: vi.fn(),
    measureText: vi.fn((text: string) => ({ width: text.length * 5.5 })),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "" as CanvasTextAlign,
    textBaseline: "" as CanvasTextBaseline,
  }) as unknown as CanvasRenderingContext2D;

const candles = Array.from({ length: 50 }, (_, i) => ({
  time: 1000 + i * 60,
  high: 110 + Math.random() * 5,
  low: 95 + Math.random() * 5,
}));

const mockTs = () =>
  ({ startIndex: 0, endIndex: 50, barSpacing: 8, indexToX: (i: number) => i * 8 + 4 }) as TimeScale;

const mockPs = () => ({ priceToY: (p: number) => 400 - p * 2 }) as PriceScale;

const mockPane = { id: "main", x: 0, y: 0, width: 800, height: 400 } as PaneRect;

const makeCtx = (ctx: CanvasRenderingContext2D) =>
  ({ ctx, pane: mockPane, timeScale: mockTs(), priceScale: mockPs() }) as PrimitiveRenderContext;

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

  it("renders a P&L label near the exit dot by default (formatted with sign)", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 5 * 60,
        exitPrice: 108,
        returnPercent: 8.25,
        direction: "long" as const,
      },
      {
        entryTime: 1000 + 6 * 60,
        entryPrice: 110,
        exitTime: 1000 + 12 * 60,
        exitPrice: 105,
        returnPercent: -4.55,
        direction: "long" as const,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles);
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    expect(ctx.fillText).toHaveBeenCalledWith("+8.25%", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("-4.55%", expect.any(Number), expect.any(Number));
  });

  it("omits the P&L label when showPnlLabel is false", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 5 * 60,
        exitPrice: 108,
        returnPercent: 8,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles, { showPnlLabel: false });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some((c) => typeof c[0] === "string" && c[0].endsWith("%"))).toBe(false);
  });

  it("does not render MFE/MAE end-of-line price labels by default", () => {
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

    // Default `showMfeMaeLabels: false` — only the P&L label fires; no
    // standalone numeric price labels for the dashed lines.
    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const numericLabels = calls.filter((c) => /^\d/.test(String(c[0])));
    expect(numericLabels).toHaveLength(0);
  });

  it("renders MFE/MAE price labels when showMfeMaeLabels is true", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 5 * 60,
        exitPrice: 105,
        returnPercent: 5,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles, { showMfeMaeLabels: true });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    // MFE + MAE labels should each fire once. Their content is the
    // computed price level (numeric, formatted by the default formatter).
    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const numericLabels = calls.filter((c) => /^\d/.test(String(c[0])));
    expect(numericLabels.length).toBeGreaterThanOrEqual(2);
  });

  it("default price formatter adapts decimals to magnitude (FX / low-priced crypto safe)", () => {
    // Single trade on a low-priced crypto-style instrument: candles in
    // the 0.0001 range. Without magnitude-aware formatting the labels
    // collapse to "0.00" and become unreadable.
    const microCandles = Array.from({ length: 10 }, (_, i) => ({
      time: 1000 + i * 60,
      high: 0.000123 + i * 0.000001,
      low: 0.000115 + i * 0.000001,
    }));
    const trades = [
      {
        entryTime: microCandles[0].time,
        entryPrice: 0.000118,
        exitTime: microCandles[5].time,
        exitPrice: 0.000122,
        returnPercent: 3.39,
      },
    ];
    const plugin = createTradeAnalysis(trades, microCandles, { showMfeMaeLabels: true });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const priceLabels = calls
      .map((c) => String(c[0]))
      .filter((s) => /^\d/.test(s) && !s.endsWith("%"));

    // No "0.00" labels — the formatter must keep enough decimals to
    // distinguish MFE and MAE values in this magnitude.
    expect(priceLabels.every((s) => s !== "0.00" && s !== "0")).toBe(true);
    // The two distinct levels should produce distinct text.
    expect(new Set(priceLabels).size).toBeGreaterThanOrEqual(2);
  });

  it("respects a custom priceFormatter", () => {
    const trades = [
      {
        entryTime: 1000,
        entryPrice: 100,
        exitTime: 1000 + 5 * 60,
        exitPrice: 105,
        returnPercent: 5,
      },
    ];
    const plugin = createTradeAnalysis(trades, candles, {
      showMfeMaeLabels: true,
      priceFormatter: (p) => `$${p.toFixed(0)}`,
    });
    const ctx = mockCtx();
    plugin.render(makeCtx(ctx), plugin.defaultState);

    const calls = (ctx.fillText as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const dollarLabels = calls.filter((c) => /^\$\d/.test(String(c[0])));
    expect(dollarLabels.length).toBeGreaterThanOrEqual(2);
  });
});

describe("connectTradeAnalysis", () => {
  it("registers primitive and returns handle", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    const handle = connectTradeAnalysis(chart, [], []);
    expect(chart.registerPrimitive).toHaveBeenCalledOnce();
    expect(typeof handle.remove).toBe("function");
  });

  it("remove() calls chart.removePrimitive", () => {
    const chart = {
      registerPrimitive: vi.fn(),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;
    connectTradeAnalysis(chart, [], []).remove();
    expect(chart.removePrimitive).toHaveBeenCalledWith("tradeAnalysis");
  });

  it("update() preserves last-applied options across data-only refreshes", () => {
    // Toggle showPnlLabel off once, then refresh trade data without
    // re-passing options. The toggle must stay off — same contract as
    // connectRegimeHeatmap / connectVolumeProfile.
    const registrations: Array<{ defaultState: { options: { showPnlLabel: boolean } } }> = [];
    const chart = {
      registerPrimitive: vi.fn((p) => {
        registrations.push(p as (typeof registrations)[number]);
      }),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;

    const handle = connectTradeAnalysis(chart, [], [], { showPnlLabel: true });
    handle.update([], [], { showPnlLabel: false });
    handle.update([], []); // data-only refresh

    expect(registrations).toHaveLength(3);
    expect(registrations[0].defaultState.options.showPnlLabel).toBe(true);
    expect(registrations[1].defaultState.options.showPnlLabel).toBe(false);
    expect(registrations[2].defaultState.options.showPnlLabel).toBe(false);
  });

  it("update() merges partial option objects instead of replacing them", () => {
    // Initial connect sets multiple fields. A subsequent partial update
    // toggling only one of them must preserve the others — otherwise a
    // host that flips showPnlLabel via update() would silently lose any
    // showMfeMaeLabels / priceFormatter previously installed.
    const registrations: Array<{
      defaultState: {
        options: {
          showPnlLabel: boolean;
          showMfeMaeLabels: boolean;
          priceFormatter: (p: number) => string;
        };
      };
    }> = [];
    const chart = {
      registerPrimitive: vi.fn((p) => {
        registrations.push(p as (typeof registrations)[number]);
      }),
      removePrimitive: vi.fn(),
    } as unknown as ChartInstance;

    const customFormatter = (p: number) => `¥${p.toFixed(0)}`;
    const handle = connectTradeAnalysis(chart, [], [], {
      showMfeMaeLabels: true,
      priceFormatter: customFormatter,
    });
    handle.update([], [], { showPnlLabel: false });

    expect(registrations).toHaveLength(2);
    // After the partial toggle, both the original showMfeMaeLabels AND
    // the custom formatter must still be in effect.
    expect(registrations[1].defaultState.options.showMfeMaeLabels).toBe(true);
    expect(registrations[1].defaultState.options.priceFormatter).toBe(customFormatter);
    expect(registrations[1].defaultState.options.showPnlLabel).toBe(false);
  });
});
