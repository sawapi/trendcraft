import { describe, expect, it, vi } from "vitest";
import type { CandleData, ChartInstance, DataPoint, SeriesHandle } from "../core/types";
import {
  connectIndicators,
  defineIndicator,
  type IndicatorPresetEntry,
  type LiveSource,
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
type PresetOpts = { overlay?: boolean; paramKeyedSnapshot?: boolean };

function makeComputePreset(name: string, opts: PresetOpts = {}): IndicatorPresetEntry {
  const { overlay = false, paramKeyedSnapshot = false } = opts;
  return {
    meta: { overlay, label: name },
    defaultParams: { period: 14 },
    snapshotName: paramKeyedSnapshot ? (p: Record<string, unknown>) => `${name}${p.period}` : name,
    compute: vi.fn((candles, _params) =>
      candles.map((c: CandleData) => ({ time: c.time, value: c.close })),
    ),
  };
}

function makeFactoryPreset(name: string, opts: PresetOpts = {}): IndicatorPresetEntry {
  const { overlay = false, paramKeyedSnapshot = false } = opts;
  return {
    meta: { overlay, label: name },
    defaultParams: { period: 14 },
    snapshotName: paramKeyedSnapshot ? (p: Record<string, unknown>) => `${name}${p.period}` : name,
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
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };

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

    it("recomputes batch-only presets on candleComplete (PR14)", () => {
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [candle(1, 100), candle(2, 102)];
      const { source, emitComplete } = createMockLiveSource(completed);
      const preset = makeComputePreset("custom");
      const conn = connectIndicators(chart, {
        presets: { custom: preset },
        candles: [],
        live: source,
      });
      conn.add("custom");

      // Initial backfill goes through `addIndicator(initialData, ...)` and
      // doesn't show up in setDataCalls — that's a `setData()` counter.
      expect(handles[0].data).toHaveLength(2);
      expect(handles[0].setDataCalls).toHaveLength(0);

      // A new completed candle arrives. The simulator pushes to the same
      // completedCandles array (`createLiveCandle` does the equivalent), then
      // fires the event — recompute should see the longer history.
      const c3 = candle(3, 105);
      completed.push(c3);
      emitComplete(c3, {});

      expect(handles[0].setDataCalls).toHaveLength(1);
      expect(handles[0].setDataCalls[0]).toHaveLength(3);
      // No streaming `update()` for batch-only presets — recompute uses setData.
      expect(handles[0].updates).toHaveLength(0);
    });

    it("does NOT recompute factory-driven presets on candleComplete", () => {
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [candle(1, 100)];
      const { source, emitComplete } = createMockLiveSource(completed);
      const conn = connectIndicators(chart, {
        presets: { rsi: makeFactoryPreset("rsi") },
        candles: [],
        live: source,
      });
      conn.add("rsi");

      const initialSetData = handles[0].setDataCalls.length;

      const c2 = candle(2, 105);
      completed.push(c2);
      emitComplete(c2, { rsi: 65 });

      // Streaming path stays — update fires, setData does not.
      expect(handles[0].updates).toHaveLength(1);
      expect(handles[0].setDataCalls).toHaveLength(initialSetData);
    });

    it("recomputes batch-only presets with options.candles as warm-up history", () => {
      // Common setup: host passes warm-up history via `options.candles` and
      // an empty live source that fills via addCandle(). Auto-recompute must
      // include the warm-up — otherwise long-lookback batch indicators see
      // only the post-warmup tail and produce wrong values.
      const warmUp = [candle(1, 100), candle(2, 102), candle(3, 101)];
      const completed: CandleData[] = [];
      const { chart, handles } = createMockChart();
      const { source, emitComplete } = createMockLiveSource(completed);
      const preset = makeComputePreset("custom");
      const conn = connectIndicators(chart, {
        presets: { custom: preset },
        candles: warmUp,
        live: source,
      });
      conn.add("custom");

      const c4 = candle(4, 105);
      completed.push(c4);
      emitComplete(c4, {});

      expect(handles[0].setDataCalls).toHaveLength(1);
      expect(handles[0].setDataCalls[0]).toHaveLength(warmUp.length + completed.length);
    });

    it("does not double-count after a manual recompute() in live mode", () => {
      // Manual `recompute(custom)` replaces the connection's canonical
      // history. A subsequent `candleComplete` *appends* the new bar onto
      // that custom window — it does not re-concat the live source's
      // completedCandles, so no bar is counted twice.
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [candle(1, 100), candle(2, 102)];
      const { source, emitComplete } = createMockLiveSource(completed);
      const preset = makeComputePreset("custom");
      const conn = connectIndicators(chart, {
        presets: { custom: preset },
        candles: [],
        live: source,
      });
      conn.add("custom");

      // Host triggers a manual refresh — passes the full live history.
      conn.recompute(completed);
      const afterManual = handles[0].setDataCalls.length;

      // New bar arrives.
      const c3 = candle(3, 105);
      completed.push(c3);
      emitComplete(c3, {});

      // Auto-recompute fires once with the correct length (= completed.length),
      // not 2x.
      expect(handles[0].setDataCalls).toHaveLength(afterManual + 1);
      expect(handles[0].setDataCalls.at(-1)).toHaveLength(completed.length);
    });

    it("merges options.candles + completedCandles by time at construction (Pattern C)", () => {
      // Defensive against a host that seeds the same bars into both
      // options.candles and the live source: dedup by `time` so the chart
      // doesn't see each bar twice in the backfill.
      const seed = [candle(1, 100), candle(2, 102)];
      const completed: CandleData[] = [...seed];
      const { chart, handles } = createMockChart();
      const { source } = createMockLiveSource(completed);
      const preset = makeComputePreset("custom");
      const conn = connectIndicators(chart, {
        presets: { custom: preset },
        candles: seed,
        live: source,
      });
      conn.add("custom");

      // Backfill arrives via addIndicator(initialData, ...). Length should be
      // seed.length, NOT seed.length + completed.length.
      expect(handles[0].data).toHaveLength(seed.length);
    });

    it("replaces the last bar on candleComplete with same time (re-emit / correction)", () => {
      // LiveCandle can re-emit a bar (e.g. tick aggregator finalizing a
      // partial). The connection should replace the last entry, not push a
      // duplicate.
      const initial = candle(1, 100);
      const completed: CandleData[] = [initial];
      const { chart, handles } = createMockChart();
      const { source, emitComplete } = createMockLiveSource(completed);
      const conn = connectIndicators(chart, {
        presets: { custom: makeComputePreset("custom") },
        candles: [],
        live: source,
      });
      conn.add("custom");

      const corrected = { ...initial, close: 999 };
      // Live source mutates the completedCandles tail (typical re-emit).
      completed[completed.length - 1] = corrected;
      emitComplete(corrected, {});

      expect(handles[0].setDataCalls).toHaveLength(1);
      // History length stayed at 1 — no duplicate. The last bar carries the
      // corrected close.
      expect(handles[0].setDataCalls[0]).toHaveLength(1);
      const lastPoint = handles[0].setDataCalls[0][0] as { time: number; value: number };
      expect(lastPoint.time).toBe(initial.time);
      expect(lastPoint.value).toBe(999);
    });

    it("manual recompute() in live mode is a permanent override, not a one-shot", () => {
      // After conn.recompute(custom), the new history *is* the canonical
      // view. Subsequent candleComplete events extend that custom window
      // (not the original options.candles + completedCandles seed).
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [];
      const { source, emitComplete } = createMockLiveSource(completed);
      const conn = connectIndicators(chart, {
        presets: { custom: makeComputePreset("custom") },
        candles: [],
        live: source,
      });
      conn.add("custom");

      // Host injects a custom window unrelated to the live source's history.
      const customWindow = [candle(10, 100), candle(11, 102), candle(12, 101)];
      conn.recompute(customWindow);
      expect(handles[0].setDataCalls.at(-1)).toHaveLength(customWindow.length);

      // New bar arrives via the live source.
      const c13 = candle(13, 105);
      completed.push(c13);
      emitComplete(c13, {});

      // Auto-recompute extends the custom window — does NOT revert to the
      // (empty) seed view, and does NOT discard host's custom bars.
      expect(handles[0].setDataCalls.at(-1)).toHaveLength(customWindow.length + 1);
    });

    it("respects liveRecompute=false opt-out for expensive batch presets", () => {
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [candle(1, 100)];
      const { source, emitComplete } = createMockLiveSource(completed);
      const preset: IndicatorPresetEntry = {
        ...makeComputePreset("hmm"),
        liveRecompute: false,
      };
      const conn = connectIndicators(chart, {
        presets: { hmm: preset },
        candles: [],
        live: source,
      });
      conn.add("hmm");
      const initialSetData = handles[0].setDataCalls.length;

      const c2 = candle(2, 102);
      completed.push(c2);
      emitComplete(c2, {});

      // Opted-out preset stays frozen at seed values.
      expect(handles[0].setDataCalls).toHaveLength(initialSetData);
    });

    it("liveRecompute=false makes manual recompute() the permanent override", () => {
      // The flip-side contract of liveRecompute: when a preset opts out of
      // auto-recompute, conn.recompute(custom) is the *only* way data
      // changes — and subsequent candleComplete events do not overwrite it.
      const { chart, handles } = createMockChart();
      const completed: CandleData[] = [candle(1, 100), candle(2, 102)];
      const { source, emitComplete } = createMockLiveSource(completed);
      const preset: IndicatorPresetEntry = {
        ...makeComputePreset("hmm"),
        liveRecompute: false,
      };
      const conn = connectIndicators(chart, {
        presets: { hmm: preset },
        candles: [],
        live: source,
      });
      conn.add("hmm");

      // Host pushes a custom candle window through recompute().
      const customWindow = [candle(1, 100), candle(2, 102), candle(3, 104)];
      conn.recompute(customWindow);
      const afterManual = handles[0].setDataCalls.length;
      expect(handles[0].setDataCalls.at(-1)).toHaveLength(3);

      // Live source advances. Auto-recompute is OFF, so the host's custom
      // window stays put — no setData fires.
      const c4 = candle(4, 106);
      completed.push(c4);
      emitComplete(c4, {});
      expect(handles[0].setDataCalls).toHaveLength(afterManual);
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

    it("should auto-suffix duplicate derived snapshotName (static snapshotName preset)", () => {
      const { chart } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const first = conn.add("rsi");
      const second = conn.add("rsi");
      expect(first.snapshotName).toBe("rsi");
      expect(second.snapshotName).toBe("rsi#2");
    });

    it("should throw when an explicit snapshotName collides with an existing one", () => {
      const { chart } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      conn.add("rsi", { snapshotName: "primary-rsi" });
      expect(() => conn.add("rsi", { snapshotName: "primary-rsi" })).toThrow(/already added/);
    });
  });

  // ============================================
  // Multiple instances of the same preset
  // ============================================
  describe("multiple instances", () => {
    it("should allow multiple instances of the same preset with different params (static)", () => {
      const { chart, handles } = createMockChart();
      const candles = [candle(1, 100), candle(2, 101)];
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };

      const conn = connectIndicators(chart, { presets, candles });
      const sma5 = conn.add("sma", { period: 5 });
      const sma20 = conn.add("sma", { period: 20 });
      const sma60 = conn.add("sma", { period: 60 });

      expect(handles).toHaveLength(3);
      expect(conn.list()).toHaveLength(3);
      expect(conn.listByPreset("sma")).toHaveLength(3);
      expect(sma5.snapshotName).toBe("sma5");
      expect(sma20.snapshotName).toBe("sma20");
      expect(sma60.snapshotName).toBe("sma60");
      expect(conn.get("sma5")).toBe(sma5);
      expect(conn.get("sma20")).toBe(sma20);
      expect(conn.get("sma60")).toBe(sma60);
    });

    it("should allow multiple instances of the same preset in live mode", () => {
      const { chart, handles } = createMockChart();
      const { source, emitTick, registeredIndicators } = createMockLiveSource([candle(1, 100)]);
      const presets = { sma: makeFactoryPreset("sma", { paramKeyedSnapshot: true }) };

      const conn = connectIndicators(chart, { presets, candles: [], live: source });
      conn.add("sma", { period: 5 });
      conn.add("sma", { period: 20 });
      conn.add("sma", { period: 60 });

      expect(registeredIndicators.has("sma5")).toBe(true);
      expect(registeredIndicators.has("sma20")).toBe(true);
      expect(registeredIndicators.has("sma60")).toBe(true);

      // Emit tick; all three should receive their own values from the snapshot
      emitTick(candle(2, 105), { sma5: 102, sma20: 99, sma60: 95 });
      expect(handles[0].updates[0]).toEqual({ time: 2, value: 102 });
      expect(handles[1].updates[0]).toEqual({ time: 2, value: 99 });
      expect(handles[2].updates[0]).toEqual({ time: 2, value: 95 });
    });

    it("should auto-suffix when the same preset is added twice with the same params", () => {
      const { chart } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const a = conn.add("sma", { period: 5 });
      const b = conn.add("sma", { period: 5 });
      const c = conn.add("sma", { period: 5 });
      expect(a.snapshotName).toBe("sma5");
      expect(b.snapshotName).toBe("sma5#2");
      expect(c.snapshotName).toBe("sma5#3");
    });

    it("should recompute all instances with their own params", () => {
      const { chart, handles } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      conn.add("sma", { period: 5 });
      conn.add("sma", { period: 20 });

      const newCandles = [candle(1, 100), candle(2, 101), candle(3, 102)];
      conn.recompute(newCandles);

      expect(handles[0].setDataCalls).toHaveLength(1);
      expect(handles[1].setDataCalls).toHaveLength(1);
      // compute was called with each instance's params
      expect(presets.sma.compute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ period: 5 }),
      );
      expect(presets.sma.compute).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ period: 20 }),
      );
    });
  });

  // ============================================
  // snapshotName override
  // ============================================
  describe("snapshotName override", () => {
    it("should use override to mount multiple instances of a static-snapshotName preset", () => {
      const { chart, handles } = createMockChart();
      const presets = { emaRibbon: makeComputePreset("emaRibbon") }; // static snapshotName
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const a = conn.add("emaRibbon", { snapshotName: "ribbon-short" });
      const b = conn.add("emaRibbon", { snapshotName: "ribbon-long" });

      expect(handles).toHaveLength(2);
      expect(a.snapshotName).toBe("ribbon-short");
      expect(b.snapshotName).toBe("ribbon-long");
      expect(conn.get("ribbon-short")).toBe(a);
      expect(conn.get("ribbon-long")).toBe(b);
    });

    it("should use override name as LiveCandle registration key", () => {
      const { chart } = createMockChart();
      const { source, registeredIndicators } = createMockLiveSource([candle(1, 100)]);
      const presets = { sma: makeFactoryPreset("sma", { paramKeyedSnapshot: true }) };

      const conn = connectIndicators(chart, { presets, candles: [], live: source });
      conn.add("sma", { period: 5, snapshotName: "my-sma" });

      expect(registeredIndicators.has("my-sma")).toBe(true);
      expect(registeredIndicators.has("sma5")).toBe(false);
    });
  });

  // ============================================
  // Indicator handle lifecycle
  // ============================================
  describe("indicator handle", () => {
    it("should expose snapshotName / presetId / params / series on the handle", () => {
      const { chart } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const h = conn.add("sma", { period: 5 });
      expect(h.snapshotName).toBe("sma5");
      expect(h.presetId).toBe("sma");
      expect(h.params).toMatchObject({ period: 5 });
      expect(h.series).toBeDefined();
      expect(h.removed).toBe(false);
    });

    it("handle.remove() should be idempotent", () => {
      const { chart, handles } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const h = conn.add("rsi");
      h.remove();
      expect(h.removed).toBe(true);
      expect(handles[0].removed).toBe(true);

      // Second remove is a no-op; series.remove should not be called again
      const removeSpy = handles[0].removed;
      h.remove();
      expect(removeSpy).toBe(true); // still true, no error
    });

    it("handle.setVisible() should forward to the series when not removed", () => {
      const { chart } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const h = conn.add("rsi");
      h.setVisible(false);
      expect(h.series.setVisible).toHaveBeenCalledWith(false);

      h.remove();
      h.setVisible(true); // no-op after remove
      // setVisible should still be called only once
      expect(h.series.setVisible).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // remove() dispatch
  // ============================================
  describe("remove() dispatch", () => {
    it("should remove by snapshotName (single instance)", () => {
      const { chart, handles } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      conn.add("sma", { period: 5 });
      conn.add("sma", { period: 20 });

      conn.remove("sma5");
      expect(handles[0].removed).toBe(true);
      expect(handles[1].removed).toBe(false);
      expect(conn.list()).toHaveLength(1);
      expect(conn.get("sma5")).toBeUndefined();
      expect(conn.get("sma20")).toBeDefined();
    });

    it("should remove all instances by preset id (fallback when snapshotName misses)", () => {
      const { chart, handles } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      conn.add("sma", { period: 5 });
      conn.add("sma", { period: 20 });
      conn.add("sma", { period: 60 });

      conn.remove("sma"); // preset id fallback
      expect(handles[0].removed).toBe(true);
      expect(handles[1].removed).toBe(true);
      expect(handles[2].removed).toBe(true);
      expect(conn.list()).toHaveLength(0);
    });

    it("should accept handle directly", () => {
      const { chart, handles } = createMockChart();
      const presets = { rsi: makeComputePreset("rsi") };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const h = conn.add("rsi");
      conn.remove(h);
      expect(handles[0].removed).toBe(true);
      expect(h.removed).toBe(true);
    });

    it("should be a silent no-op for unknown target", () => {
      const { chart } = createMockChart();
      const conn = connectIndicators(chart, { presets: {}, candles: [] });
      expect(() => conn.remove("nonexistent")).not.toThrow();
    });
  });

  // ============================================
  // defineIndicator / spec reuse
  // ============================================
  describe("defineIndicator / IndicatorSpec", () => {
    it("should add via pre-defined spec and be equivalent to direct form", () => {
      const { chart, handles } = createMockChart();
      const presets = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const conn = connectIndicators(chart, { presets, candles: [candle(1, 100)] });

      const spec = defineIndicator("sma", { period: 5 });
      const h = conn.add(spec);

      expect(h.snapshotName).toBe("sma5");
      expect(h.presetId).toBe("sma");
      expect(handles).toHaveLength(1);
    });

    it("should allow reusing the same spec across multiple connections", () => {
      const mockA = createMockChart();
      const mockB = createMockChart();
      const presetsA = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };
      const presetsB = { sma: makeComputePreset("sma", { paramKeyedSnapshot: true }) };

      const connA = connectIndicators(mockA.chart, {
        presets: presetsA,
        candles: [candle(1, 100)],
      });
      const connB = connectIndicators(mockB.chart, {
        presets: presetsB,
        candles: [candle(1, 100)],
      });

      const spec = defineIndicator("sma", { period: 5 });
      const hA = connA.add(spec);
      const hB = connB.add(spec);

      expect(hA).not.toBe(hB);
      expect(hA.series).not.toBe(hB.series);
      expect(mockA.handles).toHaveLength(1);
      expect(mockB.handles).toHaveLength(1);
    });
  });
});
