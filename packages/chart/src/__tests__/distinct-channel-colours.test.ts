// @vitest-environment happy-dom
/**
 * Two lines of one series never share a colour. A colour given to a series
 * recoloured its first line to a colour another line already had (Slow
 * Stochastics' orange is the preset %D colour), and the plain multi-line path
 * gave its second line the second spare colour even when that was the series'
 * own colour (ORB or VWAP added second, in the palette's orange). The series
 * badges of those lines take the colours the lines are drawn in.
 */

import { indicatorPresets } from "trendcraft";
import { beforeAll, describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { channelColorsWithOwnColor } from "../integration/series-introspector";
import { registerTrendCraftPresets } from "../presets";
import { computeSeriesBadges } from "../renderer/overlay-renderer";
import { plainChannelColors } from "../renderer/series-color";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

describe("channelColorsWithOwnColor", () => {
  it("gives a line whose preset colour the first line took the first line's old colour", () => {
    expect(channelColorsWithOwnColor(undefined, "#FF9800", { k: "#2196F3", d: "#FF9800" })).toEqual(
      { k: "#FF9800", d: "#2196F3" },
    );
  });

  it("compares colours without regard to case", () => {
    expect(channelColorsWithOwnColor(undefined, "#ff9800", { k: "#2196F3", d: "#FF9800" })).toEqual(
      { k: "#ff9800", d: "#2196F3" },
    );
  });

  it("leaves lines that do not clash alone", () => {
    expect(channelColorsWithOwnColor(undefined, "#ff00ff", { k: "#2196F3", d: "#FF9800" })).toEqual(
      { k: "#ff00ff", d: "#FF9800" },
    );
  });

  it("keeps the caller's own channel colours as given", () => {
    const own = { k: "#111111", d: "#111111" };
    expect(channelColorsWithOwnColor(own, "#FF9800", { k: "#2196F3", d: "#FF9800" })).toBe(own);
  });
});

describe("plainChannelColors", () => {
  it("skips the series colour for the other lines", () => {
    const colours = plainChannelColors(["high", "low"], { color: "#FF9800" });
    expect(colours).toEqual(["#FF9800", "#26a69a"]);
  });

  it("gives every line a different colour", () => {
    for (const color of ["#2196F3", "#FF9800", "#26a69a", "#ef5350", "#9c27b0"]) {
      const colours = plainChannelColors(["a", "b", "c", "d", "e"], { color });
      expect(new Set(colours.map((c) => c.toLowerCase())).size, color).toBe(5);
    }
  });

  it("keeps the colours of lines that never clashed", () => {
    expect(plainChannelColors(["a", "b", "c"], { color: "#e91e63" })).toEqual([
      "#e91e63",
      "#FF9800",
      "#26a69a",
    ]);
  });

  it("skips a colour another line was given", () => {
    const colours = plainChannelColors(["a", "b", "c"], {
      color: "#2196F3",
      channelColors: { c: "#FF9800" },
    });
    expect(colours).toEqual(["#2196F3", "#26a69a", "#FF9800"]);
  });
});

describe("multi-line series on a chart", () => {
  const strokes: string[] = [];
  beforeAll(() => {
    const noop = () => {};
    let stroke = "#000000";
    const ctx = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "canvas") return null;
          if (prop === "strokeStyle" || prop === "fillStyle") return stroke;
          if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
          if (prop === "stroke") return () => strokes.push(stroke);
          return noop;
        },
        set: (_t, prop, value) => {
          if (prop === "strokeStyle" && typeof value === "string") stroke = value.toLowerCase();
          return true;
        },
      },
    ) as unknown as CanvasRenderingContext2D;
    (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
      ctx;
  });

  it("draws %K and %D in different colours", () => {
    let close = 100;
    const candles = Array.from({ length: 200 }, (_, i) => {
      const open = close;
      close = open + Math.sin(i / 5) * 2;
      return {
        time: Date.UTC(2024, 0, 1) + i * 86_400_000,
        open,
        high: Math.max(open, close) + 1,
        low: Math.min(open, close) - 1,
        close,
        volume: 1000,
      };
    });
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 800, height: 400, volume: false });
    registerTrendCraftPresets(chart);
    chart.setCandles(candles);
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    const render = () => {
      strokes.length = 0;
      (chart as unknown as { _render: () => void })._render();
      return new Set(strokes);
    };
    const before = render();
    conn.add("slowStochastics");
    const added = [...render()].filter((c) => !before.has(c));
    expect(added).toContain("#ff9800");
    expect(added).toContain("#2196f3");
    conn.disconnect();
    chart.destroy();
    el.remove();
  });

  it("draws an orange ORB's two lines in different colours", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 800, height: 400, volume: false });
    registerTrendCraftPresets(chart);
    chart.setCandles(orbCandles);
    /** How many strokes each colour got in one frame. */
    const render = () => {
      strokes.length = 0;
      (chart as unknown as { _render: () => void })._render();
      const counts = new Map<string, number>();
      for (const c of strokes) counts.set(c, (counts.get(c) ?? 0) + 1);
      return counts;
    };
    const before = render();
    chart.addIndicator(orbData, { color: "#FF9800", label: "ORB" });
    const after = render();
    // Colours with more strokes than before: the ORB's lines.
    const added = [...after.keys()].filter((c) => (after.get(c) ?? 0) > (before.get(c) ?? 0));
    expect(added).toContain("#ff9800");
    expect(added.length).toBe(2);
    chart.destroy();
    el.remove();
  });
});

const orbCandles = Array.from({ length: 40 }, (_, i) => ({
  time: Date.UTC(2024, 0, 1) + i * 3_600_000,
  open: 100,
  high: 102,
  low: 98,
  close: 101,
  volume: 1000,
}));
/** Opening-range output: a high and a low level per bar. */
const orbData = orbCandles.map((c) => ({
  time: c.time,
  value: { high: 102, low: 98, breakout: null },
}));

describe("series badges of a plain multi-line series", () => {
  it("take the colours its lines were drawn in", () => {
    const s: InternalSeries = {
      id: "orb",
      paneId: "main",
      scaleId: "right",
      type: "line",
      config: { color: "#FF9800", label: "ORB" },
      data: orbData.slice(0, 2) as InternalSeries["data"],
      visible: true,
    };
    const priceScale = makePriceScale(400, 90, 110);
    dispatchSeries(mockCtx(), s, makeTimeScale(2, 200), priceScale, undefined, 200, DARK_THEME);
    const badges = computeSeriesBadges(
      mockCtx(),
      makePane("main", 400),
      priceScale,
      [s],
      DARK_THEME,
      11,
      (v) => v.toFixed(2),
    );
    expect(badges.map((b) => b.color).sort()).toEqual(
      plainChannelColors(["high", "low"], s.config).sort(),
    );
    expect(new Set(badges.map((b) => b.color)).size).toBe(2);
  });
});
