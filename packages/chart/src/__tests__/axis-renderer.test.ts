import { describe, expect, it } from "vitest";
import { DARK_THEME } from "../core/types";
import {
  renderGrid,
  renderPriceAxis,
  renderReferenceLines,
  renderTimeAxis,
} from "../renderer/axis-renderer";
import { makeCandle, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;

describe("renderPriceAxis", () => {
  it("draws background, border, and tick labels (right)", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11);

    expect(ctx.fillRect).toHaveBeenCalled(); // background
    expect(ctx.stroke).toHaveBeenCalled(); // border
    expect(ctx.fillText).toHaveBeenCalled(); // tick labels
  });

  it("positions labels on left when position='left'", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx, ps, 60, 0, 60, 400, theme, 11, undefined, "left");

    expect(ctx.textAlign).toBe("right");
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("honors maxTicks — fewer labels on a short pane", () => {
    const ctx1 = mockCtx();
    const ctx2 = mockCtx();
    const ps1 = makePriceScale(400, 100, 200);
    const ps2 = makePriceScale(400, 100, 200);
    renderPriceAxis(ctx1, ps1, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 6,
    });
    renderPriceAxis(ctx2, ps2, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 2,
    });
    const calls6 = (ctx1.fillText as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    const calls2 = (ctx2.fillText as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(calls2).toBeLessThanOrEqual(calls6);
  });

  it("skips tick labels inside excludeY ± excludeHalfHeight (current-price badge)", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    // Current price 150 maps to y = 200 on a 400px scale with range 100..200.
    const excludeY = ps.priceToY(150);
    renderPriceAxis(ctx, ps, 740, 0, 60, 400, theme, 11, undefined, {
      maxTicks: 6,
      excludeY,
      excludeHalfHeight: 8,
    });
    const calls = (ctx.fillText as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    for (const [, , yArg] of calls) {
      expect(Math.abs((yArg as number) - excludeY)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("renderTimeAxis", () => {
  it("draws background, border, and time labels", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(50, 800);
    const candles = Array.from({ length: 50 }, (_, i) =>
      makeCandle(1609459200000 + i * 86400000, 100 + i),
    );
    renderTimeAxis(ctx, candles, ts, 0, 400, 740, 24, theme, 11);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("uses custom time formatter when provided", () => {
    const ctx = mockCtx();
    const ts = makeTimeScale(5, 800);
    const candles = Array.from({ length: 5 }, (_, i) =>
      makeCandle(1609459200000 + i * 86400000, 100),
    );
    const formatter = (time: number) => `T${time}`;
    renderTimeAxis(ctx, candles, ts, 0, 400, 740, 24, theme, 11, formatter);

    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe("renderGrid", () => {
  it("draws horizontal grid lines", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    renderGrid(ctx, ps, 0, 0, 740, 400, theme);

    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws vertical grid lines when timeScale and candles are provided", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 100, 200);
    const ts = makeTimeScale(50, 800);
    const candles = Array.from({ length: 50 }, (_, i) => makeCandle(i, 100));
    renderGrid(ctx, ps, 0, 0, 740, 400, theme, ts, candles);

    // Should have drawn more lines than just horizontal
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe("renderReferenceLines", () => {
  it("draws dashed lines at specified values", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 0, 100);
    renderReferenceLines(ctx, [30, 70], ps, 0, 0, 740, "#787b86");

    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    // Resets dash at end
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]);
  });

  it("handles empty lines array", () => {
    const ctx = mockCtx();
    const ps = makePriceScale(400, 0, 100);
    renderReferenceLines(ctx, [], ps, 0, 0, 740, "#787b86");
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
