import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import type {
  ArrowDrawing,
  ChannelDrawing,
  FibExtensionDrawing,
  FibRetracementDrawing,
  HLineDrawing,
  HRayDrawing,
  RayDrawing,
  RectangleDrawing,
  TextLabelDrawing,
  TrendLineDrawing,
  VLineDrawing,
} from "../core/types";
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

  it("renders ray drawing (extends to pane edge, start dot only)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const ray: RayDrawing = {
      id: "4",
      type: "ray",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 110,
    };
    renderDrawings(ctx, [ray], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(1); // start point only
  });

  it("renders hray drawing (dashed line from anchor)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const hray: HRayDrawing = { id: "5", type: "hray", time: 1000, price: 105 };
    renderDrawings(ctx, [hray], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalledTimes(1); // anchor dot
  });

  it("renders vline drawing (vertical dashed line)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const vline: VLineDrawing = { id: "6", type: "vline", time: 2000 };
    renderDrawings(ctx, [vline], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("renders rectangle drawing (fill + border)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const rect: RectangleDrawing = {
      id: "7",
      type: "rectangle",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 115,
    };
    renderDrawings(ctx, [rect], paneRects, priceScales, ts, dl, theme, 11);
    // fillRect for clipping bg + rectangle fill, strokeRect for border
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });

  it("renders channel drawing (fill + two lines)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const ch: ChannelDrawing = {
      id: "8",
      type: "channel",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 110,
      channelWidth: 5,
    };
    renderDrawings(ctx, [ch], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.fill).toHaveBeenCalled(); // channel fill
    // Two stroke calls for two parallel lines
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("renders fibExtension drawing (lines + labels)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const ext: FibExtensionDrawing = {
      id: "9",
      type: "fibExtension",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 120,
    };
    renderDrawings(ctx, [ext], paneRects, priceScales, ts, dl, theme, 11);
    // 11 default levels → labels + lines
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("renders textLabel drawing", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const label: TextLabelDrawing = {
      id: "10",
      type: "textLabel",
      time: 2000,
      price: 105,
      text: "Support",
      backgroundColor: "rgba(0,0,0,0.5)",
    };
    renderDrawings(ctx, [label], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled(); // background
  });

  it("renders arrow drawing (line + arrowhead)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();
    const arrow: ArrowDrawing = {
      id: "11",
      type: "arrow",
      startTime: 1000,
      startPrice: 100,
      endTime: 3000,
      endPrice: 110,
    };
    renderDrawings(ctx, [arrow], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.stroke).toHaveBeenCalled(); // line
    expect(ctx.fill).toHaveBeenCalled(); // arrowhead triangle
  });

  it("clamps textLabel fontSize to [8, 200] (no crash on extreme values)", () => {
    const { ctx, paneRects, priceScales, ts, dl } = setup();

    // Extremely large fontSize — should not crash
    const huge: TextLabelDrawing = {
      id: "12",
      type: "textLabel",
      time: 2000,
      price: 105,
      text: "Huge",
      fontSize: 999999,
    };
    renderDrawings(ctx, [huge], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.fillText).toHaveBeenCalled();

    // Negative fontSize — should not crash
    const tiny: TextLabelDrawing = {
      id: "13",
      type: "textLabel",
      time: 2000,
      price: 105,
      text: "Tiny",
      fontSize: -10,
    };
    renderDrawings(ctx, [tiny], paneRects, priceScales, ts, dl, theme, 11);
    expect(ctx.fillText).toHaveBeenCalled();
  });
});
