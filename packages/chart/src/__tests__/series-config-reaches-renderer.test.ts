/**
 * SeriesConfig options must survive the public config resolvers and reach
 * the renderer. `markers` was dropped by both resolvers' field whitelists,
 * and `lineWidth` / `channelColors` were ignored by the band, MACD and
 * Ichimoku branches of the dispatcher, so the options were silent no-ops.
 * These tests go through introspect() / buildSeriesConfig() and
 * dispatchSeries(), not the renderers directly.
 */

import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import type { DataPoint, SeriesConfig } from "../core/types";
import { buildSeriesConfig } from "../integration/helpers";
import { introspect } from "../integration/series-introspector";
import { dispatchSeries } from "../renderer/series-dispatcher";
import { makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

/** Record the stroke colour and width at every ctx.stroke(), plus arc calls. */
function recordingCtx() {
  const ctx = mockCtx();
  const strokes: Array<{ color: string; width: number }> = [];
  let strokeStyle = "";
  let lineWidth = 1;
  Object.defineProperty(ctx, "strokeStyle", {
    set: (v: string) => {
      strokeStyle = v;
    },
    get: () => strokeStyle,
  });
  Object.defineProperty(ctx, "lineWidth", {
    set: (v: number) => {
      lineWidth = v;
    },
    get: () => lineWidth,
  });
  (ctx as unknown as { stroke: () => void }).stroke = () =>
    strokes.push({ color: strokeStyle, width: lineWidth });
  let arcs = 0;
  (ctx as unknown as { arc: () => void }).arc = () => {
    arcs++;
  };
  return { ctx, strokes, arcs: () => arcs };
}

const N = 40;
const series = <T>(value: (i: number) => T): DataPoint<T>[] =>
  Array.from({ length: N }, (_, i) => ({ time: i * 60_000, value: value(i) }));

function draw(data: DataPoint<unknown>[], userConfig: SeriesConfig) {
  const { config } = introspect(data, userConfig);
  const s = { id: "s1", data, config, visible: true } as unknown as InternalSeries;
  const rec = recordingCtx();
  dispatchSeries(rec.ctx, s, makeTimeScale(N, 800), makePriceScale(400, 90, 130));
  return rec;
}

describe("SeriesConfig reaches the renderer", () => {
  it("markers survive introspect and draw a dot per bar (ops #19)", () => {
    const data = series((i) => 100 + i * 0.5);
    expect(introspect(data, { markers: true }).config.markers).toBe(true);
    expect(draw(data, { markers: true }).arcs()).toBeGreaterThan(0);
  });

  it("markers survive buildSeriesConfig (connectIndicators path) (ops #19)", () => {
    const config = buildSeriesConfig(
      { overlay: true, label: "SMA" } as never,
      "sma_20",
      {},
      { markers: { radius: 4 } },
      "sma",
    );
    expect(config.markers).toEqual({ radius: 4 });
  });

  it("band strokes use the configured lineWidth (ops #21)", () => {
    const rec = draw(
      series((i) => ({ upper: 120 + i * 0.1, middle: 110, lower: 100 - i * 0.1 })),
      { lineWidth: 4 },
    );
    expect(rec.strokes.length).toBeGreaterThanOrEqual(3);
    expect(rec.strokes.every((s) => s.width === 4)).toBe(true);
  });

  it("band keeps its own default width when lineWidth is unset", () => {
    const rec = draw(
      series(() => ({ upper: 120, middle: 110, lower: 100 })),
      {},
    );
    expect(rec.strokes.every((s) => s.width === 1)).toBe(true);
  });

  it("MACD lines use the configured lineWidth (ops #21)", () => {
    const rec = draw(
      series((i) => ({
        macd: Math.sin(i),
        signal: Math.cos(i),
        histogram: Math.sin(i) - Math.cos(i),
      })),
      { pane: "main", lineWidth: 4 },
    );
    expect(rec.strokes.filter((s) => s.width === 4).length).toBe(2);
  });

  it("Ichimoku lines use channelColors and lineWidth (ops #20)", () => {
    const channelColors = {
      tenkan: "#ff0000",
      kijun: "#00ff00",
      senkouA: "#0000ff",
      senkouB: "#ffff00",
      chikou: "#ff00ff",
    };
    const rec = draw(
      series((i) => ({
        tenkan: 110 + Math.sin(i),
        kijun: 110 + Math.cos(i),
        senkouA: 112,
        senkouB: 108,
        chikou: 111,
      })),
      { channelColors, lineWidth: 4 },
    );
    const colors = new Set(rec.strokes.map((s) => s.color));
    for (const c of Object.values(channelColors)) expect(colors.has(c)).toBe(true);
    expect(rec.strokes.every((s) => s.width === 4)).toBe(true);
  });

  it("a partial Ichimoku channelColors keeps the default for the other lines", () => {
    const rec = draw(
      series(() => ({ tenkan: 110, kijun: 111, senkouA: 112, senkouB: 108, chikou: 111 })),
      { channelColors: { tenkan: "#ff0000" } },
    );
    const colors = rec.strokes.map((s) => s.color);
    expect(colors).toContain("#ff0000");
    expect(colors.every((c) => typeof c === "string" && c.length > 0)).toBe(true);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});
