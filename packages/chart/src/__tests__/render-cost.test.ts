/**
 * Per-frame cost of zoomed-out series.
 *
 * Zoomed out to the 0.1px bar-spacing floor, a pane shows ten bars per pixel
 * column. Series the pipeline does not decimate drew every one of them — a
 * fillRect (and fillStyle switch) per volume or histogram bar, a fill per
 * marker dot — and the pane's price range re-decomposed multi-channel series
 * over their whole length on every frame, at any zoom.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { TimeScale } from "../core/scale";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, DataPoint } from "../core/types";
import { DARK_THEME } from "../core/types/theme";
import { computeSeriesRange } from "../renderer/range-calculator";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { renderHistogram, renderVolume } from "../series/histogram";
import { renderMarkers } from "../series/marker";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const BARS = 8000;
const WIDTH = 800; // 0.1px per bar: ten bars per pixel column

/** Canvas calls made by `draw`, with every fillStyle assigned. */
function record(draw: (ctx: CanvasRenderingContext2D) => void) {
  const ctx = mockCtx();
  const styles: string[] = [];
  const rects: { x: number; y: number; w: number; h: number; style: string }[] = [];
  let style = "";
  const traced = new Proxy(ctx, {
    get(target, prop) {
      if (prop === "fillRect") {
        return (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h, style });
      }
      return Reflect.get(target, prop);
    },
    set(target, prop, value) {
      if (prop === "fillStyle") {
        style = value;
        styles.push(value);
      }
      return Reflect.set(target, prop, value);
    },
  });
  draw(traced);
  return { ctx, styles, rects };
}

function candles(n: number): CandleData[] {
  return Array.from({ length: n }, (_, i) => {
    const close = 100 + Math.sin(i / 40) * 20;
    return {
      time: i,
      open: i % 3 === 0 ? close + 1 : close - 1,
      high: close + 2,
      low: close - 2,
      close,
      volume: 1000 + (i % 7) * 100,
    };
  });
}

/** fillStyle order for folded bars: each colour behind, then in front. */
function layered(up: string, down: string): string[] {
  return [up, down, up, down];
}

/** Tenth-pixel slots (by their centre) that any of the rects covers. */
function slots(rects: { x: number; w: number }[]): number[] {
  const covered = new Set<number>();
  for (const r of rects) {
    for (let s = Math.floor(r.x * 10) - 1; s <= Math.ceil((r.x + r.w) * 10); s++) {
      const centre = (s + 0.5) / 10;
      if (centre >= r.x && centre < r.x + r.w) covered.add(s);
    }
  }
  return [...covered].sort((a, b) => a - b);
}

/** Pixel rows each pixel column covers, from a list of rects. */
function coverage(rects: { x: number; y: number; w: number; h: number }[]) {
  const cols = new Map<number, [number, number]>();
  for (const r of rects) {
    const c = Math.floor(r.x);
    const [top, bottom] = cols.get(c) ?? [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    cols.set(c, [Math.min(top, r.y), Math.max(bottom, r.y + r.h)]);
  }
  return cols;
}

describe("zoomed-out bars", () => {
  it("draws volume as at most two rects per pixel column, with four fillStyles", () => {
    const data = candles(BARS);
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, 0, 2000);
    expect(ts.barSpacing).toBeCloseTo(0.1);

    const { styles, rects } = record((ctx) => renderVolume(ctx, data, ts, ps, DARK_THEME));
    // Previously one fillRect and one fillStyle per bar: 8000 each.
    expect(rects.length).toBeLessThanOrEqual(2 * WIDTH + 2);
    expect(styles).toEqual(layered(DARK_THEME.volumeUp, DARK_THEME.volumeDown));
  });

  it("folds volume bars into rects that cover the same pixels per column", () => {
    const data = candles(BARS);
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, 0, 2000);
    const halfBar = Math.max(1, ts.barSpacing * 0.6) / 2;
    const zeroY = ps.priceToY(0);
    // What each bar covered when drawn one by one.
    const perBar = data.map((c, i) => {
      const y = ps.priceToY(c.volume);
      return { x: ts.indexToX(i) - halfBar, y, w: 1, h: zeroY - y };
    });

    const { rects } = record((ctx) => renderVolume(ctx, data, ts, ps, DARK_THEME));
    expect(coverage(rects)).toEqual(coverage(perBar));
  });

  it.each([0.1, 0.3, 0.7, 0.9, 1, 1.3])(
    "covers the same tenth-pixel slots as per-bar drawing at %spx spacing",
    (spacing) => {
      // A fractional scroll offset so bars do not line up with pixel columns.
      const data = candles(BARS);
      const ts = new TimeScale();
      ts.setTotalCount(BARS);
      ts.setWidth(WIDTH);
      ts.setVisibleLogicalRange(100.37, 100.37 + WIDTH / spacing);
      const ps = makePriceScale(100, 0, 2000);
      const barWidth = Math.max(1, ts.barSpacing * 0.6);
      const zeroY = ps.priceToY(0);
      const perBar = [];
      for (let i = ts.startIndex; i < ts.endIndex; i++) {
        const y = ps.priceToY(data[i].volume);
        perBar.push({ x: ts.indexToX(i) - barWidth / 2, y, w: barWidth, h: zeroY - y });
      }

      const { rects } = record((ctx) => renderVolume(ctx, data, ts, ps, DARK_THEME));
      expect(slots(rects)).toEqual(slots(perBar));
    },
  );

  it("draws the taller colour of a column behind the shorter one", () => {
    // Two bars in one column: a short up bar, then a tall down bar.
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, 0, 2000);
    const data: CandleData[] = [
      { time: 0, open: 1, high: 2, low: 0, close: 2, volume: 500 },
      { time: 1, open: 2, high: 2, low: 0, close: 1, volume: 1500 },
    ];
    const { rects } = record((ctx) => renderVolume(ctx, data, ts, ps, DARK_THEME));
    expect(rects.map((r) => r.style)).toEqual([DARK_THEME.volumeDown, DARK_THEME.volumeUp]);
    expect(rects[0].y).toBeCloseTo(ps.priceToY(1500));
    expect(rects[1].y).toBeCloseTo(ps.priceToY(500));
  });

  it("draws a signed histogram as at most two rects per pixel column", () => {
    const values = Array.from({ length: BARS }, (_, i) => (i % 2 ? 1 : -1) * ((i % 9) + 1));
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, -10, 10);

    const { styles, rects } = record((ctx) =>
      renderHistogram(ctx, values, ts, ps, { upColor: "up", downColor: "down" }),
    );
    expect(rects.length).toBeLessThanOrEqual(2 * WIDTH + 2);
    expect(styles).toEqual(layered("up", "down"));
    // Both signs in a column: the up rect reaches above zero, the down one below.
    const zeroY = ps.priceToY(0);
    const col0 = rects.filter((r) => Math.floor(r.x) === Math.floor(rects[0].x));
    expect(col0.find((r) => r.style === "up")?.y).toBeLessThan(zeroY);
    const down = col0.find((r) => r.style === "down");
    expect(down && down.y + down.h).toBeGreaterThan(zeroY);
  });

  it("folds a number series drawn as a histogram the same way", () => {
    const data = candles(BARS);
    const s: InternalSeries = {
      id: "h",
      paneId: "main",
      scaleId: "right",
      type: "line",
      config: { type: "histogram" },
      data: data.map((c) => ({ time: c.time, value: c.volume })),
      visible: true,
    };
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, 0, 2000);
    const dataLayer = { candles: data } as unknown as Parameters<typeof dispatchSeries>[4];

    const { styles, rects } = record((ctx) =>
      dispatchSeries(ctx, s, ts, ps, dataLayer, WIDTH, DARK_THEME),
    );
    expect(rects.length).toBeLessThanOrEqual(2 * WIDTH + 2);
    expect(styles).toEqual(layered(DARK_THEME.volumeUp, DARK_THEME.volumeDown));
  });

  it("keeps one rect per bar when bars are wider apart than a pixel", () => {
    const data = candles(100);
    const ts = makeTimeScale(100, WIDTH); // 8px spacing
    const ps = makePriceScale(100, 0, 2000);
    const { rects } = record((ctx) => renderVolume(ctx, data, ts, ps, DARK_THEME));
    expect(rects).toHaveLength(100);
  });
});

describe("zoomed-out markers", () => {
  it("fills every dot in one path and skips dots on the same pixel", () => {
    const values = Array.from({ length: BARS }, () => 150);
    const ts = makeTimeScale(BARS, WIDTH);
    const ps = makePriceScale(100, 100, 200);
    const ctx = mockCtx();
    renderMarkers(ctx, values, ts, ps, { radius: 2 });
    // Previously a beginPath, arc and fill per dot: 8000 each.
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(WIDTH + 1);
  });

  it("still draws dots that are a pixel apart", () => {
    const values = Array.from({ length: 100 }, (_, i) => 100 + i);
    const ts = makeTimeScale(100, WIDTH);
    const ps = makePriceScale(100, 100, 200);
    const ctx = mockCtx();
    renderMarkers(ctx, values, ts, ps, { radius: 2 });
    expect(ctx.arc).toHaveBeenCalledTimes(100);
  });
});

describe("pane price range", () => {
  afterEach(() => vi.restoreAllMocks());

  it("decomposes a multi-channel series once, not on every frame", () => {
    const data: DataPoint<unknown>[] = Array.from({ length: BARS }, (_, i) => ({
      time: i,
      value: { upper: 110 + i, middle: 100 + i, lower: 90 + i },
    }));
    const s: InternalSeries = {
      id: "bb",
      paneId: "main",
      scaleId: "right",
      type: "band",
      config: {},
      data,
      visible: true,
      _rule: defaultRegistry.detect(data),
    };
    const decompose = vi.spyOn(defaultRegistry, "decomposeAll");

    let range: [number, number] = [0, 0];
    for (let frame = 0; frame < 5; frame++) range = computeSeriesRange(s, 7990, 8000);
    // Previously once per call: the whole 8000-bar series, five times.
    expect(decompose).toHaveBeenCalledTimes(1);
    expect(range).toEqual([90 + 7990, 110 + 7999]);

    // New data still re-decomposes (the data layer clears _channels).
    s._channels = undefined;
    computeSeriesRange(s, 7990, 8000);
    expect(decompose).toHaveBeenCalledTimes(2);
  });
});
