import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import type { Drawing, FibRetracementDrawing, HLineDrawing, TrendLineDrawing } from "../core/types";
import { renderDrawings } from "../renderer/drawing-renderer";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;

function setup() {
  const ctx = mockCtx();
  const dl = new DataLayer();
  const candles = [makeCandle(1000, 100), makeCandle(2000, 110), makeCandle(3000, 105)];
  dl.setCandles(candles);
  const ts = makeTimeScale(3, 800);
  const ps = makePriceScale(400, 80, 120);
  const paneRects = [makePane("main", 400)];
  const priceScales = new Map([["main", ps]]);
  return { ctx, dl, ts, ps, paneRects, priceScales };
}

describe("renderDrawings", () => {
  it("returns early for empty drawings", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    renderDrawings(ctx, [], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("returns early when main pane is missing", () => {
    const { ctx, ts, dl } = setup();
    const priceScales = new Map([["main", makePriceScale()]]);
    renderDrawings(
      ctx,
      [{ id: "1", type: "hline", price: 100 } as HLineDrawing],
      [makePane("rsi")],
      priceScales,
      ts,
      dl,
      theme,
      11,
    );
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("renders hline drawing", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const hline: HLineDrawing = { id: "1", type: "hline", price: 105 };
    renderDrawings(ctx, [hline], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled(); // price label
  });

  it("renders trendline drawing", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const trendline: TrendLineDrawing = {
      id: "2",
      type: "trendline",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 110,
    };
    renderDrawings(ctx, [trendline], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(2); // two endpoints
  });

  it("renders fibonacci retracement", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const fib: FibRetracementDrawing = {
      id: "3",
      type: "fibRetracement",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 120,
    };
    renderDrawings(ctx, [fib], paneRects, priceScales, ts, dl, theme, 11);
    // 7 default fib levels = 7 horizontal lines + labels
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
