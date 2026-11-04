// @vitest-environment happy-dom
/**
 * Histogram series are drawn as bars. Only MACD's histogram was: PPO's and
 * Klinger's came out as a third line, and Weis Wave and Gap Analysis, typed
 * histogram, were drawn as lines. Weis Wave bars take the wave's direction,
 * gap-downs stand below zero, and a one-channel histogram keeps zero in its
 * range so the bars can be compared.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { DataLayer, InternalSeries } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import { createChart } from "../index";
import { registerTrendCraftPresets } from "../presets";
import { computeSeriesRange } from "../renderer/range-calculator";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

beforeAll(() => {
  // The TrendCraft rules (PPO, Klinger, Weis Wave, Gap Analysis) go into the
  // shared registry when a chart registers them.
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () =>
    mockCtx();
  const el = document.createElement("div");
  document.body.appendChild(el);
  const chart = createChart(el, { width: 200, height: 200 });
  registerTrendCraftPresets(chart);
  chart.destroy();
  el.remove();
});

function series(values: unknown[], channelColors?: Record<string, string>): InternalSeries {
  return {
    id: "s",
    paneId: "sub",
    scaleId: "right",
    type: "histogram",
    config: { type: "histogram", ...(channelColors ? { channelColors } : {}) },
    data: values.map((value, i) => ({ time: i + 1, value })) as InternalSeries["data"],
    visible: true,
  };
}

const dataLayer = { candles: [] } as unknown as DataLayer;
const priceScale = makePriceScale(400, -10, 10);
const zeroY = priceScale.priceToY(0);

/** Every filled rect, with the colour it was filled in. */
function bars(s: InternalSeries) {
  const ctx = mockCtx();
  let fill = "";
  const out: { color: string; y: number; h: number }[] = [];
  Object.defineProperty(ctx, "fillStyle", {
    set: (v: string) => {
      fill = v;
    },
    get: () => fill,
  });
  (ctx as unknown as { fillRect: (...a: number[]) => void }).fillRect = (_x, y, _w, h) =>
    out.push({ color: fill, y, h });
  dispatchSeries(ctx, s, makeTimeScale(2, 200), priceScale, dataLayer, 200, DARK_THEME);
  return out;
}

const HIST = { histogramUp: "#00ff00", histogramDown: "#ff0000" };

describe("histogram series are drawn as bars", () => {
  it("draws PPO's histogram as bars", () => {
    const s = series(
      [
        { ppo: 1, signal: 0.5, histogram: 0.5 },
        { ppo: 0.2, signal: 0.5, histogram: -0.3 },
      ],
      HIST,
    );
    expect(bars(s).map((b) => b.color)).toEqual(["#00ff00", "#ff0000"]);
  });

  it("draws Klinger's histogram as bars", () => {
    const s = series(
      [
        { kvo: 1, signal: 0.5, histogram: 0.5 },
        { kvo: 0.2, signal: 0.5, histogram: -0.3 },
      ],
      HIST,
    );
    expect(bars(s).map((b) => b.color)).toEqual(["#00ff00", "#ff0000"]);
  });

  it("colours Weis Wave bars by the wave's direction, all above zero", () => {
    const s = series([
      { waveVolume: 5, direction: "up" },
      { waveVolume: 7, direction: "down" },
    ]);
    const drawn = bars(s);
    expect(drawn.map((b) => b.color)).toEqual([DARK_THEME.volumeUp, DARK_THEME.volumeDown]);
    for (const b of drawn) expect(b.y + b.h).toBeCloseTo(zeroY);
  });

  it("puts gap-downs below zero", () => {
    const s = series([
      { type: "up", gapPercent: 2, classification: "full", filled: false },
      { type: "down", gapPercent: 3, classification: "full", filled: false },
    ]);
    const [up, down] = bars(s);
    expect(up.y + up.h).toBeCloseTo(zeroY);
    expect(up.color).toBe(DARK_THEME.volumeUp);
    expect(down.y).toBeCloseTo(zeroY);
    expect(down.color).toBe(DARK_THEME.volumeDown);
  });

  it("keeps zero in a one-channel histogram's range", () => {
    const s = series([
      { waveVolume: 500, direction: "up" },
      { waveVolume: 700, direction: "down" },
    ]);
    expect(computeSeriesRange(s, 0, 2)).toEqual([0, 700]);
  });
});
