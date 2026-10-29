// @vitest-environment happy-dom
/**
 * `addBacktest` draws the engine's `equityCurve` as it is, placed on the
 * loaded candles by `firstBarTime`. It never rebuilds a curve from trade
 * returns, which misstates sized and partly closed positions.
 */

import { describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { type BacktestFeature, REGISTER_FEATURE } from "../core/features";
import { DEFAULT_FONT_FAMILY } from "../core/font";
import { DEFAULT_LOCALE } from "../core/i18n";
import { LayoutEngine } from "../core/layout";
import { RendererRegistry } from "../core/renderer-registry";
import { TimeScale } from "../core/scale";
import { type BacktestResultData, type ChartInstance, DARK_THEME } from "../core/types";
import { registerBacktest } from "../features";
import { renderBacktestSummary, renderEquityCurve } from "../renderer/backtest-renderer";
import { equityView, isPartialRun, maxDrawdownPercent } from "../renderer/equity-view";
import { type RenderContext, renderFrame } from "../renderer/render-pipeline";
import { makeCandle, makePane, makePriceScale, makeTimeScale, mockCtx } from "./helpers/mock-ctx";

const MIN = 60_000;
const T0 = 1_000 * MIN;

/** Candles at T0 + i min for each i in `range` */
function dl(from: number, to: number): DataLayer {
  const d = new DataLayer();
  d.setCandles(Array.from({ length: to - from }, (_, i) => makeCandle(T0 + (from + i) * MIN, 100)));
  return d;
}

/** A run over bars 0…19 whose equity rises, dips at bar 8 and recovers at bar 12 */
const CURVE = [
  1000, 1010, 1020, 1030, 1040, 1050, 1060, 1070, 950, 960, 1000, 1060, 1080, 1090, 1100, 1110,
  1120, 1130, 1140, 1150,
];

function result(overrides: Partial<BacktestResultData> = {}): BacktestResultData {
  return {
    initialCapital: 1000,
    finalCapital: 1150,
    totalReturnPercent: 15,
    tradeCount: 2,
    winRate: 50,
    maxDrawdown: 11.2,
    sharpeRatio: 1.3,
    profitFactor: 2.5,
    trades: [
      {
        entryTime: T0 + 2 * MIN,
        entryPrice: 100,
        exitTime: T0 + 8 * MIN,
        exitPrice: 95,
        returnPercent: -5,
      },
      {
        entryTime: T0 + 9 * MIN,
        entryPrice: 95,
        exitTime: T0 + 15 * MIN,
        exitPrice: 110,
        returnPercent: 15,
      },
    ],
    equityCurve: CURVE,
    firstBarTime: T0,
    lastBarTime: T0 + 19 * MIN,
    ...overrides,
  };
}

describe("equityView", () => {
  it("places the curve on the candles of the run, value for value", () => {
    const view = equityView(result(), dl(0, 20));
    expect(view.ok && view.points).toEqual(CURVE.map((equity, idx) => ({ idx, equity })));
  });

  it("starts at the candle of firstBarTime when the chart has earlier candles", () => {
    const view = equityView(
      result({ equityCurve: CURVE.slice(5), firstBarTime: T0 + 5 * MIN }),
      dl(0, 20),
    );
    expect(view.ok && view.points[0]).toEqual({ idx: 5, equity: CURVE[5] });
    expect(view.ok && view.points.length).toBe(15);
  });

  it("allows candles after the run's last bar", () => {
    const view = equityView(result(), dl(0, 25));
    expect(view.ok && view.points.length).toBe(20);
  });

  it("draws only up to the last loaded candle in a replay", () => {
    const r = result();
    const d = dl(0, 10);
    const view = equityView(r, d);
    expect(view.ok && view.points.map((p) => p.idx)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(view.ok && view.reached).toEqual(CURVE.slice(0, 10));
    expect(isPartialRun(r, view, d)).toBe(true);
    expect(isPartialRun(r, equityView(r, dl(0, 20)), dl(0, 20))).toBe(false);
  });

  it("places the curve by lastBarTime when older candles were dropped", () => {
    const view = equityView(result(), dl(5, 20));
    expect(view.ok && view.points[0]).toEqual({ idx: 0, equity: CURVE[5] });
    expect(view.ok && view.points.length).toBe(15);
  });

  it("rejects a curve placed by lastBarTime that would start inside the data", () => {
    // firstBarTime is before the first loaded candle, so curve[0] must be too;
    // an 8-value curve ending at bar 10 would start at loaded bar 3
    const r = result({
      firstBarTime: T0 - 5 * MIN,
      lastBarTime: T0 + 10 * MIN,
      equityCurve: CURVE.slice(0, 8),
    });
    expect(equityView(r, dl(0, 20))).toEqual({ ok: false, reason: "misaligned" });
  });

  it("is a partial run when a trade exits after the data, even without a curve or lastBarTime", () => {
    const r = result({ equityCurve: undefined, lastBarTime: undefined });
    const d = dl(0, 10);
    expect(isPartialRun(r, equityView(r, d), d)).toBe(true);
  });

  it("recomputes when candles change between the same endpoints", () => {
    const r = result({ equityCurve: CURVE.slice(5), firstBarTime: T0 + 5 * MIN });
    const d = dl(0, 20);
    expect(equityView(r, d).ok).toBe(true);
    // Same count and endpoints, but bar 5 moved: firstBarTime is no longer a bar
    d.setCandles(
      Array.from({ length: 20 }, (_, i) => makeCandle(T0 + i * MIN + (i === 5 ? 1_000 : 0), 100)),
    );
    expect(equityView(r, d)).toEqual({ ok: false, reason: "misaligned" });
  });

  it("is empty when the run starts after the loaded candles", () => {
    const view = equityView(result({ firstBarTime: T0 + 30 * MIN }), dl(0, 20));
    expect(view).toEqual({ ok: true, points: [], reached: [] });
  });

  it.each([
    ["no equityCurve", { equityCurve: undefined }],
    ["an empty equityCurve", { equityCurve: [] }],
    ["no firstBarTime", { firstBarTime: undefined }],
    // The engine reports 0 when it had no span information
    ["firstBarTime 0", { firstBarTime: 0 }],
  ])("reports %s as missing", (_name, overrides) => {
    expect(equityView(result(overrides), dl(0, 20))).toEqual({ ok: false, reason: "missing" });
  });

  it.each([
    ["firstBarTime between candles", { firstBarTime: T0 + 30_000 }],
    ["lastBarTime not on the curve's last value", { lastBarTime: T0 + 18 * MIN }],
    [
      "more candles than values and no lastBarTime",
      { lastBarTime: undefined, equityCurve: CURVE.slice(0, 15) },
    ],
    ["older candles dropped and no lastBarTime", { lastBarTime: undefined }],
  ])("reports %s as misaligned", (name, overrides) => {
    const d = name.startsWith("older") ? dl(5, 20) : dl(0, 20);
    expect(equityView(result(overrides), d)).toEqual({ ok: false, reason: "misaligned" });
  });

  it("recomputes when the candles change", () => {
    const r = result();
    const d = dl(0, 10);
    expect(equityView(r, d).ok && (equityView(r, d) as { points: unknown[] }).points.length).toBe(
      10,
    );
    d.setCandles(Array.from({ length: 20 }, (_, i) => makeCandle(T0 + i * MIN, 100)));
    const view = equityView(r, d);
    expect(view.ok && view.points.length).toBe(20);
  });
});

describe("renderEquityCurve", () => {
  const ts = makeTimeScale(20, 800);
  const pane = makePane("equity", 100);
  const ps = makePriceScale(100, 900, 1200);

  it("draws the curve's values, not a curve rebuilt from trades", () => {
    const ctx = mockCtx();
    renderEquityCurve(ctx, equityView(result(), dl(0, 20)), pane, ps, ts, DARK_THEME);
    const drawn = [
      ...vi.mocked(ctx.moveTo).mock.calls,
      ...vi.mocked(ctx.lineTo).mock.calls.slice(0, 19),
    ];
    expect(drawn).toEqual(CURVE.map((v, i) => [ts.indexToX(i), pane.y + ps.priceToY(v)]));
  });

  it("shades a drawdown from the peak bar to the bar where the curve is back at it", () => {
    const ctx = mockCtx();
    renderEquityCurve(ctx, equityView(result(), dl(0, 20)), pane, ps, ts, DARK_THEME);
    // Peak 1070 at bar 7, back above it at bar 12 (1080)
    expect(vi.mocked(ctx.fillRect).mock.calls).toEqual([
      [ts.indexToX(7), pane.y, ts.indexToX(12) - ts.indexToX(7), pane.height],
    ]);
  });

  it("shades no drawdown a replay has not reached", () => {
    const ctx = mockCtx();
    renderEquityCurve(ctx, equityView(result(), dl(0, 8)), pane, ps, ts, DARK_THEME);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("draws nothing without a usable curve", () => {
    const ctx = mockCtx();
    renderEquityCurve(
      ctx,
      equityView(result({ equityCurve: undefined }), dl(0, 20)),
      pane,
      ps,
      ts,
      DARK_THEME,
    );
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });
});

describe("renderBacktestSummary", () => {
  function texts(r: BacktestResultData, d: DataLayer): string {
    const ctx = mockCtx();
    const view = equityView(r, d);
    const lastTime = d.timeAt(d.candleCount - 1) as number;
    const partial = isPartialRun(r, view, d) ? { view, lastTime } : undefined;
    renderBacktestSummary(ctx, r, 0, 0, DARK_THEME, 11, undefined, DEFAULT_FONT_FAMILY, partial);
    return vi
      .mocked(ctx.fillText)
      .mock.calls.map((c) => c[0])
      .join("");
  }

  it("shows the run's own figures when the run is loaded", () => {
    expect(texts(result(), dl(0, 20))).toBe(
      "Return: +15.0%Win: 50%Sharpe: 1.30MaxDD: 11.2%PF: 2.50Trades: 2",
    );
  });

  it("shows figures as of the last loaded candle in a replay, without Sharpe and PF", () => {
    // Bar 9: equity 960, max drawdown 1070 -> 950, one trade closed (a loss)
    expect(texts(result(), dl(0, 10))).toBe("Return: -4.0%Win: 0%MaxDD: 11.2%Trades: 1");
  });

  it("leaves out return and drawdown it cannot know in a replay without a curve", () => {
    expect(texts(result({ equityCurve: undefined }), dl(0, 10))).toBe("Win: 0%Trades: 1");
    // Also when lastBarTime is unknown: a trade exits after the data
    expect(texts(result({ equityCurve: undefined, lastBarTime: undefined }), dl(0, 10))).toBe(
      "Win: 0%Trades: 1",
    );
  });
});

describe("maxDrawdownPercent", () => {
  it("measures the deepest decline from a running peak", () => {
    expect(maxDrawdownPercent([100, 120, 90, 130])).toBeCloseTo(25);
    expect(maxDrawdownPercent([100, 110])).toBe(0);
  });
});

describe("warning", () => {
  function feature(): BacktestFeature {
    let captured: BacktestFeature | undefined;
    const host = {
      [REGISTER_FEATURE]: (_name: string, f: BacktestFeature) => {
        captured = f;
      },
    };
    registerBacktest(host as unknown as ChartInstance);
    return captured as BacktestFeature;
  }

  function frame(r: BacktestResultData, emit: ReturnType<typeof vi.fn>) {
    const data = dl(0, 20);
    data.setBacktestResult(r);
    const layout = new LayoutEngine();
    layout.setDimensions(800, 400, 60, 24);
    layout.addPane({ id: "equity", flex: 0.8 });
    const timeScale = new TimeScale();
    timeScale.setWidth(740);
    timeScale.setTotalCount(20);
    renderFrame({
      ctx: mockCtx(),
      pixelRatio: 1,
      canvasWidth: 800,
      canvasHeight: 400,
      theme: DARK_THEME,
      fontSize: 11,
      fontFamily: DEFAULT_FONT_FAMILY,
      chartType: "candlestick",
      watermark: undefined,
      priceFormatter: (p: number) => p.toFixed(2),
      timeFormatter: undefined,
      data,
      layout,
      timeScale,
      priceScales: new Map(),
      viewportState: {
        isDragging: false,
        mouseX: 0,
        mouseY: 0,
        activePaneId: null,
        crosshairIndex: null,
      },
      rendererRegistry: new RendererRegistry(),
      drawHelper: null,
      emit: emit as unknown as RenderContext["emit"],
      locale: DEFAULT_LOCALE,
      features: { backtest: feature() },
    });
  }

  it("warns once, with how to fix it, when the result has no curve", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const emit = vi.fn();
    const r = result({ equityCurve: undefined });
    frame(r, emit);
    frame(r, emit);
    const errors = emit.mock.calls.filter((c) => c[0] === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0][1].code).toBe("NO_EQUITY_CURVE");
    expect(errors[0][1].message).toContain("Pass the runBacktest result as it is");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("does not warn when the curve fits", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const emit = vi.fn();
    frame(result(), emit);
    expect(emit.mock.calls.filter((c) => c[0] === "error")).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
