/**
 * A single non-finite value used to reach the auto-range through the range
 * reducers, stretch it to infinity and map every price on the pane to NaN.
 *
 * These tests are the only guard on the reducer fixes. The e2e spec
 * (price-scale.e2e.ts) passes even with them reverted, because
 * PriceScale.setDataRange keeps the previous range when a bound is
 * non-finite; the regression would then show as a scale that stops
 * following pans while the bad value is in view. Do not drop these as
 * "covered by e2e".
 */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { reduceRange } from "../core/value-range";
import { computePaneRange } from "../renderer/range-calculator";
import { candlePriceRange } from "../series/candlestick";
import { volumeRange } from "../series/histogram";
import { linePriceRange } from "../series/line";
import { drawMiniCandles } from "../sparkline/draw-candle";
import { drawMiniLine } from "../sparkline/draw-line";

describe("range reducers skip non-finite values", () => {
  const candle = (low: number, high: number) => ({
    time: 0,
    open: (low + high) / 2,
    high,
    low,
    close: (low + high) / 2,
    volume: 1,
  });

  it("candlePriceRange ignores a bar with a non-finite high or low", () => {
    const candles = [candle(99, 101), candle(100, Number.POSITIVE_INFINITY), candle(98, 102)];
    expect(candlePriceRange(candles, 0, 3)).toEqual([98, 102]);
  });

  it("reduceRange treats non-finite values as gaps", () => {
    expect(reduceRange([1, Number.POSITIVE_INFINITY, Number.NaN, 3], 0, 4)).toEqual([1, 3]);
  });

  it("volumeRange ignores a non-finite volume", () => {
    const candles = [
      { ...candle(1, 2), volume: 10 },
      { ...candle(1, 2), volume: Number.POSITIVE_INFINITY },
    ];
    expect(volumeRange(candles, 0, 2)).toEqual([0, 10]);
  });

  it("linePriceRange treats non-finite values as gaps", () => {
    const data = [100, Number.POSITIVE_INFINITY, 110].map((value, time) => ({ time, value }));
    expect(linePriceRange(data, 0, 3)).toEqual([100, 110]);
  });
});

describe("computePaneRange", () => {
  const candles = [98, 105, 112].map((close, i) => ({
    time: i,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1,
  }));
  const pane = { id: "main", x: 0, y: 0, width: 100, height: 100 } as never;

  it("keeps the candles' range when a line indicator holds an Infinity", () => {
    const line = {
      id: "s1",
      paneId: "main",
      type: "line",
      visible: true,
      config: {},
      data: [100, Number.POSITIVE_INFINITY, 110].map((value, time) => ({ time, value })),
    } as unknown as InternalSeries;
    expect(computePaneRange(pane, 0, 3, candles, [line])).toEqual([97, 113]);
  });

  it("ignores a non-finite bound from a custom renderer's priceRange", () => {
    const series = {
      id: "s2",
      paneId: "main",
      type: "custom-bad",
      visible: true,
      config: {},
      data: [{ time: 0, value: 1 }],
    } as unknown as InternalSeries;
    const registry = {
      getRenderer: (t: string) =>
        t === "custom-bad"
          ? { priceRange: () => [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY] }
          : undefined,
    } as never;
    expect(computePaneRange(pane, 0, 3, candles, [series], registry)).toEqual([97, 113]);
  });
});

describe("sparkline scale skips non-finite values", () => {
  function recordingCtx() {
    const ys: number[] = [];
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "lineTo" || prop === "moveTo"
            ? (_x: number, y: number) => ys.push(y)
            : prop === "fillRect"
              ? (_x: number, y: number) => ys.push(y)
              : () => {},
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;
    return { ctx, ys };
  }
  const colors = { stroke: "#000", fill: "#000" } as never;
  const themeColors = { up: "#0f0", down: "#f00", baseline: "#888" } as never;

  it("a line with one Infinity close still spans the sparkline height", () => {
    const { ctx, ys } = recordingCtx();
    drawMiniLine({
      ctx,
      width: 100,
      height: 30,
      data: [10, 12, Number.POSITIVE_INFINITY, 14, 11],
      colors,
      themeColors,
      fill: false,
      baselineValue: null,
      totalSlots: 5,
    });
    const finite = ys.filter(Number.isFinite);
    expect(finite.length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...finite) - Math.min(...finite)).toBeGreaterThan(20);
  });

  it("candles with one Infinity high still span the sparkline height", () => {
    const { ctx, ys } = recordingCtx();
    const bar = (o: number, h: number, l: number, c: number) => ({
      open: o,
      high: h,
      low: l,
      close: c,
    });
    drawMiniCandles({
      ctx,
      width: 100,
      height: 30,
      data: [
        bar(10, 11, 9, 10.5),
        bar(10.5, Number.POSITIVE_INFINITY, 10, 11),
        bar(11, 14, 10.8, 13),
      ] as never,
      colors,
      themeColors,
      baselineValue: null,
      totalSlots: 3,
    } as never);
    const finite = ys.filter(Number.isFinite);
    expect(finite.length).toBeGreaterThan(0);
    expect(Math.max(...finite) - Math.min(...finite)).toBeGreaterThan(10);
  });
});
