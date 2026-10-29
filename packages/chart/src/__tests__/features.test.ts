// @vitest-environment happy-dom
/**
 * Optional features live in `@trendcraft/chart/features`. Without
 * registration the methods that need one warn once and do nothing; with it,
 * they work and the render pipeline draws them.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { type ChartFeatures, REGISTER_FEATURE } from "../core/features";
import { DEFAULT_FONT_FAMILY } from "../core/font";
import { DEFAULT_LOCALE } from "../core/i18n";
import { LayoutEngine } from "../core/layout";
import { RendererRegistry } from "../core/renderer-registry";
import { TimeScale } from "../core/scale";
import { type BacktestResultData, type ChartInstance, DARK_THEME } from "../core/types";
import {
  registerAll,
  registerBacktest,
  registerDrawingTools,
  registerMarkers,
  registerScores,
} from "../features";
import { createChart } from "../index";
import { renderFrame } from "../renderer/render-pipeline";
import { makeCandle, mockCtx } from "./helpers/mock-ctx";

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

const warnings = () => warn.mock.calls.map((c: unknown[]) => String(c[0]));

describe("without registration", () => {
  it.each([
    ["addSignals", "registerMarkers", () => chart.addSignals([{ time: T0, type: "buy" }])],
    ["addTrades", "registerMarkers", () => chart.addTrades([])],
    ["addBacktest", "registerBacktest", () => chart.addBacktest(BACKTEST)],
    ["addPatterns", "registerBacktest", () => chart.addPatterns([])],
    ["addScores", "registerScores", () => chart.addScores([{ time: T0, value: 50 }])],
    [
      "addDrawing",
      "registerDrawingTools",
      () => chart.addDrawing({ id: "h", type: "hline", price: 100 }),
    ],
    ["setDrawingTool", "registerDrawingTools", () => chart.setDrawingTool("hline")],
  ])("%s warns that %s is needed, and does nothing", (method, registrar, call) => {
    call();
    expect(warnings()).toHaveLength(1);
    expect(warnings()[0]).toContain(`${method}:`);
    expect(warnings()[0]).toContain(`${registrar}(chart)`);
  });

  it("warns once per feature, not once per call", () => {
    chart.addSignals([]);
    chart.addSignals([]);
    chart.addTrades([]);
    expect(warnings()).toHaveLength(1);
  });

  it("reports the FEATURE_NOT_REGISTERED code on the error event", () => {
    const codes: unknown[] = [];
    chart.on("error", (e) => codes.push((e as { code?: string }).code));
    chart.addScores([]);
    expect(codes).toEqual(["FEATURE_NOT_REGISTERED"]);
  });

  it("keeps a drawing out until the feature is registered", () => {
    chart.addDrawing({ id: "h", type: "hline", price: 100 });
    expect(chart.getDrawings()).toEqual([]);
    registerDrawingTools(chart);
    chart.addDrawing({ id: "h", type: "hline", price: 100 });
    expect(chart.getDrawings()).toHaveLength(1);
  });

  it("ignores a drawing hotkey silently and leaves the key to the page", () => {
    const canvas = el.querySelector("canvas") as HTMLCanvasElement;
    const key = new KeyboardEvent("keydown", {
      key: "t",
      code: "KeyT",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(key);
    // The keystroke is the end user's; it must not surface as an app error.
    expect(warnings()).toEqual([]);
    expect(key.defaultPrevented).toBe(false);

    registerDrawingTools(chart);
    const again = new KeyboardEvent("keydown", {
      key: "t",
      code: "KeyT",
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    canvas.dispatchEvent(again);
    expect(again.defaultPrevented).toBe(true);
  });

  it("allows clearing the drawing tool without the feature", () => {
    chart.setDrawingTool(null);
    expect(warnings()).toEqual([]);
  });
});

describe("with registration", () => {
  it("accepts every feature's data without warning", () => {
    registerAll(chart);
    chart.addSignals([{ time: T0, type: "buy" }]);
    chart.addTrades([]);
    chart.addBacktest(BACKTEST);
    chart.addPatterns([]);
    chart.addScores([{ time: T0, value: 50 }]);
    chart.addDrawing({ id: "h", type: "hline", price: 100 });
    chart.setDrawingTool("trendline");
    expect(warnings()).toEqual([]);
  });

  it.each([
    ["registerMarkers", registerMarkers],
    ["registerBacktest", registerBacktest],
    ["registerScores", registerScores],
    ["registerDrawingTools", registerDrawingTools],
  ])("%s can be called more than once", (_name, register) => {
    register(chart);
    expect(() => register(chart)).not.toThrow();
  });

  it("exposes registration through the global symbol only", () => {
    expect(typeof (chart as unknown as Record<symbol, unknown>)[REGISTER_FEATURE]).toBe("function");
  });
});

describe("render pipeline", () => {
  function render(features: ChartFeatures) {
    const data = new DataLayer();
    data.setCandles(candles);
    data.setSignals([{ time: T0 + DAY, type: "buy" }]);
    data.setTrades([]);
    data.setBacktestResult(BACKTEST);
    data.setPatterns([]);
    data.setScores([{ time: T0, value: 50 }]);
    data.addDrawing({ id: "h", type: "hline", price: 100 });
    const layout = new LayoutEngine();
    layout.setDimensions(800, 400, 60, 24);
    layout.addPane({ id: "equity", flex: 0.8 });
    const timeScale = new TimeScale();
    timeScale.setWidth(740);
    timeScale.setTotalCount(candles.length);
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
      emit: vi.fn(),
      locale: DEFAULT_LOCALE,
      features,
    });
  }

  it("draws nothing optional when no feature is registered", () => {
    expect(() => render({})).not.toThrow();
  });

  it("calls each registered feature's renderers", () => {
    const features = {
      markers: {
        checkSignals: vi.fn(),
        checkTrades: vi.fn(),
        renderSignals: vi.fn(),
        renderTrades: vi.fn(),
      },
      backtest: {
        check: vi.fn(),
        equityRange: vi.fn(() => [900, 1200] as [number, number]),
        equityView: vi.fn(() => ({ ok: true, points: [], reached: [] })),
        equityWarning: vi.fn(() => ""),
        isPartialRun: vi.fn(() => false),
        renderTrades: vi.fn(),
        renderEquityCurve: vi.fn(),
        renderSummary: vi.fn(),
        renderPatterns: vi.fn(),
      },
      scores: { renderHeatmap: vi.fn() },
      drawing: { render: vi.fn(), createTool: vi.fn() },
    };
    render(features as unknown as ChartFeatures);
    expect(features.markers.renderSignals).toHaveBeenCalledTimes(1);
    expect(features.markers.renderTrades).toHaveBeenCalledTimes(1);
    expect(features.backtest.equityRange).toHaveBeenCalled();
    expect(features.backtest.renderTrades).toHaveBeenCalledTimes(1);
    expect(features.backtest.renderEquityCurve).toHaveBeenCalledTimes(1);
    expect(features.backtest.renderSummary).toHaveBeenCalledTimes(1);
    expect(features.scores.renderHeatmap).toHaveBeenCalledTimes(1);
    expect(features.drawing.render).toHaveBeenCalledTimes(1);
  });
});
