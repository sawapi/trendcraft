import { describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { DataPoint } from "../core/types";
import { renderBoxes } from "../series/box";
import { makeCandle, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function withZone(
  time: number,
  type: "bullish" | "bearish",
  zone: { start: number; end: number; high: number; low: number },
): DataPoint<unknown> {
  return { time, value: { type, zone } };
}

describe("renderBoxes", () => {
  const dl = new DataLayer();
  dl.setCandles([0, 1, 2, 3, 4, 5].map((i) => makeCandle(i * 60_000, 100 + i)));

  it("skips points without object value", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(6, 600);
    const ps = makePriceScale(300, 90, 120);
    const data: DataPoint<unknown>[] = [
      { time: 0, value: null },
      { time: 60_000, value: 42 },
      { time: 120_000, value: undefined },
      { time: 180_000, value: "str" },
      { time: 240_000, value: {} }, // object but no zone
      { time: 300_000, value: { type: "bullish" } }, // no zone
    ];
    renderBoxes(ctx, data, ts, ps, dl);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.strokeRect).not.toHaveBeenCalled();
  });

  it("draws bullish rect with green tint", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(6, 600);
    const ps = makePriceScale(300, 90, 120);
    const fillStyles: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fillStyles.push(v);
      },
      get() {
        return "";
      },
    });
    const data = [withZone(0, "bullish", { start: 0, end: 180_000, high: 110, low: 105 })];
    // Pad to index 0 being inside visible range
    renderBoxes(ctx, [...data, { time: 60_000, value: null }], ts, ps, dl);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(fillStyles.some((c) => c.startsWith("rgba(38,166,154"))).toBe(true);
  });

  it("draws bearish rect with red tint", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(6, 600);
    const ps = makePriceScale(300, 90, 120);
    const strokeStyles: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokeStyles.push(v);
      },
      get() {
        return "";
      },
    });
    const data = [withZone(0, "bearish", { start: 0, end: 300_000, high: 115, low: 100 })];
    renderBoxes(ctx, data, ts, ps, dl);
    expect(strokeStyles.some((c) => c.startsWith("rgba(239,83,80"))).toBe(true);
  });

  it("respects custom borderWidth option", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(6, 600);
    const ps = makePriceScale(300, 90, 120);
    const widths: number[] = [];
    Object.defineProperty(ctx, "lineWidth", {
      set(v: number) {
        widths.push(v);
      },
      get() {
        return 1;
      },
    });
    const data = [withZone(0, "bullish", { start: 0, end: 120_000, high: 110, low: 105 })];
    renderBoxes(ctx, data, ts, ps, dl, { borderWidth: 3 });
    expect(widths).toContain(3);
  });
});
