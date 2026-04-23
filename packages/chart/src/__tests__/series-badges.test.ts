import { describe, expect, it } from "vitest";
import type { InternalSeries } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import { computeSeriesBadges, drawSeriesBadges } from "../renderer/overlay-renderer";
import { makePane, makePriceScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;
const format = (v: number) => v.toFixed(2);

function makeNumberSeries(
  id: string,
  label: string,
  color: string,
  values: (number | null)[],
): InternalSeries {
  return {
    id,
    paneId: "main",
    scaleId: "right",
    type: "line",
    config: { label, color },
    data: values.map((v, i) => ({ time: i, value: v })),
    visible: true,
  };
}

function makeBandSeries(
  id: string,
  label: string,
  channelColors: Record<string, string>,
  last: { upper: number; middle: number; lower: number },
): InternalSeries {
  return {
    id,
    paneId: "main",
    scaleId: "right",
    type: "band",
    config: { label, channelColors },
    data: [{ time: 0, value: last }],
    visible: true,
  };
}

describe("computeSeriesBadges", () => {
  const pane = makePane("main", 400);
  const priceScale = makePriceScale(400, 0, 100); // 100 at y=0, 0 at y=400

  it("returns one badge per labeled number series", () => {
    const ctx = mockCtx();
    const a = makeNumberSeries("a", "SMA(5)", "#2196F3", [10, 20, 30]);
    const b = makeNumberSeries("b", "EMA(10)", "#FF9800", [70, 80, 90]);
    const result = computeSeriesBadges(ctx, pane, priceScale, [a, b], theme, 11, format);
    expect(result.length).toBe(2);
    expect(result.map((r) => r.color).sort()).toEqual(["#2196F3", "#FF9800"]);
    expect(result.map((r) => r.label).sort()).toEqual(["30.00", "90.00"]);
  });

  it("skips unlabeled series", () => {
    const ctx = mockCtx();
    const s = makeNumberSeries("a", "", "#2196F3", [10, 20]);
    s.config.label = undefined;
    const result = computeSeriesBadges(ctx, pane, priceScale, [s], theme, 11, format);
    expect(result.length).toBe(0);
  });

  it("skips series whose latest value is null", () => {
    const ctx = mockCtx();
    const s = makeNumberSeries("a", "SMA", "#2196F3", [10, 20, null, null]);
    const result = computeSeriesBadges(ctx, pane, priceScale, [s], theme, 11, format);
    // latestNumber falls back to last non-null → 20 — badge present
    expect(result.length).toBe(1);
    expect(result[0].label).toBe("20.00");
  });

  it("emits one badge per channel for multi-channel series", () => {
    const ctx = mockCtx();
    const bb = makeBandSeries(
      "bb",
      "BB(20,2)",
      { upper: "#26a69a", middle: "#ffffff", lower: "#ef5350" },
      { upper: 80, middle: 50, lower: 20 },
    );
    const result = computeSeriesBadges(ctx, pane, priceScale, [bb], theme, 11, format);
    expect(result.length).toBe(3);
    const colors = result.map((r) => r.color).sort();
    expect(colors).toEqual(["#26a69a", "#ef5350", "#ffffff"]);
  });

  it("shifts a badge upward to avoid a preoccupied range (current-price badge)", () => {
    const ctx = mockCtx();
    const s = makeNumberSeries("a", "SMA", "#2196F3", [50]); // y = 200 (center)
    const preoccupied = [{ y: 200, half: 8 }]; // exactly where SMA would land
    const result = computeSeriesBadges(ctx, pane, priceScale, [s], theme, 11, format, preoccupied);
    expect(result.length).toBe(1);
    // half = fontSize/2 + padY = 5.5 + 3 = 8.5, preoccupied half = 8
    // minDist = 16.5, new y should be 200 - 16.5 = 183.5
    expect(result[0].y).toBeLessThan(200);
    expect(Math.abs(200 - result[0].y)).toBeGreaterThanOrEqual(15);
  });

  it("skips a badge that cannot be shifted within the pane", () => {
    const ctx = mockCtx();
    // Value at top of pane, but preoccupied spans the whole pane → can't fit
    const s = makeNumberSeries("a", "SMA", "#2196F3", [100]); // y = 0 (top)
    const preoccupied = [{ y: 0, half: 200 }]; // huge range starting at pane top
    const result = computeSeriesBadges(ctx, pane, priceScale, [s], theme, 11, format, preoccupied);
    expect(result.length).toBe(0);
  });

  it("respects searchUpTo for visible-range mode", () => {
    const ctx = mockCtx();
    // values 10, 20, 30 — absolute latest is 30 (y=280), visible-up-to-1 is 20 (y=320)
    const s = makeNumberSeries("a", "SMA", "#2196F3", [10, 20, 30]);
    const absolute = computeSeriesBadges(ctx, pane, priceScale, [s], theme, 11, format);
    const visible = computeSeriesBadges(
      ctx,
      pane,
      priceScale,
      [s],
      theme,
      11,
      format,
      [],
      1, // visible end index = 2 → searchUpTo = 1
    );
    expect(absolute[0].label).toBe("30.00");
    expect(visible[0].label).toBe("20.00");
  });

  it("renders extras (e.g. volume) as badges at the provided value", () => {
    const ctx = mockCtx();
    const result = computeSeriesBadges(
      ctx,
      pane,
      priceScale,
      [],
      theme,
      11,
      format,
      [],
      undefined,
      [{ value: 42, color: "#9c27b0" }],
    );
    expect(result.length).toBe(1);
    expect(result[0].color).toBe("#9c27b0");
    expect(result[0].label).toBe("42.00");
  });

  it("two overlapping series badges — lower stays, upper shifts", () => {
    const ctx = mockCtx();
    // Both at value 50 → same y before collision resolution
    const a = makeNumberSeries("a", "A", "#2196F3", [50]);
    const b = makeNumberSeries("b", "B", "#FF9800", [50]);
    const result = computeSeriesBadges(ctx, pane, priceScale, [a, b], theme, 11, format);
    expect(result.length).toBe(2);
    // Sorted descending Y in return value; lower one unchanged, upper one shifted
    expect(result[0].y).toBeGreaterThan(result[1].y);
    expect(result[0].y).toBe(200);
    expect(result[1].y).toBeLessThan(200);
  });
});

describe("drawSeriesBadges", () => {
  it("draws one fillRect + one fillText per badge", () => {
    const ctx = mockCtx();
    const badges = [
      { y: 100, half: 8, x: 800, w: 50, color: "#2196F3", label: "10.00" },
      { y: 200, half: 8, x: 800, w: 50, color: "#FF9800", label: "20.00" },
    ];
    drawSeriesBadges(ctx, badges, 11);
    expect(ctx.fillRect).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });

  it("no-op for empty badge list", () => {
    const ctx = mockCtx();
    drawSeriesBadges(ctx, [], 11);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
