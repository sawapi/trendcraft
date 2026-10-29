// @vitest-environment happy-dom
/**
 * Every built-in preset added through `connectIndicators` gets a name in the
 * legend and pane title: its own parametric label (e.g. "SMA(20)") when the
 * computed series carries one, else the preset's label — never the generic
 * "Indicator" or "Series".
 */

import { indicatorPresets } from "trendcraft";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { registerTrendCraftPresets } from "../presets";

beforeAll(() => {
  const noop = () => {};
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
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

const GENERIC = new Set(["Indicator", "Series", ""]);

let el: HTMLElement | undefined;
afterEach(() => el?.remove());

describe("preset labels", () => {
  const ids = Object.keys(indicatorPresets);

  it.each(ids)("%s is named in the legend", (id) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    el = document.createElement("div");
    document.body.appendChild(el);
    const chart = createChart(el, { width: 800, height: 400 });
    registerTrendCraftPresets(chart);
    chart.setCandles(candles);
    const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
    conn.add(id);
    const labels = chart.getAllSeries().map((s) => s.label);
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) expect(GENERIC.has(label), `${id}: "${label}"`).toBe(false);
    conn.disconnect();
    chart.destroy();
    vi.restoreAllMocks();
  });
});
