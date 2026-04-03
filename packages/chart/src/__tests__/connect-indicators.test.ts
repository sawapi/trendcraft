import { describe, expect, it, vi } from "vitest";
import type { CandleData, ChartInstance, DataPoint, SeriesHandle } from "../core/types";
import {
  type IndicatorPresetEntry,
  type LiveSource,
  connectIndicators,
} from "../integration/connect-indicators";

// ============================================
// Mock helpers
// ============================================

function createMockChart() {
  const handles: Array<{
    id: string;
    data: DataPoint[];
    updates: DataPoint[];
    removed: boolean;
    setDataCalls: DataPoint[][];
  }> = [];
  let handleCounter = 0;

  const chart = {
    setCandles: vi.fn(),
    updateCandle: vi.fn(),
    addIndicator: vi.fn((data: DataPoint[], _config?: unknown): SeriesHandle => {
      const id = `series-${handleCounter++}`;
      const record = {
        id,
        data: [...data],
        updates: [] as DataPoint[],
        removed: false,
        setDataCalls: [] as DataPoint[][],
      };
      handles.push(record);
      return {
        id,
        update: vi.fn((point: DataPoint) => {
          record.updates.push(point);
        }),
        setData: vi.fn(<T>(newData: DataPoint<T>[]) => {
          record.setDataCalls.push([...newData] as DataPoint[]);
        }),
        setVisible: vi.fn(),
        remove: vi.fn(() => {
          record.removed = true;
        }),
      };
    }),
    getAllSeries: vi.fn(() => []),
    getVisibleRange: vi.fn(() => null),
    addSignals: vi.fn(),
    addTrades: vi.fn(),
    addDrawing: vi.fn(),
    removeDrawing: vi.fn(),
    getDrawings: vi.fn(() => []),
    setDrawingTool: vi.fn(),
    addTimeframe: vi.fn(),
    removeTimeframe: vi.fn(),
    addBacktest: vi.fn(),
    addPatterns: vi.fn(),
    addScores: vi.fn(),
    setLayout: vi.fn(),
    setVisibleRange: vi.fn(),
    fitContent: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    setTheme: vi.fn(),
    setChartType: vi.fn(),
    setShowVolume: vi.fn(),
    registerRenderer: vi.fn(),
    registerPrimitive: vi.fn(),
    removePrimitive: vi.fn(),
    toImage: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  } as unknown as ChartInstance;

  return { chart, handles };
}

function createMockLiveSource(
  completedCandles: CandleData[] = [],
  currentCandle: CandleData | null = null,
) {
  const tickCallbacks: Array<
    (p: { candle: CandleData; snapshot: Record<string, unknown>; isNewCandle: boolean }) => void
  > = [];
  const completeCallbacks: Array<
    (p: { candle: CandleData; snapshot: Record<string, unknown> }) => void
  > = [];
  const registeredIndicators = new Map<string, unknown>();

  const onImpl = (event: string, cb: (...args: unknown[]) => void): (() => void) => {
    if (event === "tick") {
      tickCallbacks.push(cb as (typeof tickCallbacks)[0]);
      return () => {
        const i = tickCallbacks.indexOf(cb as (typeof tickCallbacks)[0]);
        if (i >= 0) tickCallbacks.splice(i, 1);
      };
    }
    completeCallbacks.push(cb as (typeof completeCallbacks)[0]);
    return () => {
      const i = completeCallbacks.indexOf(cb as (typeof completeCallbacks)[0]);
      if (i >= 0) completeCallbacks.splice(i, 1);
    };
  };

  const source: LiveSource = {
    completedCandles,
    candle: currentCandle,
    snapshot: {},
    on: onImpl as LiveSource["on"],
    addIndicator: vi.fn((name: string, factory: unknown) => {
      registeredIndicators.set(name, factory);
    }),
    removeIndicator: vi.fn((name: string) => {
      registeredIndicators.delete(name);
    }),
  };

  return {
    source,
    emitTick(candle: CandleData, snapshot: Record<string, unknown>, isNewCandle = false) {
      (source as { snapshot: Record<string, unknown> }).snapshot = snapshot;
      for (const cb of [...tickCallbacks]) {
        cb({ candle, snapshot, isNewCandle });
      }
    },
    emitComplete(candle: CandleData, snapshot: Record<string, unknown>) {
      (source as { snapshot: Record<string, unknown> }).snapshot = snapshot;
      for (const cb of [...completeCallbacks]) {
        cb({ candle, snapshot });
      }
    },
    registeredIndicators,
    tickCallbackCount: () => tickCallbacks.length,
  };
}

function candle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 100 };
}

// Mock presets
function makeComputePreset(name: string, overlay = false): IndicatorPresetEntry {
  return {
    meta: { overlay, label: name },
    defaultParams: { period: 14 },
    snapshotName: name,
    compute: vi.fn((candles, _params) =>
      candles.map((c: CandleData) => ({ time: c.time, value: c.close })),
    ),
  };
}

function makeFactoryPreset(name: string, overlay = false): IndicatorPresetEntry {
  return {
    meta: { overlay, label: name },
    defaultParams: { period: 14 },
    snapshotName: name,
    compute: vi.fn((candles, _params) =>
      candles.map((c: CandleData) => ({ time: c.time, value: c.close })),
    ),
    createFactory: vi.fn((_params) => (_state?: unknown) => {
      let count = 0;
      return {
        next(c: CandleData) {
          count++;
          return { value: c.close };
        },
        peek(c: CandleData) {
          return { value: c.close };
        },
        getState() {
          return { count };
        },
        get count() {
          return count;
        },
        get isWarmedUp() {
          return count > 0;
        },
      };
    }),
  };
}

// ============================================
// Tests
// ============================================

describe("connectIndicators", () => {
  describe("static mode", () => {
    it("should add indicator using compute", () => {
      const { chart, handles } = createMockChart();
      const candles = [candle(1, 100), candle(2, 101)];
      const presets = { rsi: makeComputePreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles });
      expect(conn.mode).toBe("static");

      conn.add("rsi");
      expect(handles).toHaveLength(1);
      expect(handles[0].data).toHaveLength(2);
      expect(presets.rsi.compute).toHaveBeenCalledOnce();
    });

    it("should add indicator using factory fallback when no compute", () => {
      const { chart, handles } = createMockChart();
      const candles = [candle(1, 100), candle(2, 101)];
      const preset: IndicatorPresetEntry = {
        meta: { overlay: false, label: "test" },
        defaultParams: {},
        snapshotName: "test",
        createFactory: (_params) => (_state?: unknown) => {
          let count = 0;
          return {
            next(c: CandleData) {
              count++;
              return { value: c.close * 2 };
            },
            peek(c: CandleData) {
              return { value: c.close * 2 };
            },
            getState() {
              return {};
            },
            get count() {
              return count;
            },
            get isWarmedUp() {
              return count > 0;
            },
          };
        },
      };

      const conn = connectIndicators(chart, { presets: { test: preset }, candles });
      conn.add("test");
      expect(handles).toHaveLength(1);
      expect(handles[0].data).toHaveLength(2);
      // Values should be close * 2 (from factory)
      expect(handles[0].data[0].value).toBe(200);
      expect(handles[0].data[1].value).toBe(202);
    });

    it("should remove indicator", () => {
      const { chart, handles } = createMockChart();
      const candles = [candle(1, 100)];
      const presets = { rsi: makeComputePreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles });
      conn.add("rsi");
      expect(handles[0].removed).toBe(false);

      conn.remove("rsi");
      expect(handles[0].removed).toBe(true);
    });

    it("should recompute with new candles", () => {
      const { chart, handles } = createMockChart();
      const candles = [candle(1, 100)];
      const presets = { rsi: makeComputePreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles });
      conn.add("rsi");

      const newCandles = [candle(1, 100), candle(2, 101), candle(3, 102)];
      conn.recompute(newCandles);
      expect(handles[0].setDataCalls).toHaveLength(1);
      expect(handles[0].setDataCalls[0]).toHaveLength(3);
    });

    it("should merge params with defaults", () => {
      const { chart } = createMockChart();
      const candles = [candle(1, 100)];
      const presets = { sma: makeComputePreset("sma") };

      const conn = connectIndicators(chart, { presets, candles });
      conn.add("sma", { period: 50 });

      expect(presets.sma.compute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ period: 50 }),
      );
    });
  });

  describe("live mode", () => {
    it("should subscribe to live events", () => {
      const { chart } = createMockChart();
      const { source, tickCallbackCount } = createMockLiveSource([candle(1, 100)]);
      const presets = { rsi: makeFactoryPreset("rsi") };

      connectIndicators(chart, { presets, candles: [], live: source });
      expect(tickCallbackCount()).toBe(1);
    });

    it("should register factory on source and update on tick", () => {
      const { chart, handles } = createMockChart();
      const { source, emitTick, registeredIndicators } = createMockLiveSource([candle(1, 100)]);
      const presets = { rsi: makeFactoryPreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles: [], live: source });
      conn.add("rsi");

      expect(registeredIndicators.has("rsi")).toBe(true);
      expect(handles).toHaveLength(1);

      // Emit tick with indicator value
      const c2 = candle(2, 105);
      emitTick(c2, { rsi: 65 });
      expect(handles[0].updates).toHaveLength(1);
      expect(handles[0].updates[0]).toEqual({ time: 2, value: 65 });
    });

    it("should handle compute-only preset in live mode (static fallback)", () => {
      const { chart, handles } = createMockChart();
      const { source, emitTick } = createMockLiveSource([candle(1, 100)]);
      const presets = { custom: makeComputePreset("custom") };

      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)], live: source });
      conn.add("custom");

      expect(handles).toHaveLength(1);

      // Tick should NOT update this indicator (staticOnly)
      emitTick(candle(2, 105), { custom: 50 });
      expect(handles[0].updates).toHaveLength(0);
    });

    it("should clean up on remove in live mode", () => {
      const { chart, handles } = createMockChart();
      const { source, registeredIndicators } = createMockLiveSource([candle(1, 100)]);
      const presets = { rsi: makeFactoryPreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles: [], live: source });
      conn.add("rsi");
      expect(registeredIndicators.has("rsi")).toBe(true);

      conn.remove("rsi");
      expect(handles[0].removed).toBe(true);
      expect(registeredIndicators.has("rsi")).toBe(false);
    });

    it("should initialize chart with live history", () => {
      const { chart } = createMockChart();
      const history = [candle(1, 100), candle(2, 101)];
      const { source } = createMockLiveSource(history, candle(3, 102));

      connectIndicators(chart, { presets: {}, live: source });
      expect(chart.setCandles).toHaveBeenCalledWith(history);
      expect(chart.updateCandle).toHaveBeenCalledWith(candle(3, 102));
    });
  });

  describe("lifecycle", () => {
    it("should disconnect and clean up everything", () => {
      const { chart, handles } = createMockChart();
      const { source, tickCallbackCount, registeredIndicators } = createMockLiveSource([
        candle(1, 100),
      ]);
      const presets = { rsi: makeFactoryPreset("rsi") };

      const conn = connectIndicators(chart, { presets, candles: [], live: source });
      conn.add("rsi");

      conn.disconnect();
      expect(conn.connected).toBe(false);
      expect(handles[0].removed).toBe(true);
      expect(registeredIndicators.has("rsi")).toBe(false);
      expect(tickCallbackCount()).toBe(0);
    });

    it("should throw on operations after disconnect", () => {
      const { chart } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [] });

      conn.disconnect();
      expect(() => conn.add("rsi")).toThrow("disconnected");
      expect(() => conn.remove("rsi")).toThrow("disconnected");
      expect(() => conn.recompute([])).toThrow("disconnected");
    });

    it("should throw on unknown preset", () => {
      const { chart } = createMockChart();
      const conn = connectIndicators(chart, { presets: {}, candles: [] });
      expect(() => conn.add("nonexistent")).toThrow("Unknown indicator preset");
    });

    it("should throw on duplicate add", () => {
      const { chart } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      conn.add("rsi");
      expect(() => conn.add("rsi")).toThrow("already added");
    });
  });
});
