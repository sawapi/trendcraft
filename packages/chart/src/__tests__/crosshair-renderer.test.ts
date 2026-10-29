import { describe, expect, it, vi } from "vitest";
import { DARK_THEME } from "../core/types";
import type { ViewportState } from "../core/viewport";
import { renderCrosshair } from "../renderer/crosshair-renderer";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;

function makeViewportState(overrides?: Partial<ViewportState>): ViewportState {
  return {
    crosshairIndex: null,
    mouseX: 0,
    mouseY: 0,
    activePaneId: "main",
    isDragging: false,
    ...overrides,
  } as ViewportState;
}

describe("renderCrosshair", () => {
  const ts = makeTimeScale(50, 800);
  const ps = makePriceScale(400, 100, 200);
  const paneRects = [makePane("main", 400)];
  const priceScales = new Map([["main", ps]]);
  const candles = Array.from({ length: 50 }, (_, i) =>
    makeCandle(1609459200000 + i * 86400000, 100 + i),
  );

  it("returns early when crosshairIndex is null", () => {
    const ctx = mockCtx();
    const vs = makeViewportState({ crosshairIndex: null });
    renderCrosshair(ctx, vs, paneRects, priceScales, ts, 740, 400, theme, 11, candles);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("draws vertical and horizontal lines when crosshair active", () => {
    const ctx = mockCtx();
    const vs = makeViewportState({ crosshairIndex: 5, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, ts, 740, 400, theme, 11, candles);
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws price and time labels", () => {
    const ctx = mockCtx();
    const vs = makeViewportState({ crosshairIndex: 5, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, ts, 740, 400, theme, 11, candles);
    // Price label + time label
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it.each([
    // Daily bars stamped at 00:00 UTC (2021-01-06 at index 5)
    ["Asia/Tokyo", "2021-01-06"],
    // West of UTC the date is the previous day, as on the time axis
    ["America/New_York", "2021-01-05"],
  ])("labels a daily bar in %s with its date only", (zone, label) => {
    const ctx = mockCtx();
    const zoned = Object.assign(makeTimeScale(50, 800), { timeZone: zone });
    const vs = makeViewportState({ crosshairIndex: 5, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, zoned, 740, 400, theme, 11, candles);
    const texts = vi.mocked(ctx.fillText).mock.calls.map((c) => c[0]);
    expect(texts).toContain(label);
  });

  it("keeps the time on intraday bars", () => {
    const ctx = mockCtx();
    const zoned = Object.assign(makeTimeScale(50, 800), { timeZone: "Asia/Tokyo" });
    const minutes = Array.from({ length: 50 }, (_, i) =>
      makeCandle(1609459200000 + i * 60_000, 100),
    );
    const vs = makeViewportState({ crosshairIndex: 5, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, zoned, 740, 400, theme, 11, minutes);
    const texts = vi.mocked(ctx.fillText).mock.calls.map((c) => c[0]);
    expect(texts).toContain("2021-01-01 09:05");
  });

  it("handles crosshairIndex out of candle range", () => {
    const ctx = mockCtx();
    const vs = makeViewportState({ crosshairIndex: 999, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, ts, 740, 400, theme, 11, candles);
    // Should still draw crosshair lines but skip time label
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
