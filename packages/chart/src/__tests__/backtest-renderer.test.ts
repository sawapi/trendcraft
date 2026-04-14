import { describe, expect, it, type vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { DARK_THEME } from "../core/types";
import {
  type BacktestResultData,
  renderBacktestSummary,
  renderBacktestTrades,
  renderEquityCurve,
} from "../renderer/backtest-renderer";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

function dl(): DataLayer {
  const d = new DataLayer();
  d.setCandles(Array.from({ length: 20 }, (_, i) => makeCandle(i * 60_000, 100 + i)));
  return d;
}

function baseResult(trades: BacktestResultData["trades"] = []): BacktestResultData {
  return {
    initialCapital: 10_000,
    finalCapital: 11_000,
    totalReturnPercent: 10,
    tradeCount: trades.length,
    winRate: 60,
    maxDrawdown: 5,
    sharpeRatio: 1.2,
    profitFactor: 1.8,
    trades,
    drawdownPeriods: [],
  };
}

describe("renderBacktestTrades", () => {
  const paneRects = [makePane("main", 300)];
  const ts = makeTimeScale(20, 800);
  const ps = makePriceScale(300, 90, 130);
  const priceScales = new Map([["main", ps]]);

  it("no-op when main pane missing", () => {
    const ctx = mockCtx();
    renderBacktestTrades(
      ctx,
      baseResult([
        { entryTime: 0, entryPrice: 100, exitTime: 60_000, exitPrice: 110, returnPercent: 10 },
      ]),
      [makePane("other", 300)],
      priceScales,
      ts,
      dl(),
    );
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("no-op when main price scale missing", () => {
    const ctx = mockCtx();
    renderBacktestTrades(
      ctx,
      baseResult([
        { entryTime: 0, entryPrice: 100, exitTime: 60_000, exitPrice: 110, returnPercent: 10 },
      ]),
      paneRects,
      new Map(),
      ts,
      dl(),
    );
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("renders winning trade with green shading", () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fills.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestTrades(
      ctx,
      baseResult([
        {
          entryTime: 0,
          entryPrice: 100,
          exitTime: 600_000,
          exitPrice: 110,
          returnPercent: 10,
          exitReason: "takeProfit",
        },
      ]),
      paneRects,
      priceScales,
      ts,
      dl(),
    );
    expect(fills.some((c) => c.startsWith("rgba(38,166,154"))).toBe(true);
    expect(ctx.arc).toHaveBeenCalledTimes(2); // entry + exit
  });

  it("renders losing trade with red shading", () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fills.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestTrades(
      ctx,
      baseResult([
        {
          entryTime: 0,
          entryPrice: 100,
          exitTime: 600_000,
          exitPrice: 95,
          returnPercent: -5,
          exitReason: "stopLoss",
        },
      ]),
      paneRects,
      priceScales,
      ts,
      dl(),
    );
    expect(fills.some((c) => c.startsWith("rgba(239,83,80"))).toBe(true);
  });

  it("falls back on unknown exitReason to default grey", () => {
    const ctx = mockCtx();
    const strokes: string[] = [];
    Object.defineProperty(ctx, "strokeStyle", {
      set(v: string) {
        strokes.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestTrades(
      ctx,
      baseResult([
        {
          entryTime: 0,
          entryPrice: 100,
          exitTime: 600_000,
          exitPrice: 110,
          returnPercent: 10,
          exitReason: "mysterious",
        },
      ]),
      paneRects,
      priceScales,
      ts,
      dl(),
    );
    expect(strokes.some((c) => c.startsWith("#787b86"))).toBe(true);
  });

  it("uses signal color when exitReason is undefined", () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fills.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestTrades(
      ctx,
      baseResult([
        { entryTime: 0, entryPrice: 100, exitTime: 600_000, exitPrice: 110, returnPercent: 10 },
      ]),
      paneRects,
      priceScales,
      ts,
      dl(),
    );
    // default 'signal' blue used for exit marker
    expect(fills).toContain("#2196F3");
  });
});

describe("renderEquityCurve", () => {
  const pane = makePane("equity", 200);
  const ts = makeTimeScale(20, 800);
  const ps = makePriceScale(200, 9000, 12000);

  it("handles empty trades (just flat line from start to end)", () => {
    const ctx = mockCtx();
    renderEquityCurve(ctx, baseResult(), pane, ps, ts, dl(), DARK_THEME);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("shades drawdown periods with red", () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fills.push(v);
      },
      get() {
        return "";
      },
    });
    const result: BacktestResultData = {
      ...baseResult(),
      drawdownPeriods: [
        {
          startTime: 0,
          troughTime: 120_000,
          recoveryTime: 300_000,
          maxDepthPercent: 5,
          peakEquity: 10000,
          troughEquity: 9500,
        },
      ],
    };
    renderEquityCurve(ctx, result, pane, ps, ts, dl(), DARK_THEME);
    expect(fills).toContain("rgba(239,83,80,0.15)");
  });

  it("extends drawdown to last candle if recoveryTime missing", () => {
    const ctx = mockCtx();
    const result: BacktestResultData = {
      ...baseResult(),
      drawdownPeriods: [
        {
          startTime: 0,
          troughTime: 120_000,
          maxDepthPercent: 5,
          peakEquity: 10000,
          troughEquity: 9500,
        },
      ],
    };
    expect(() => renderEquityCurve(ctx, result, pane, ps, ts, dl(), DARK_THEME)).not.toThrow();
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});

describe("renderBacktestSummary", () => {
  it("uses upColor for positive return, downColor for negative", () => {
    const ctx = mockCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set(v: string) {
        fills.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestSummary(ctx, baseResult(), 0, 0, DARK_THEME, 11);
    expect(fills).toContain(DARK_THEME.upColor);

    const ctx2 = mockCtx();
    const fills2: string[] = [];
    Object.defineProperty(ctx2, "fillStyle", {
      set(v: string) {
        fills2.push(v);
      },
      get() {
        return "";
      },
    });
    renderBacktestSummary(ctx2, { ...baseResult(), totalReturnPercent: -3 }, 0, 0, DARK_THEME, 11);
    expect(fills2).toContain(DARK_THEME.downColor);
  });

  it("uses locale labels when provided", () => {
    const ctx = mockCtx();
    const texts: string[] = [];
    (ctx.fillText as ReturnType<typeof vi.fn>).mockImplementation((t: string) => {
      texts.push(t);
    });
    renderBacktestSummary(ctx, baseResult(), 0, 0, DARK_THEME, 11, {
      return_: "R",
      win: "W",
      sharpe: "S",
      maxDD: "DD",
      pf: "PF",
      trades: "T",
    } as never);
    expect(texts.some((t) => t.startsWith("R:"))).toBe(true);
    expect(texts.some((t) => t.startsWith("W:"))).toBe(true);
  });
});
