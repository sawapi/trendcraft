import { describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { TradeMarker } from "../core/types";
import { type BacktestResultData, renderBacktestTrades } from "../renderer/backtest-renderer";
import { renderTrades } from "../renderer/marker-renderer";
import { tradeSpan } from "../renderer/trade-span";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const MIN = 60_000;

/** 20 one-minute candles at t = 0 … 19 min, as in a replay stopped at bar 19 */
function dl(): DataLayer {
  const d = new DataLayer();
  d.setCandles(Array.from({ length: 20 }, (_, i) => makeCandle(i * MIN, 100 + i)));
  return d;
}

/** A trade both `addBacktest` and `addTrades` accept */
type Trade = BacktestResultData["trades"][number] & TradeMarker;
const trade = (entry: number, exit: number, returnPercent = 10): Trade => ({
  entryTime: entry * MIN,
  entryPrice: 105,
  exitTime: exit * MIN,
  exitPrice: 110,
  returnPercent,
});

function result(trades: Trade[]): BacktestResultData {
  return {
    initialCapital: 10_000,
    finalCapital: 11_000,
    totalReturnPercent: 10,
    tradeCount: trades.length,
    winRate: 100,
    maxDrawdown: 0,
    sharpeRatio: 1,
    profitFactor: 2,
    trades,
    drawdownPeriods: [],
  };
}

const ts = makeTimeScale(20, 800);
const ps = makePriceScale(300, 90, 130);
const lastX = ts.indexToX(19);

describe("tradeSpan", () => {
  it("places a trade inside the data on its bars", () => {
    expect(tradeSpan(dl(), 3 * MIN, 7 * MIN)).toEqual({
      entryIdx: 3,
      exitIdx: 7,
      entryInRange: true,
      exitInRange: true,
    });
  });

  it("returns null for a trade entirely after or before the data", () => {
    expect(tradeSpan(dl(), 25 * MIN, 30 * MIN)).toBeNull();
    expect(tradeSpan(dl(), -10 * MIN, -5 * MIN)).toBeNull();
  });

  it("clips a trade that crosses an edge to the first or last bar", () => {
    expect(tradeSpan(dl(), 17 * MIN, 25 * MIN)).toEqual({
      entryIdx: 17,
      exitIdx: 19,
      entryInRange: true,
      exitInRange: false,
    });
    expect(tradeSpan(dl(), -5 * MIN, 2 * MIN)).toEqual({
      entryIdx: 0,
      exitIdx: 2,
      entryInRange: false,
      exitInRange: true,
    });
  });
});

describe.each([
  [
    "addBacktest trades",
    (ctx: CanvasRenderingContext2D, trades: Trade[]) =>
      renderBacktestTrades(
        ctx,
        result(trades),
        [makePane("main", 300)],
        new Map([["main", ps]]),
        ts,
        dl(),
      ),
  ],
  [
    "addTrades",
    (ctx: CanvasRenderingContext2D, trades: Trade[]) =>
      renderTrades(ctx, trades, dl(), [makePane("main", 300)], new Map([["main", ps]]), ts),
  ],
])("%s beyond the loaded candles", (_name, render) => {
  it("draws nothing for a trade after the last candle", () => {
    const ctx = mockCtx();
    render(ctx, [trade(25, 30), trade(-10, -5)]);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("clips an open trade at the last bar and hides its future exit", () => {
    const ctx = mockCtx();
    render(ctx, [trade(17, 25)]);
    expect(ctx.arc).toHaveBeenCalledTimes(1); // the entry only
    expect(vi.mocked(ctx.arc).mock.calls[0][0]).toBe(ts.indexToX(17));
    const [x, , w] = vi.mocked(ctx.fillRect).mock.calls[0];
    expect(x + w).toBe(lastX);
    expect(ctx.lineTo).not.toHaveBeenCalled(); // no line to the future exit
  });

  it("still draws a trade inside the data in full", () => {
    const ctx = mockCtx();
    render(ctx, [trade(3, 7)]);
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.lineTo).toHaveBeenCalledWith(ts.indexToX(7), expect.any(Number));
  });
});
