import { describe, expect, it, type vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import { type ChartPatternSignal, renderPatterns } from "../renderer/pattern-renderer";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function dl(): DataLayer {
  const d = new DataLayer();
  d.setCandles(Array.from({ length: 30 }, (_, i) => makeCandle(i * 60_000, 100 + i)));
  return d;
}

function pat(overrides: Partial<ChartPatternSignal> = {}): ChartPatternSignal {
  return {
    time: 0,
    type: "double_top",
    pattern: {
      startTime: 0,
      endTime: 600_000,
      keyPoints: [
        { time: 60_000, index: 1, price: 110, label: "A" },
        { time: 180_000, index: 3, price: 120, label: "B" },
        { time: 300_000, index: 5, price: 115, label: "C" },
      ],
    },
    confidence: 85,
    confirmed: true,
    ...overrides,
  };
}

describe("renderPatterns", () => {
  const panes = [makePane("main", 300)];
  const ts = makeTimeScale(30, 800);
  const ps = makePriceScale(300, 90, 130);
  const priceScales = new Map([["main", ps]]);

  it("no-ops on empty array", () => {
    const ctx = mockCtx();
    renderPatterns(ctx, [], panes, priceScales, ts, dl(), DARK_THEME, 11);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("no-op without main pane", () => {
    const ctx = mockCtx();
    renderPatterns(ctx, [pat()], [makePane("other")], priceScales, ts, dl(), DARK_THEME, 11);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("no-op without main price scale", () => {
    const ctx = mockCtx();
    renderPatterns(ctx, [pat()], panes, new Map(), ts, dl(), DARK_THEME, 11);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("skips patterns with fewer than 2 key points", () => {
    const ctx = mockCtx();
    renderPatterns(
      ctx,
      [
        pat({
          pattern: {
            startTime: 0,
            endTime: 60_000,
            keyPoints: [{ time: 0, index: 0, price: 100, label: "X" }],
          },
        }),
      ],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    // save/restore still happens; but no stroke for outline
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("draws bullish pattern with green color", () => {
    const ctx = mockCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokes.push(v);
      },
      get() {
        return "";
      },
    });
    renderPatterns(
      ctx,
      [pat({ type: "inverse_head_and_shoulders" })],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(strokes).toContain("#26a69a");
  });

  it("draws bearish pattern with red color", () => {
    const ctx = mockCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokes.push(v);
      },
      get() {
        return "";
      },
    });
    renderPatterns(
      ctx,
      [pat({ type: "double_top" })],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(strokes).toContain("#ef5350");
  });

  it("draws neutral pattern with orange color", () => {
    const ctx = mockCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokes.push(v);
      },
      get() {
        return "";
      },
    });
    renderPatterns(
      ctx,
      [pat({ type: "symmetrical_triangle" })],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(strokes).toContain("#FF9800");
  });

  it.each([
    ["bullish_flag", "bullish"],
    ["ascending_triangle", "bullish"],
    ["double_bottom", "bullish"],
    ["falling_wedge", "bullish"],
    ["descending_triangle", "bearish"],
    ["rising_wedge", "bearish"],
    ["bear_pennant", "bearish"],
  ])("classifies %s as %s", (type, expected) => {
    const ctx = mockCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokes.push(v);
      },
      get() {
        return "";
      },
    });
    renderPatterns(ctx, [pat({ type })], panes, priceScales, ts, dl(), DARK_THEME, 11);
    const expectedColor = expected === "bullish" ? "#26a69a" : "#ef5350";
    expect(strokes).toContain(expectedColor);
  });

  it("draws neckline when present", () => {
    const ctx = mockCtx();
    const dashes: number[][] = [];
    (ctx.setLineDash as ReturnType<typeof vi.fn>).mockImplementation((d: number[]) => {
      dashes.push([...d]);
    });
    renderPatterns(
      ctx,
      [
        pat({
          pattern: {
            ...pat().pattern,
            neckline: { startPrice: 110, endPrice: 112, slope: 0.01, currentPrice: 111 },
          },
        }),
      ],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(dashes).toEqual(expect.arrayContaining([[6, 3]]));
  });

  it("draws target line and label when target present", () => {
    const ctx = mockCtx();
    const texts: string[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
      texts.push(t);
    });
    renderPatterns(
      ctx,
      [pat({ pattern: { ...pat().pattern, target: 130 } })],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(texts.some((t) => t.startsWith("T:"))).toBe(true);
  });

  it("includes pattern name and confidence in label", () => {
    const ctx = mockCtx();
    const texts: string[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
      texts.push(t);
    });
    renderPatterns(
      ctx,
      [pat({ type: "head_and_shoulders", confidence: 72 })],
      panes,
      priceScales,
      ts,
      dl(),
      DARK_THEME,
      11,
    );
    expect(texts.some((t) => t.includes("head and shoulders") && t.includes("72%"))).toBe(true);
  });
});
