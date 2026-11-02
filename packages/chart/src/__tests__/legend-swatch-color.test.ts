// @vitest-environment happy-dom
/**
 * A legend swatch shows the colour the series is drawn in. Multi-line series
 * (bands, MACD, Ichimoku, DMI, …) carry `channelColors` and no `color`; their
 * swatch used to fall back to the theme text colour, a white or black dot that
 * matched none of their lines.
 */

import { indicatorPresets } from "trendcraft";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DARK_THEME, LIGHT_THEME } from "../core/types/theme";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { registerTrendCraftPresets } from "../presets";

beforeAll(() => {
  // happy-dom has no canvas. `fillStyle` keeps what it is given, so the
  // legend's colour sanitiser (a canvas round-trip) lets colours through
  // instead of blanking every swatch.
  const noop = () => {};
  let fill = "#000000";
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "fillStyle") return fill;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: (_t, prop, value) => {
        if (prop === "fillStyle" && typeof value === "string") fill = value.toLowerCase();
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

/** Deterministic daily candles with enough history for every preset */
const candles = (() => {
  let s = 7;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  let close = 100;
  return Array.from({ length: 400 }, (_, i) => {
    const open = close;
    close = Math.max(1, close + (rand() - 0.5) * 4);
    return {
      time: Date.UTC(2024, 0, 1) + i * 86_400_000,
      open,
      high: Math.max(open, close) + rand() * 2,
      low: Math.min(open, close) - rand() * 2,
      close,
      volume: 1000 + Math.round(rand() * 1000),
    };
  });
})();

let el: HTMLElement | undefined;
afterEach(() => el?.remove());

function swatches(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".tc-legend-dot")].map(
    (d) => d.getAttribute("style") ?? "",
  );
}

describe("legend swatch colour", () => {
  const ids = Object.keys(indicatorPresets);

  it.each(ids)("%s is not drawn in the theme text colour", (id) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 800, height: 400, legend: true });
    registerTrendCraftPresets(chart);
    chart.setCandles(candles);
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    conn.add(id);
    const styles = swatches(el);
    expect(styles.length, id).toBeGreaterThan(0);
    for (const style of styles) {
      expect(style, `${id}: ${style}`).toMatch(/background:\S/);
      expect(style, `${id}: ${style}`).not.toContain(`background:${DARK_THEME.text.toLowerCase()}`);
    }
    conn.disconnect();
    chart.destroy();
    vi.restoreAllMocks();
  });

  it("uses the first channel colour of a multi-line series, in either theme", () => {
    for (const theme of ["dark", "light"] as const) {
      el = document.createElement("div");
      document.body.appendChild(el);
      const chart = createChart(el, { width: 800, height: 400, legend: true, theme });
      chart.setCandles(candles);
      chart.addIndicator(
        candles.map((c) => ({
          time: c.time,
          value: { upper: c.high, middle: c.close, lower: c.low },
        })),
        { label: "Band", channelColors: { upper: "#123456", middle: "#abcdef", lower: "#123456" } },
      );
      const text = theme === "dark" ? DARK_THEME.text : LIGHT_THEME.text;
      const [style] = swatches(el);
      expect(style).toContain("background:#123456");
      expect(style).not.toContain(`background:${text.toLowerCase()}`);
      chart.destroy();
      el.remove();
    }
  });
});
