// @vitest-environment happy-dom
/**
 * `removeBacktest`, `removePatterns`, `removeScores`, `removeSignals` and
 * `removeTrades` clear what the matching add* call drew. Without them an
 * overlay could only be replaced, never taken off the chart.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BacktestResultData, ChartInstance } from "../core/types";
import { registerAll } from "../features";
import { createChart } from "../index";
import { makeCandle } from "./helpers/mock-ctx";

beforeAll(() => {
  const noop = () => {};
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return null;
        if (prop === "measureText") return () => ({ width: 0 }) as TextMetrics;
        return noop;
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  (HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext = () => ctx;
});

const T0 = Date.UTC(2024, 0, 1);
const DAY = 86_400_000;
const candles = Array.from({ length: 30 }, (_, i) => makeCandle(T0 + i * DAY, 100 + i));
const BACKTEST: BacktestResultData = {
  initialCapital: 1000,
  finalCapital: 1100,
  totalReturnPercent: 10,
  tradeCount: 1,
  winRate: 100,
  maxDrawdown: 0,
  sharpeRatio: 1,
  profitFactor: Number.POSITIVE_INFINITY,
  drawdownPeriods: [],
  trades: [
    {
      entryTime: T0 + 2 * DAY,
      entryPrice: 102,
      exitTime: T0 + 7 * DAY,
      exitPrice: 107,
      returnPercent: 10,
    },
  ],
};
const PATTERN = {
  time: T0 + 10 * DAY,
  type: "double_top",
  pattern: {
    startTime: T0 + 2 * DAY,
    endTime: T0 + 10 * DAY,
    keyPoints: [
      { time: T0 + 2 * DAY, index: 2, price: 103, label: "Peak 1" },
      { time: T0 + 6 * DAY, index: 6, price: 100, label: "Trough" },
      { time: T0 + 10 * DAY, index: 10, price: 103, label: "Peak 2" },
    ],
  },
  confidence: 80,
  confirmed: true,
};

type Internals = {
  _data: {
    backtestResult: unknown;
    patterns: readonly unknown[];
    scores: readonly unknown[];
    signals: readonly unknown[];
    trades: readonly unknown[];
  };
  _layout: { paneRects: readonly { id: string }[] };
};
const internals = (c: ChartInstance) => c as unknown as Internals;
const paneIds = (c: ChartInstance) => internals(c)._layout.paneRects.map((r) => r.id);

let warn: ReturnType<typeof vi.spyOn>;
let chart: ChartInstance;
let el: HTMLElement;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  el = document.createElement("div");
  document.body.appendChild(el);
  chart = createChart(el, { width: 800, height: 400 });
  chart.setCandles(candles);
});
afterEach(() => {
  chart.destroy();
  el.remove();
  warn.mockRestore();
});

describe("remove* overlay methods", () => {
  beforeEach(() => registerAll(chart));

  it("removeBacktest clears the result and drops the equity pane", () => {
    chart.addBacktest(BACKTEST);
    expect(paneIds(chart)).toContain("equity");
    chart.removeBacktest();
    expect(internals(chart)._data.backtestResult).toBeNull();
    expect(paneIds(chart)).not.toContain("equity");
  });

  it("removeBacktest keeps the equity pane when a series lives in it", () => {
    chart.addBacktest(BACKTEST);
    chart.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.close })),
      { pane: "equity", label: "Mine" },
    );
    chart.removeBacktest();
    expect(internals(chart)._data.backtestResult).toBeNull();
    expect(paneIds(chart)).toContain("equity");
  });

  it("removeBacktest leaves an equity pane the app's layout declared", () => {
    chart.setLayout({
      panes: [
        { id: "main", flex: 3 },
        { id: "equity", flex: 1 },
      ],
    });
    chart.addBacktest(BACKTEST);
    chart.removeBacktest();
    expect(paneIds(chart)).toContain("equity");
  });

  it("removeBacktest leaves an equity pane a later setLayout declared", () => {
    chart.addBacktest(BACKTEST);
    chart.setLayout({
      panes: [
        { id: "main", flex: 3 },
        { id: "equity", flex: 1 },
      ],
    });
    chart.removeBacktest();
    expect(paneIds(chart)).toContain("equity");
  });

  it("keeps the equity pane while a backtest is shown and its last series goes", () => {
    chart.addBacktest(BACKTEST);
    const handle = chart.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.close })),
      { pane: "equity", label: "Mine" },
    );
    handle.remove();
    expect(paneIds(chart)).toContain("equity");
    // The pane is the backtest's again, so removing the backtest drops it
    chart.removeBacktest();
    expect(paneIds(chart)).not.toContain("equity");
  });

  it("keeps an equity pane the app's series made once a backtest uses it", () => {
    const handle = chart.addIndicator(
      candles.map((c) => ({ time: c.time, value: c.close })),
      { pane: "equity", label: "Mine" },
    );
    chart.addBacktest(BACKTEST);
    handle.remove();
    expect(paneIds(chart)).toContain("equity");
    chart.removeBacktest();
    expect(paneIds(chart)).not.toContain("equity");
  });

  it("removePatterns, removeScores, removeSignals and removeTrades clear their data", () => {
    chart.addPatterns([PATTERN]);
    chart.addScores([{ time: T0, value: 50 }]);
    chart.addSignals([{ time: T0, type: "buy" }]);
    chart.addTrades([
      { entryTime: T0 + 2 * DAY, entryPrice: 102, exitTime: T0 + 7 * DAY, exitPrice: 107 },
    ]);
    chart.removePatterns();
    chart.removeScores();
    chart.removeSignals();
    chart.removeTrades();
    const d = internals(chart)._data;
    expect(d.patterns).toEqual([]);
    expect(d.scores).toEqual([]);
    expect(d.signals).toEqual([]);
    expect(d.trades).toEqual([]);
  });

  it("does nothing when nothing was added, or when called twice", () => {
    const panes = paneIds(chart);
    for (let i = 0; i < 2; i++) {
      chart.removeBacktest();
      chart.removePatterns();
      chart.removeScores();
      chart.removeSignals();
      chart.removeTrades();
    }
    expect(paneIds(chart)).toEqual(panes);
    expect(warn).not.toHaveBeenCalled();
  });

  it("draws again after a remove and a re-add", () => {
    chart.addBacktest(BACKTEST);
    chart.removeBacktest();
    chart.addBacktest(BACKTEST);
    expect(internals(chart)._data.backtestResult).toBe(BACKTEST);
    expect(paneIds(chart).filter((id) => id === "equity")).toEqual(["equity"]);
    chart.addSignals([{ time: T0, type: "buy" }]);
    chart.removeSignals();
    chart.addSignals([{ time: T0, type: "sell" }]);
    expect(internals(chart)._data.signals).toHaveLength(1);
  });
});

describe("remove* without the feature registered", () => {
  // Nothing can be drawn without the feature, so this checks only that the
  // calls stay silent: an app may clear unconditionally.
  it("does not warn", () => {
    chart.removeBacktest();
    chart.removePatterns();
    chart.removeScores();
    chart.removeSignals();
    chart.removeTrades();
    expect(warn).not.toHaveBeenCalled();
  });
});
