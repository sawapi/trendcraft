// @vitest-environment happy-dom
/**
 * What a theme switch does to series colours. Series without a colour of
 * their own hold a `"@palette.N"` token and presets may use tokens such as
 * `"@loss"`; both are resolved against the current theme when the chart
 * draws, so `setTheme()` recolours the lines, the legend, the price-axis
 * badges and `IndicatorHandle.color`.
 */

import { indicatorPresets } from "trendcraft";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { DataLayer } from "../core/data-layer";
import { BUILTIN_PALETTES, BUILTIN_SEMANTIC } from "../core/theme-colors";
import { DARK_THEME, LIGHT_THEME, type ThemeColors } from "../core/types";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { computeSeriesBadges } from "../renderer/overlay-renderer";
import { makePane, makePriceScale, mockCtx } from "./helpers/mock-ctx";

const strokes: string[] = [];

beforeAll(() => {
  // happy-dom has no canvas. Record stroke colours, and let `fillStyle` keep
  // what it is given so the legend's colour sanitiser passes colours through.
  const noop = () => {};
  let stroke = "#000000";
  let fill = "#000000";
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "strokeStyle") return stroke;
        if (prop === "fillStyle") return fill;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        if (prop === "stroke") return () => strokes.push(stroke);
        return noop;
      },
      set: (_t, prop, value) => {
        if (prop === "strokeStyle" && typeof value === "string") stroke = value.toLowerCase();
        if (prop === "fillStyle" && typeof value === "string") fill = value.toLowerCase();
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

const candles = Array.from({ length: 120 }, (_, i) => {
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

const line = (offset: number) => candles.map((c) => ({ time: c.time, value: c.close + offset }));

let el: HTMLElement | undefined;
afterEach(() => {
  el?.remove();
  vi.restoreAllMocks();
});

function makeChart(theme: "dark" | "light" | ThemeColors = "dark") {
  el = document.createElement("div");
  document.body.appendChild(el);
  const chart = createChart(el, { width: 800, height: 400, volume: false, legend: true, theme });
  chart.setCandles(candles);
  return chart;
}

function swatches(): string[] {
  return [...(el?.querySelectorAll(".tc-legend-dot") ?? [])].map(
    (d) => d.getAttribute("style") ?? "",
  );
}

function render(chart: unknown): Set<string> {
  strokes.length = 0;
  (chart as { _render: () => void })._render();
  return new Set(strokes);
}

const lower = (c: string) => c.toLowerCase();

describe("auto colours", () => {
  it("hands out @palette.N tokens and reuses a freed slot", () => {
    const chart = makeChart();
    const a = chart.addIndicator(line(1), { pane: "main", label: "A" });
    const b = chart.addIndicator(line(2), { pane: "main", label: "B" });
    expect(a.config.color).toBe("@palette.0");
    expect(b.config.color).toBe("@palette.1");
    a.remove();
    const c = chart.addIndicator(line(3), { pane: "main", label: "C" });
    expect(c.config.color).toBe("@palette.0");
    chart.destroy();
  });

  it("redraws lines and legend swatches in the new theme's palette", () => {
    const chart = makeChart();
    chart.addIndicator(line(1), { pane: "main", label: "A" });
    expect(render(chart)).toContain(lower(BUILTIN_PALETTES.dark[0]));
    expect(swatches()[0]).toContain(`background:${lower(BUILTIN_PALETTES.dark[0])}`);

    chart.setTheme("light");
    const drawn = render(chart);
    expect(drawn).toContain(lower(BUILTIN_PALETTES.light[0]));
    expect(drawn).not.toContain(lower(BUILTIN_PALETTES.dark[0]));
    expect(swatches()[0]).toContain(`background:${lower(BUILTIN_PALETTES.light[0])}`);
    chart.destroy();
  });

  it("gives price-axis badges the colour of the current theme", () => {
    const chart = makeChart();
    chart.addIndicator(line(1), { pane: "main", label: "A" });
    const series = (chart as unknown as { _data: DataLayer })._data.getAllSeries();
    const badges = (theme: ThemeColors) =>
      computeSeriesBadges(
        mockCtx(),
        makePane("main"),
        makePriceScale(400, 90, 110),
        series,
        theme,
        11,
        (v) => v.toFixed(2),
      ).map((b) => b.color);
    expect(badges(DARK_THEME)).toEqual([BUILTIN_PALETTES.dark[0]]);
    expect(badges(LIGHT_THEME)).toEqual([BUILTIN_PALETTES.light[0]]);
    chart.destroy();
  });
});

describe("palette slots after a switch to a palette of another length", () => {
  const five = { ...DARK_THEME, palette: ["#a1bcff", "#cb8913", "#b073fd", "#9ee083", "#c77ea1"] };

  it("moves only the series that would share a colour", () => {
    const chart = makeChart();
    const s0 = chart.addIndicator(line(1), { pane: "main", label: "0" });
    const s1 = chart.addIndicator(line(2), { pane: "main", label: "1" });
    const s2 = chart.addIndicator(line(3), { pane: "main", label: "2" });
    // A re-added series keeps the slot it had (handle.colorSpec), here 7.
    const s7 = chart.addIndicator(line(4), { pane: "main", label: "7", color: "@palette.7" });
    chart.setTheme(five);
    expect([s0, s1, s2, s7].map((s) => s.config.color)).toEqual([
      "@palette.0",
      "@palette.1",
      "@palette.2",
      "@palette.3", // 7 % 5 = 2 is taken
    ]);
    chart.destroy();
  });

  it("gives a new series a colour no series has, after a switch to a shorter palette", () => {
    const chart = makeChart();
    const added = Array.from({ length: 8 }, (_, i) =>
      chart.addIndicator(line(i), { pane: "main", label: `L${i}` }),
    );
    for (const s of added.slice(2, 7)) s.remove(); // .0, .1 and .7 remain
    chart.setTheme(five);
    const a = chart.addIndicator(line(10), { pane: "main", label: "A" });
    const b = chart.addIndicator(line(11), { pane: "main", label: "B" });
    const at = (c: string | undefined) => Number(c?.split(".")[1]) % 5;
    const colours = [added[0], added[1], added[7], a, b].map((s) => at(s.config.color));
    expect(new Set(colours).size).toBe(5);
    chart.destroy();
  });

  it("leaves the slots alone on a switch to a palette of the same length", () => {
    const chart = makeChart();
    const a = chart.addIndicator(line(1), { pane: "main", label: "A", color: "@palette.0" });
    const b = chart.addIndicator(line(2), { pane: "main", label: "B", color: "@palette.0" });
    chart.setTheme("light");
    expect([a.config.color, b.config.color]).toEqual(["@palette.0", "@palette.0"]);
    chart.destroy();
  });

  it("does not clash after remove + re-add with colorSpec and a shorter palette", () => {
    const chart = makeChart();
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    const handles = [5, 10, 15, 20, 25, 30].map((period) =>
      conn.add("sma", { params: { period }, snapshotName: `sma${period}` }),
    );
    // Change the params of every one, re-adding with the colour it had.
    const readded = handles.map((h) => {
      const spec = h.colorSpec;
      h.remove();
      return conn.add("sma", {
        params: { period: (h.params.period as number) + 1 },
        snapshotName: h.snapshotName,
        series: { color: spec },
      });
    });
    // Slots 0, 2, 3, 4, 5 remain; with five colours, 5 lands on 0.
    readded[1].remove();
    chart.setTheme(five);
    const colours = readded.filter((h) => !h.removed).map((h) => h.color);
    expect(new Set(colours).size).toBe(5);
    conn.disconnect();
    chart.destroy();
  });
});

describe("IndicatorHandle colour", () => {
  it("color follows the theme and colorSpec keeps the token", () => {
    const chart = makeChart();
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    const h = conn.add("sma", { params: { period: 5 } });
    expect(h.colorSpec).toBe("@palette.0");
    expect(h.color).toBe(BUILTIN_PALETTES.dark[0]);
    chart.setTheme("light");
    expect(h.color).toBe(BUILTIN_PALETTES.light[0]);
    conn.disconnect();
    chart.destroy();
  });
});

describe("semantic colour tokens", () => {
  it("draw a series in the theme's semantic colour", () => {
    const chart = makeChart();
    chart.addIndicator(line(1), { pane: "main", label: "Stop", color: "@loss" });
    expect(render(chart)).toContain(lower(BUILTIN_SEMANTIC.dark.loss));
    chart.setTheme("light");
    expect(render(chart)).toContain(lower(BUILTIN_SEMANTIC.light.loss));
    chart.destroy();
  });
});

describe("a theme edited in place", () => {
  it("is read afresh when set again", () => {
    const theme: ThemeColors = { ...DARK_THEME, semantic: { loss: "#ff0000" } };
    const chart = makeChart(theme);
    chart.addIndicator(line(1), { pane: "main", label: "Stop", color: "@loss" });
    expect(render(chart)).toContain("#ff0000");
    theme.semantic = { loss: "#00ff00" };
    chart.setTheme(theme);
    expect(render(chart)).toContain("#00ff00");
    chart.destroy();
  });
});

describe("warnings", () => {
  it("warns about an unknown colour token", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const chart = makeChart();
    chart.addIndicator(line(1), { pane: "main", label: "A", color: "@nope" });
    expect(warn.mock.calls.some((c) => String(c[0]).includes('"@nope"'))).toBe(true);
    chart.destroy();
  });

  it("warns once about a background it cannot read", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const clear = { ...DARK_THEME, background: "transparent" };
    const chart = makeChart();
    chart.setTheme(clear);
    chart.setTheme(clear);
    const hits = warn.mock.calls.filter((c) => String(c[0]).includes("not an opaque colour"));
    expect(hits).toHaveLength(1);
    chart.setTheme({ ...clear, mode: "light" });
    expect(
      warn.mock.calls.filter((c) => String(c[0]).includes("not an opaque colour")),
    ).toHaveLength(1);
    chart.destroy();
  });
});
