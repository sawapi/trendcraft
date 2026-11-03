// @vitest-environment happy-dom
/**
 * A series colour reaches the lines it is drawn with. Bands read only their
 * channel colours, so every band was the same blue whatever colour it was
 * given; a preset's channel colours beat a colour the caller passed; and a
 * multi-channel series without channel colours drew its first line in the
 * fallback blue while its legend showed the preset colour (Adaptive RSI).
 */

import { indicatorPresets } from "trendcraft";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createChart } from "../index";
import { connectIndicators } from "../integration/connect-indicators";
import { registerTrendCraftPresets } from "../presets";

const used = new Set<string>();
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
        if (prop === "strokeStyle") return fill;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: (_t, prop, value) => {
        if ((prop === "fillStyle" || prop === "strokeStyle") && typeof value === "string") {
          fill = value.toLowerCase();
          used.add(fill);
        }
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

/** Presets drawn by their own renderer, in colours that carry a meaning. */
const OWN_COLOURS = new Set(["fractals", "fvg", "heikinAshi", "orderBlock"]);

function mount() {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const chart = createChart(el, { width: 800, height: 400 });
  registerTrendCraftPresets(chart);
  chart.setCandles(candles);
  const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
  const draw = () => {
    used.clear();
    (chart as unknown as { _render: () => void })._render();
    return new Set(used);
  };
  const done = () => {
    conn.disconnect();
    chart.destroy();
    el.remove();
  };
  return { chart, conn, draw, done };
}

describe("series colour reaches the drawing", () => {
  const ids = Object.keys(indicatorPresets).filter((id) => !OWN_COLOURS.has(id));

  it.each(ids)("%s draws with a colour passed to it", (id) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { conn, draw, done } = mount();
    conn.add(id, { series: { color: "#ff00ff" } } as never);
    expect(draw().has("#ff00ff"), id).toBe(true);
    done();
    vi.restoreAllMocks();
  });

  it("gives two bands different colours", () => {
    const { conn, draw, done } = mount();
    conn.add("bb");
    const first = draw();
    conn.add("keltner");
    const both = draw();
    const added = [...both].filter((c) => !first.has(c));
    expect(added.length).toBeGreaterThan(0);
    done();
  });

  it("draws Adaptive RSI's line in its legend colour", () => {
    const { conn, draw, done } = mount();
    conn.add("adaptiveRsi");
    expect(draw().has("#ff9800")).toBe(true);
    done();
  });

  it("recolours only the MACD line, keeping the signal's own colour", () => {
    const { conn, draw, done } = mount();
    conn.add("macd", { series: { color: "#ff00ff" } } as never);
    const colours = draw();
    expect(colours.has("#ff00ff")).toBe(true);
    expect(colours.has("#ff9800")).toBe(true); // signal
    done();
  });
});
