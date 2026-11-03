/**
 * The crosshair and the candle wick are 1 px lines at round(x) + 0.5, so they
 * fill pixel column round(x). Candle bodies and volume / histogram bars must
 * be centred on that column, with whole-pixel edges. Rounding the left edge
 * and the width separately put some bodies a pixel off, and volume bars
 * had fractional edges that drifted up to a pixel from the crosshair.
 */
import { describe, expect, it } from "vitest";
import { barLeft, oddPixelWidth } from "../core/draw-helper";
import { TimeScale } from "../core/scale";
import { DARK_THEME } from "../core/types/theme";
import { renderCandlesticks } from "../series/candlestick";
import { renderVolume } from "../series/histogram";
import { makeCandle, makePriceScale, mockCtx } from "./helpers/mock-ctx";

const SPACINGS = [3.1, 4.9, 5, 6.2, 7.9, 8.4, 9.99, 12.37, 17.5, 25];

function scale(spacing: number): TimeScale {
  const ts = new TimeScale();
  ts.setTotalCount(400);
  ts.setWidth(800);
  // A fractional offset so bar centres do not sit on whole pixels
  ts.setVisibleLogicalRange(10.37, 10.37 + 800 / spacing);
  return ts;
}

function fillRects(ctx: ReturnType<typeof mockCtx>): number[][] {
  return (ctx.fillRect as unknown as { mock: { calls: number[][] } }).mock.calls;
}

describe("oddPixelWidth / barLeft", () => {
  it("gives odd whole-pixel widths of at least 1", () => {
    for (const w of [0.2, 1, 1.6, 2, 2.4, 3, 4.5, 6, 9.9]) {
      const p = oddPixelWidth(w);
      expect(p % 2).toBe(1);
      expect(p).toBeGreaterThanOrEqual(1);
    }
  });

  it("centres the bar on pixel column round(x)", () => {
    for (const x of [10, 10.2, 10.5, 10.8]) {
      for (const w of [1, 3, 5, 7]) {
        const left = barLeft(x, w);
        expect(Number.isInteger(left)).toBe(true);
        expect(left + (w - 1) / 2).toBe(Math.round(x));
      }
    }
  });
});

describe.each(SPACINGS)("at %s px per bar", (spacing) => {
  it("centres every candle body on the wick's pixel column", () => {
    const ts = scale(spacing);
    const candles = Array.from({ length: 400 }, (_, i) => ({
      ...makeCandle(i, 100 + (i % 7)),
      open: 100,
    }));
    const ctx = mockCtx();
    renderCandlesticks(ctx, candles, ts, makePriceScale(400, 90, 120), DARK_THEME);
    const bodies = fillRects(ctx);
    expect(bodies.length).toBeGreaterThan(0);
    let k = 0;
    for (let i = ts.startIndex; i < ts.endIndex; i++, k++) {
      const [left, , w] = bodies[k];
      expect(Number.isInteger(left)).toBe(true);
      expect(w % 2).toBe(1);
      expect(left + (w - 1) / 2).toBe(Math.round(ts.indexToX(i)));
    }
  });

  it("centres every volume bar on the crosshair's pixel column", () => {
    const ts = scale(spacing);
    const candles = Array.from({ length: 400 }, (_, i) => makeCandle(i, 100, 101, 99, 1000 + i));
    const ctx = mockCtx();
    renderVolume(ctx, candles, ts, makePriceScale(100, 0, 2000), DARK_THEME);
    for (const [left, , w] of fillRects(ctx)) {
      expect(Number.isInteger(left)).toBe(true);
      expect(Number.isInteger(w)).toBe(true);
    }
    // At this spacing each bar is its own rect: check the centres
    if (spacing >= 3) {
      const rects = fillRects(ctx).sort((a, b) => a[0] - b[0]);
      const centres = rects.map(([l, , w]) => l + (w - 1) / 2);
      const columns = [];
      for (let i = ts.startIndex; i < ts.endIndex; i++) columns.push(Math.round(ts.indexToX(i)));
      expect(centres).toEqual(columns);
    }
  });
});
