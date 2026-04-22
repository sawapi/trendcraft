import { describe, expect, it } from "vitest";
import { DARK_THEME } from "../core/types";
import type { ViewportState } from "../core/viewport";
import { renderCrosshair } from "../renderer/crosshair-renderer";
import { makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

// MagnetOHLC snap behavior. The snap target is derived from the price scale's
// priceToY/yToPrice mapping, so we assert by checking the y value passed to the
// horizontal line (via moveTo arguments) and the price label text.

function vs(overrides: Partial<ViewportState>): ViewportState {
  return {
    crosshairIndex: 5,
    mouseX: 0,
    mouseY: 0,
    activePaneId: "main",
    isDragging: false,
    ...overrides,
  } as ViewportState;
}

describe("renderCrosshair — MagnetOHLC", () => {
  const ts = makeTimeScale(50, 800);
  // Price range 100..200 mapped to height 400 → 1 price unit = 4 px, y=0 is top (price=200)
  const ps = makePriceScale(400, 100, 200);
  const paneRects = [makePane("main", 400)];
  const priceScales = new Map([["main", ps]]);
  // Carefully-constructed candle at index 5: open=150, high=180, low=120, close=160
  const candles = Array.from({ length: 50 }, (_, i) => {
    if (i === 5) {
      return {
        time: 1609459200000 + i * 86400000,
        open: 150,
        high: 180,
        low: 120,
        close: 160,
        volume: 1000,
      };
    }
    return {
      time: 1609459200000 + i * 86400000,
      open: 100 + i,
      high: 102 + i,
      low: 98 + i,
      close: 101 + i,
      volume: 1000,
    };
  });

  // The PriceScale pads the data range by 5%, so priceToY(160) is not the
  // naive (1 - (160-100)/100) * 400. Use the scale itself to compute expected y.
  const yClose = ps.priceToY(160); // close of index 5
  const yOpen = ps.priceToY(150);

  function horizontalLineY(ctx: CanvasRenderingContext2D): number | undefined {
    const calls = (ctx.moveTo as unknown as { mock: { calls: number[][] } }).mock.calls;
    const horiz = calls.find((c) => c[0] === 0);
    return horiz?.[1];
  }

  it("magnet mode snaps y to the close", () => {
    const ctx = mockCtx();
    renderCrosshair(
      ctx,
      vs({ mouseY: 200 }),
      paneRects,
      priceScales,
      ts,
      740,
      400,
      DARK_THEME,
      11,
      candles,
      undefined,
      { mode: "magnet" },
    );
    expect(horizontalLineY(ctx)).toBeCloseTo(Math.round(yClose) + 0.5, 0);
  });

  it("magnetOHLC snaps to nearest OHLC within threshold", () => {
    const ctx = mockCtx();
    // Mouse 3px below the open — within the default threshold of 12
    renderCrosshair(
      ctx,
      vs({ mouseY: yOpen + 3 }),
      paneRects,
      priceScales,
      ts,
      740,
      400,
      DARK_THEME,
      11,
      candles,
      undefined,
      { mode: "magnetOHLC" },
    );
    expect(horizontalLineY(ctx)).toBeCloseTo(Math.round(yOpen) + 0.5, 0);
  });

  it("magnetOHLC falls back to raw y past threshold", () => {
    const ctx = mockCtx();
    // Mouse at pane center, far from every OHLC anchor
    const rawY = 395;
    renderCrosshair(
      ctx,
      vs({ mouseY: rawY }),
      paneRects,
      priceScales,
      ts,
      740,
      400,
      DARK_THEME,
      11,
      candles,
      undefined,
      { mode: "magnetOHLC", snapThreshold: 5 },
    );
    expect(horizontalLineY(ctx)).toBeCloseTo(Math.round(rawY) + 0.5, 0);
  });

  it("normal mode (default) does not snap y", () => {
    const ctx = mockCtx();
    const rawY = 205;
    renderCrosshair(
      ctx,
      vs({ mouseY: rawY }),
      paneRects,
      priceScales,
      ts,
      740,
      400,
      DARK_THEME,
      11,
      candles,
    );
    expect(horizontalLineY(ctx)).toBeCloseTo(Math.round(rawY) + 0.5, 0);
  });
});
