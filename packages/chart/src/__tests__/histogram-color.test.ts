// @vitest-environment happy-dom
/**
 * A `type: "histogram"` series takes its `color` when one is given: every bar
 * in that colour, and the legend swatch with it. With no `color`, bars follow
 * the candle's direction in the theme's volume colours, and the swatch takes
 * the up colour, so bars and legend agree either way.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { DataLayer, InternalSeries } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import { createChart } from "../index";
import { seriesColor } from "../renderer/series-color";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makeCandle, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function histogram(color?: string): InternalSeries {
  return {
    id: "vol",
    paneId: "main",
    scaleId: "left",
    type: "histogram",
    config: { type: "histogram", ...(color ? { color } : {}) },
    data: [
      { time: 1, value: 5 },
      { time: 2, value: 7 },
    ] as InternalSeries["data"],
    visible: true,
  };
}

// One up candle, one down candle
const dataLayer = {
  candles: [
    { time: 1, open: 10, high: 12, low: 9, close: 11, volume: 5 },
    { time: 2, open: 11, high: 12, low: 9, close: 10, volume: 7 },
  ],
} as unknown as DataLayer;

function fills(s: InternalSeries): string[] {
  const ctx = mockCtx();
  const styles: string[] = [];
  Object.defineProperty(ctx, "fillStyle", {
    set: (v: string) => styles.push(v),
    get: () => "",
  });
  dispatchSeries(
    ctx,
    s,
    makeTimeScale(2, 200),
    makePriceScale(400, 0, 10),
    dataLayer,
    200,
    DARK_THEME,
  );
  return styles;
}

describe("histogram colour", () => {
  it("fills every bar with an explicit color", () => {
    expect(new Set(fills(histogram("#123456")))).toEqual(new Set(["#123456"]));
  });

  it("uses the theme's up / down volume colours without one", () => {
    expect(new Set(fills(histogram()))).toEqual(
      new Set([DARK_THEME.volumeUp, DARK_THEME.volumeDown]),
    );
  });

  it("keeps a multi-channel histogram's first channel colour for its swatch", () => {
    // MACD is typed "histogram" but carries channel colours; its swatch is the
    // MACD line's blue, not the volume colour.
    expect(
      seriesColor(
        { type: "histogram", channelColors: { macd: "#2196F3", signal: "#FF9800" } },
        DARK_THEME,
      ),
    ).toBe("#2196F3");
  });

  it("gives an uncoloured histogram the up-volume swatch", () => {
    expect(seriesColor({ type: "histogram" }, DARK_THEME)).toBe(DARK_THEME.volumeUp);
    expect(seriesColor({ type: "histogram", color: "#123456" }, DARK_THEME)).toBe("#123456");
  });
});

describe("histogram colour on a chart", () => {
  beforeAll(() => {
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "measureText" ? () => ({ width: 0 }) : prop === "canvas" ? null : () => {},
        set: () => true,
      },
    );
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
      ctx;
  });

  it("assigns no palette colour to a histogram added without one", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 400, height: 300 });
    const candles = [makeCandle(1, 10), makeCandle(2, 11)];
    chart.setCandles(candles);
    chart.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.volume })),
      { type: "histogram", label: "Vol" },
    );
    const s = (chart as unknown as { _data: DataLayer })._data.getAllSeries()[0];
    expect(s.config.color).toBeUndefined();
    chart.destroy();
    el.remove();
  });
});
