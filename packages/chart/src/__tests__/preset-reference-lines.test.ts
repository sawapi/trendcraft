// @vitest-environment happy-dom
/**
 * A chart preset's reference lines reach the pane. `connectIndicators` read
 * them only from the indicator's own meta, so Roofing Filter's and Returns'
 * zero lines, declared in the preset, were never drawn.
 */

import { indicatorPresets } from "trendcraft";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { registerTrendCraftPresets } from "../presets";
import { mockCtx } from "./helpers/mock-ctx";

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    mockCtx();
});

const candles = Array.from({ length: 200 }, (_, i) => {
  const close = 100 + Math.sin(i / 7) * 5;
  return {
    time: Date.UTC(2024, 0, 1) + i * 86_400_000,
    open: close - 0.5,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  };
});

type Layout = { config: { panes: { id: string; referenceLines?: number[] }[] } };

function paneLines(id: string): number[] | undefined {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const el = document.createElement("div");
  document.body.appendChild(el);
  const chart = createChart(el, { width: 800, height: 400 });
  registerTrendCraftPresets(chart);
  chart.setCandles(candles);
  const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
  conn.add(id);
  // The one pane besides the price and volume panes is the indicator's.
  const layout = (chart as unknown as { _layout: Layout })._layout;
  const pane = layout.config.panes.find((p) => p.id !== "main" && p.id !== "volume");
  const lines = pane?.referenceLines;
  conn.disconnect();
  chart.destroy();
  el.remove();
  vi.restoreAllMocks();
  return lines;
}

describe("chart preset reference lines", () => {
  it.each(["roofingFilter", "returns"])("draws %s's zero line", (id) => {
    expect(paneLines(id)).toEqual([0]);
  });

  it("keeps VSA's average line", () => {
    // VSA's lines are ratios to their average, so 1 is the average. Its
    // preset shares the rule's name, so the line already reached the pane
    // through introspection; buildSeriesConfig now carries it too.
    expect(paneLines("vsa")).toEqual([1]);
  });

  it("keeps the indicator's own reference lines over the preset's", () => {
    // RSI's meta declares 30/70; its chart preset declares none.
    expect(paneLines("rsi")).toEqual([30, 70]);
  });
});
