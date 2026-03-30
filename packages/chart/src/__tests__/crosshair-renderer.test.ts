import { describe, expect, it } from "vitest";
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

  it("handles crosshairIndex out of candle range", () => {
    const ctx = mockCtx();
    const vs = makeViewportState({ crosshairIndex: 999, mouseY: 200 });
    renderCrosshair(ctx, vs, paneRects, priceScales, ts, 740, 400, theme, 11, candles);
    // Should still draw crosshair lines but skip time label
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
