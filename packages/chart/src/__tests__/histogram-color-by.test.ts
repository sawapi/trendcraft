// @vitest-environment happy-dom
/**
 * `histogramColorBy` picks how a scalar histogram colours its bars: by the
 * candle's direction (the default, as before), by the value's sign, or by
 * its change from the previous bar. The Awesome Oscillator is read by that
 * change, so its preset draws it as bars coloured that way; it used to be
 * a single line. The bars stand on zero, so the range keeps zero in view.
 */

import { indicatorPresets } from "trendcraft";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DataLayer, InternalSeries } from "../core/data-layer";
import { DARK_THEME, type SeriesConfig } from "../core/types";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { registerTrendCraftPresets } from "../presets";
import { computeSeriesRange } from "../renderer/range-calculator";
import { seriesColor } from "../renderer/series-color";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    mockCtx();
});

const UP = DARK_THEME.upColor;
const DOWN = DARK_THEME.downColor;

function series(values: (number | null)[], config: SeriesConfig): InternalSeries {
  return {
    id: "s",
    paneId: "sub",
    scaleId: "right",
    type: "histogram",
    config: { type: "histogram", ...config },
    data: values.map((value, i) => ({ time: i + 1, value })) as InternalSeries["data"],
    visible: true,
  };
}

/** Candles alternating up and down, so the candle colouring is visible. */
function candles(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    time: i + 1,
    open: 10,
    close: i % 2 === 0 ? 11 : 9,
    high: 12,
    low: 8,
    volume: 1,
  }));
}

/** The colour of each bar, left to right. */
function barColors(s: InternalSeries, start = 0): string[] {
  const n = s.data.length;
  const ctx = mockCtx();
  let fill = "";
  const out: { x: number; color: string }[] = [];
  Object.defineProperty(ctx, "fillStyle", {
    set: (v: string) => {
      fill = v;
    },
    get: () => fill,
  });
  (ctx as unknown as { fillRect: (...a: number[]) => void }).fillRect = (x) =>
    out.push({ x, color: fill });
  const timeScale = makeTimeScale(n, 40 * n);
  if (start > 0) timeScale.setVisibleRange(start, n);
  const dataLayer = { candles: candles(n) } as unknown as DataLayer;
  dispatchSeries(ctx, s, timeScale, makePriceScale(400, -10, 10), dataLayer, 40 * n, DARK_THEME);
  return out.sort((a, b) => a.x - b.x).map((b) => b.color);
}

describe("histogramColorBy", () => {
  it("colours by the candle's direction by default, in the volume colours", () => {
    const s = series([1, 2, 3, 4], {});
    const v = [DARK_THEME.volumeUp, DARK_THEME.volumeDown];
    expect(barColors(s)).toEqual([v[0], v[1], v[0], v[1]]);
  });

  it('"sign" colours by the sign of the value', () => {
    const s = series([2, -1, 0, -3], { histogramColorBy: "sign" });
    expect(barColors(s)).toEqual([UP, DOWN, UP, DOWN]);
  });

  it('"change" colours by the change from the previous bar', () => {
    // Rising while negative is still up; falling while positive is down.
    const s = series([-3, -2, 1, 0.5, 2], { histogramColorBy: "change" });
    expect(barColors(s)).toEqual([UP, UP, UP, DOWN, UP]);
  });

  it('"change" keeps the previous colour when the value is equal', () => {
    const s = series([3, 2, 2, 2, 4, 4], { histogramColorBy: "change" });
    expect(barColors(s)).toEqual([UP, DOWN, DOWN, DOWN, UP, UP]);
  });

  it('"change" counts the first bar after a gap as rising', () => {
    const s = series([3, 2, null, 1, 0], { histogramColorBy: "change" });
    expect(barColors(s)).toEqual([UP, DOWN, UP, DOWN]);
  });

  it('"change" gets the first visible bar right when scrolled', () => {
    // The first bars are off screen. Bar 2 fell; the equal bars after it
    // keep its colour even when the bar that fell is not drawn.
    const s = series([3, 2, 2, 2, 2, 2, 5], { histogramColorBy: "change" });
    const all = [UP, DOWN, DOWN, DOWN, DOWN, DOWN, UP];
    const shown = barColors(s, 4);
    expect(shown.length).toBeLessThan(5);
    expect(shown).toEqual(all.slice(all.length - shown.length));
  });

  it("an explicit colour still fills every bar", () => {
    const s = series([1, -1], { histogramColorBy: "sign", color: "#123456" });
    expect(barColors(s)).toEqual(["#123456", "#123456"]);
  });

  it("gives the swatch the up colour the bars are drawn in", () => {
    const t = DARK_THEME;
    const swatch = (c: SeriesConfig) => seriesColor(c, t);
    expect(swatch({ type: "histogram" })).toBe(t.volumeUp);
    expect(swatch({ type: "histogram", histogramColorBy: "change" })).toBe(t.upColor);
  });
});

describe("the range of a scalar histogram", () => {
  it("keeps zero in view when every visible value is positive", () => {
    // Without zero, the axis starts near the smallest bar and the bars'
    // heights no longer compare.
    const s = series([4.65, 4.68, 5.77, 5.2], { histogramColorBy: "change" });
    expect(computeSeriesRange(s, 0, 4)).toEqual([0, 5.77]);
  });

  it("keeps zero in view when every visible value is negative", () => {
    const s = series([-3, -2, -4], {});
    expect(computeSeriesRange(s, 0, 3)).toEqual([-4, 0]);
  });

  it("leaves a scalar line's range alone", () => {
    const s = series([4.65, 5.77], {});
    s.config = { type: "line" };
    expect(computeSeriesRange(s, 0, 2)).toEqual([4.65, 5.77]);
  });
});

describe("the AO preset", () => {
  it("draws AO as bars coloured by change", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const bars = Array.from({ length: 120 }, (_, i) => {
      const close = 100 + Math.sin(i / 6) * 5;
      return {
        time: Date.UTC(2024, 0, 1) + i * 86_400_000,
        open: close - 0.5,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000,
      };
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 800, height: 400 });
    registerTrendCraftPresets(chart);
    chart.setCandles(bars);
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles: bars });
    conn.add("ao");
    const data = (chart as unknown as { _data: { getAllSeries(): InternalSeries[] } })._data;
    const ao = data.getAllSeries().find((s) => s.config.label?.startsWith("AO"));
    expect(ao?.config.type).toBe("histogram");
    expect(ao?.config.histogramColorBy).toBe("change");
    conn.disconnect();
    chart.destroy();
    el.remove();
    vi.restoreAllMocks();
  });
});
