import { describe, expect, it, vi } from "vitest";
import { autoFormatPrice } from "../core/format";
import { wallClock } from "../core/time-zone";
import type { CandleData } from "../core/types";
import { DARK_THEME } from "../core/types";
import {
  renderGrid,
  renderPriceAxis,
  renderReferenceLines,
  renderTimeAxis,
  timeAxisMarks,
} from "../renderer/axis-renderer";
import { makeCandle, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

vi.mock("../core/time-zone", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../core/time-zone")>();
  return { ...actual, wallClock: vi.fn(actual.wallClock) };
});

const theme = DARK_THEME;

describe("renderPriceAxis", () => {
  it("draws background, border, and tick labels (right)", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11);

    expect(ctx.fillRect).toHaveBeenCalled(); // background
    expect(ctx.stroke).toHaveBeenCalled(); // border
    expect(ctx.fillText).toHaveBeenCalled(); // tick labels
  });

  it("positions labels on left when position='left'", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx, ps, 60, 0, 60, 400, theme, 11, undefined, "left");

    expect(ctx.textAlign).toBe("right");
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("honors maxTicks — fewer labels on a short pane", () => {
    const ctx1 = mockCtx();
    const ctx2 = mockCtx();
    const ps1 = makePriceScale(400, 100, 200);
    const ps2 = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx1, ps1, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 6,
    });
    renderPriceAxis(ctx2, ps2, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 2,
    });
    const calls6 = (ctx1.fillText as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const calls2 = (ctx2.fillText as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(calls2).toBeLessThanOrEqual(calls6);
  });

  it("skips tick labels inside any excludeYRanges entry (multi-badge case)", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    const y150 = ps.priceToY(150);
    const y125 = ps.priceToY(125);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 6,
      excludeYRanges: [
        { y: y150, half: 8 },
        { y: y125, half: 8 },
      ],
    });
    const calls = (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const [, , yArg] of calls) {
      expect(Math.abs((yArg as number) - y150)).toBeGreaterThanOrEqual(10);
      expect(Math.abs((yArg as number) - y125)).toBeGreaterThanOrEqual(10);
    }
  });

  it("skips tick labels inside excludeY ± excludeHalfHeight (current-price badge)", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    // Current price 150 maps to y = 200 on a 400px scale with range 100..200.
    const excludeY = ps.priceToY(150);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 6,
      excludeY,
      excludeHalfHeight: 8,
    });
    const calls = (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const [, , yArg] of calls) {
      expect(Math.abs((yArg as number) - excludeY)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("renderTimeAxis", () => {
  it("draws background, border, and time labels", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(50, 800);
    const candles = Array.from({ length: 50 }, (_, i) =>
      makeCandle(1609459200000 + i * 86400000, 100 + i),
    );
    renderTimeAxis(ctx, candles, ts, 0, 400, 740, 24, theme, 11);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("uses custom time formatter when provided", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const candles = Array.from({ length: 5 }, (_, i) =>
      makeCandle(1609459200000 + i * 86400000, 100),
    );
    const formatter = (time: number) => `T${time}`;
    renderTimeAxis(ctx, candles, ts, 0, 400, 740, 24, theme, 11, formatter);

    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe("renderTimeAxis calendar marks", () => {
  // Weekday bars from 2016-02-22 to 2026-10-30, about 2,800 of them.
  const weekdays = () => {
    const out: CandleData[] = [];
    for (let t = Date.UTC(2016, 1, 22); t <= Date.UTC(2026, 9, 30); t += 86_400_000) {
      const day = new Date(t).getUTCDay();
      if (day !== 0 && day !== 6) out.push(makeCandle(t, 100));
    }
    return out;
  };
  const firstBarOfYear = (candles: CandleData[], year: number) =>
    candles.findIndex((c) => new Date(c.time).getUTCFullYear() === year);
  const texts = (ctx: CanvasRenderingContext2D) =>
    (ctx.fillText as unknown as { mock: { calls: [string, number, number][] } }).mock.calls;

  // Labels sat every N bars, so "2017" landed on whichever 2017 bar the
  // interval reached first — 2017-08-18 on a 1,200px chart of this data.
  it("puts each year label on the year's first bar", () => {
    const candles = weekdays();
    const ts = makeTimeScale(candles.length, 1200);
    ts.timeZone = "UTC";
    const ctx = mockCtx();
    renderTimeAxis(ctx, candles, ts, 0, 400, 1140, 24, theme, 11);
    const years = texts(ctx).filter(([t]) => /^\d{4}$/.test(t));
    expect(years.map(([t]) => t)).toEqual([
      "2017",
      "2018",
      "2019",
      "2020",
      "2021",
      "2022",
      "2023",
      "2024",
      "2025",
      "2026",
    ]);
    for (const [t, x] of years) {
      expect(x).toBeCloseTo(ts.indexToX(firstBarOfYear(candles, Number(t))), 6);
    }
  });

  it("draws the vertical grid at the same bars", () => {
    const candles = weekdays();
    const ts = makeTimeScale(candles.length, 1200);
    ts.timeZone = "UTC";
    const ctx = mockCtx();
    renderGrid(ctx, makePriceScale(), 0, 0, 1140, 400, theme, ts, candles);
    const xs = (ctx.moveTo as unknown as { mock: { calls: [number, number][] } }).mock.calls.map(
      ([x]) => x,
    );
    expect(xs).toContain(Math.round(ts.indexToX(firstBarOfYear(candles, 2017))) + 0.5);
  });

  it("marks month starts when zoomed in", () => {
    const candles = weekdays();
    const ts = makeTimeScale(candles.length, 1200);
    ts.timeZone = "UTC";
    ts.setVisibleRange(firstBarOfYear(candles, 2020), firstBarOfYear(candles, 2021));
    const marks = timeAxisMarks(candles, ts);
    const monthStarts = [...candles.keys()].filter((i) => {
      const d = new Date(candles[i].time);
      return (
        d.getUTCFullYear() === 2020 &&
        i > 0 &&
        d.getUTCMonth() !== new Date(candles[i - 1].time).getUTCMonth()
      );
    });
    expect(monthStarts).toHaveLength(12);
    expect(marks).toEqual(expect.arrayContaining(monthStarts));
  });
});

describe("timeAxisMarks while panning and streaming", () => {
  const daily = (from: number, count: number) =>
    Array.from({ length: count }, (_, i) => makeCandle(from + i * 86_400_000, 100));

  // Picking over the visible bars alone made the marks alternate (Feb/Apr
  // vs Mar/May) as a month boundary left the view.
  it("keeps the same marks while panning", () => {
    const candles = daily(Date.UTC(2019, 0, 1), 1500);
    const ts = makeTimeScale(candles.length, 800);
    ts.timeZone = "UTC";
    const seen = new Map<number, boolean>();
    for (let shift = 0; shift < 60; shift++) {
      ts.setVisibleRange(300 + shift, 600 + shift);
      const marks = new Set(timeAxisMarks(candles, ts));
      for (let i = 300 + shift; i < 600 + shift; i++) {
        const was = seen.get(i);
        if (was !== undefined) expect(marks.has(i)).toBe(was);
        seen.set(i, marks.has(i));
      }
    }
  });

  // DataLayer trims maxCandles in place: same array, same length, every
  // index shifted by one.
  it("recomputes after the array is trimmed in place", () => {
    const candles = daily(Date.UTC(2016, 0, 1), 1200);
    const ts = makeTimeScale(candles.length, 800);
    ts.timeZone = "UTC";
    timeAxisMarks(candles, ts);
    for (let k = 0; k < 5; k++) {
      candles.push(makeCandle(candles[candles.length - 1].time + 86_400_000, 100));
      candles.splice(0, 1);
    }
    expect(timeAxisMarks(candles, ts)).toEqual(timeAxisMarks([...candles], ts));
  });

  // Two charts on one page draw from two arrays every frame.
  it("keeps the marks of two arrays cached side by side", () => {
    const a = daily(Date.UTC(2016, 0, 1), 1200);
    const b = daily(Date.UTC(2018, 0, 1), 900);
    const ts = makeTimeScale(1200, 800);
    ts.timeZone = "UTC";
    timeAxisMarks(a, ts);
    timeAxisMarks(b, ts);
    vi.mocked(wallClock).mockClear();
    for (let frame = 0; frame < 3; frame++) {
      timeAxisMarks(a, ts);
      timeAxisMarks(b, ts);
    }
    expect(wallClock).not.toHaveBeenCalled();
  });
});

describe("renderGrid", () => {
  it("draws horizontal grid lines", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderGrid(ctx, ps, 0, 0, 740, 400, theme);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws vertical grid lines when timeScale and candles are provided", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    const ts = makeTimeScale(50, 800);
    const candles = Array.from({ length: 50 }, (_, i) => makeCandle(i, 100));
    renderGrid(ctx, ps, 0, 0, 740, 400, theme, ts, candles);

    // Should have drawn more lines than just horizontal
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe("renderReferenceLines", () => {
  it("draws dashed lines at specified values", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 0, 100);
    renderReferenceLines(ctx, [30, 70], ps, 0, 0, 740, "#787b86");

    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // Resets dash at end
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]);
  });

  it("handles empty lines array", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 0, 100);
    renderReferenceLines(ctx, [], ps, 0, 0, 740, "#787b86");
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe("renderPriceAxis tick label decimals", () => {
  const labels = (ctx: CanvasRenderingContext2D) =>
    (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(
      ([text]) => text as string,
    );
  const decimals = (label: string) => (label.includes(".") ? label.split(".")[1].length : 0);

  // Each tick used to be formatted by its own magnitude, so one axis read
  // "20.000, 40.000, 80.000, 100.00, 120.00" and an RSI pane "50.000" next
  // to "100.00". The decimals now come from the tick step, as in Chart.js and
  // d3, and every label on the axis shares them.
  it("gives a price axis that crosses 100 one number of decimals", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 15, 145), 740, 0, 60, 400, theme, 11);
    const texts = labels(ctx);
    expect(texts.length).toBeGreaterThan(2);
    expect(new Set(texts.map(decimals)).size).toBe(1);
  });

  it("labels a 0–100 oscillator pane without decimals", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 0, 100), 740, 0, 60, 400, theme, 11);
    const texts = labels(ctx);
    expect(texts.length).toBeGreaterThan(2);
    for (const t of texts) expect(t).toMatch(/^-?\d+$/);
  });

  it("keeps as many decimals as a small step needs", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 1.21, 1.29), 740, 0, 60, 400, theme, 11);
    const texts = labels(ctx);
    expect(texts.length).toBeGreaterThan(2);
    expect(new Set(texts.map(decimals)).size).toBe(1);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("fits labels of prices in the hundreds of billions in the axis", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 2.8e10, 1.4e11), 740, 0, 60, 400, theme, 11);
    const texts = labels(ctx);
    expect(texts.length).toBeGreaterThan(2);
    for (const t of texts) expect(t).toMatch(/^\d+B$/);
  });

  it("spreads log-axis labels over the pane", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 0.28, 1.4e11);
    ps.setMode("log");
    ps.setDataRange(0.28, 1.4e11);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11);
    const calls = (ctx.fillText as unknown as { mock: { calls: [string, number, number][] } }).mock
      .calls;
    expect(calls.length).toBeGreaterThan(3);
    expect(calls.map(([t]) => t)).toEqual(["1", "100", "10000", "1M", "100M", "10B"]);
    const ys = calls.map(([, , y]) => y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThan(20);
  });

  it("uses autoFormatPrice as given when the caller passes it", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 15, 145), 740, 0, 60, 400, theme, 11, autoFormatPrice);
    expect(labels(ctx)).toContain("20.000");
  });

  it("still uses a priceFormatter the caller passes", () => {
    const ctx = mockCtx();
    renderPriceAxis(ctx, makePriceScale(400, 0, 100), 740, 0, 60, 400, theme, 11, (p) => `$${p}`);
    for (const t of labels(ctx)) expect(t.startsWith("$")).toBe(true);
  });
});
