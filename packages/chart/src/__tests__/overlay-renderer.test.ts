import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import {
  renderPaneTitles,
  renderPriceLine,
  renderSignals,
  renderTrades,
} from "../renderer/overlay-renderer";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const theme = DARK_THEME;

describe("renderPriceLine", () => {
  const paneRects = [makePane("main", 400)];
  const ps = makePriceScale(400, 90, 120);
  const priceScales = new Map([["main", ps]]);

  it("draws dashed price line at last close", () => {
    const ctx = mockCtx();
    const candles = [makeCandle(1, 100), makeCandle(2, 110)];
    renderPriceLine(ctx, candles, paneRects, priceScales, theme, 11);
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled(); // price label
  });

  it("returns early for empty candles", () => {
    const ctx = mockCtx();
    renderPriceLine(ctx, [], paneRects, priceScales, theme, 11);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it("returns early when main pane not found", () => {
    const ctx = mockCtx();
    const candles = [makeCandle(1, 100)];
    renderPriceLine(ctx, candles, [makePane("rsi")], priceScales, theme, 11);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe("renderSignals", () => {
  it("returns early for empty signals", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const paneRects = [makePane("main")];
    const ps = makePriceScale(400, 90, 120);
    const ts = makeTimeScale(5);
    renderSignals(ctx, [], [], dl, paneRects, new Map([["main", ps]]), ts);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("draws buy/sell triangles for valid signals", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const candles = [makeCandle(1000, 100), makeCandle(2000, 105), makeCandle(3000, 98)];
    dl.setCandles(candles);
    const paneRects = [makePane("main")];
    const ps = makePriceScale(400, 80, 120);
    const ts = makeTimeScale(3, 800);

    const signals = [
      { time: 1000, type: "buy" as const },
      { time: 2000, type: "sell" as const },
    ];
    renderSignals(ctx, signals, candles, dl, paneRects, new Map([["main", ps]]), ts);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe("renderTrades", () => {
  it("returns early for empty trades", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const paneRects = [makePane("main")];
    const ps = makePriceScale(400, 90, 120);
    const ts = makeTimeScale(5);
    renderTrades(ctx, [], dl, paneRects, new Map([["main", ps]]), ts);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it("draws entry/exit markers for trades", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const candles = [makeCandle(1000, 100), makeCandle(2000, 105), makeCandle(3000, 110)];
    dl.setCandles(candles);
    const paneRects = [makePane("main")];
    const ps = makePriceScale(400, 80, 120);
    const ts = makeTimeScale(3, 800);

    const trades = [
      {
        entryTime: 1000,
        exitTime: 3000,
        entryPrice: 100,
        exitPrice: 110,
        returnPercent: 10,
      },
    ];
    renderTrades(ctx, trades, dl, paneRects, new Map([["main", ps]]), ts);
    expect(ctx.arc).toHaveBeenCalled(); // entry + exit dots
    expect(ctx.fillRect).toHaveBeenCalled(); // holding period shading
  });
});

describe("renderPaneTitles", () => {
  it("renders titles for non-main panes", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const paneRects = [makePane("main"), makePane("volume")];
    renderPaneTitles(ctx, paneRects, dl, theme, 11);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("skips main pane", () => {
    const ctx = mockCtx();
    const dl = new DataLayer();
    const paneRects = [makePane("main")];
    renderPaneTitles(ctx, paneRects, dl, theme, 11);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
