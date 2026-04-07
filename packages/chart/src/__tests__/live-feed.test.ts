import { describe, expect, it, vi } from "vitest";
import type { CandleData, ChartInstance, DataPoint, SeriesHandle } from "../core/types";
import { connectLiveFeed } from "../integration/live-feed";
import type { LiveFeedSource } from "../integration/live-feed";

// ============================================
// Mock helpers
// ============================================

function createMockChart() {
  const handles: Array<{
    id: string;
    updates: DataPoint[];
    removed: boolean;
  }> = [];
  let handleCounter = 0;

  const chart = {
    setCandles: vi.fn(),
    updateCandle: vi.fn(),
    addIndicator: vi.fn((_data: DataPoint[], _config?: unknown): SeriesHandle => {
      const id = `series-${handleCounter++}`;
      const record = { id, updates: [] as DataPoint[], removed: false };
      handles.push(record);
      return {
        id,
        update: vi.fn((point: DataPoint) => {
          record.updates.push(point);
        }),
        setData: vi.fn(),
        setVisible: vi.fn(),
        remove: vi.fn(() => {
          record.removed = true;
        }),
      };
    }),
    batchUpdates: vi.fn((fn: () => void) => fn()),
    // Satisfy ChartInstance with minimal stubs
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

function createMockSource(
  completedCandles: CandleData[] = [],
  currentCandle: CandleData | null = null,
) {
  const tickCallbacks: Array<
    (p: { candle: CandleData; snapshot: Record<string, unknown>; isNewCandle: boolean }) => void
  > = [];
  const completeCallbacks: Array<
    (p: { candle: CandleData; snapshot: Record<string, unknown> }) => void
  > = [];

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

  const source: LiveFeedSource = {
    completedCandles,
    candle: currentCandle,
    snapshot: {},
    on: onImpl as LiveFeedSource["on"],
  };

  return {
    source,
    emitTick(candle: CandleData, snapshot: Record<string, unknown>, isNewCandle = false) {
      for (const cb of [...tickCallbacks]) {
        cb({ candle, snapshot, isNewCandle });
      }
    },
    emitComplete(candle: CandleData, snapshot: Record<string, unknown>) {
      for (const cb of [...completeCallbacks]) {
        cb({ candle, snapshot });
      }
    },
    tickCallbackCount: () => tickCallbacks.length,
    completeCallbackCount: () => completeCallbacks.length,
  };
}

function candle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 100 };
}

// ============================================
// Tests
// ============================================

describe("connectLiveFeed", () => {
  it("should initialize chart with history by default", () => {
    const { chart } = createMockChart();
    const history = [candle(0, 100), candle(60000, 105)];
    const { source } = createMockSource(history, candle(120000, 110));

    connectLiveFeed(chart, source);

    expect(chart.setCandles).toHaveBeenCalledWith(history);
    expect(chart.updateCandle).toHaveBeenCalledWith(candle(120000, 110));
  });

  it("should skip history initialization when initHistory=false", () => {
    const { chart } = createMockChart();
    const { source } = createMockSource([candle(0, 100)]);

    connectLiveFeed(chart, source, { initHistory: false });

    expect(chart.setCandles).not.toHaveBeenCalled();
  });

  it("should call chart.updateCandle and handle.update on tick event", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        sma: { snapshotPath: "sma20", series: { color: "#2196F3" } },
      },
    });

    const c = candle(1000, 100);
    emitTick(c, { sma20: 99.5 });

    expect(chart.updateCandle).toHaveBeenCalledWith(c);
    // addIndicator returns a handle, check its update was called
    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 1000, value: 99.5 });
  });

  it("should update handles on candleComplete event", () => {
    const { chart } = createMockChart();
    const { source, emitComplete } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        rsi: { snapshotPath: "rsi14" },
      },
    });

    const c = candle(60000, 105);
    emitComplete(c, { rsi14: 65.3 });

    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 60000, value: 65.3 });
  });

  it("should resolve dot-path snapshot values", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        bbUp: { snapshotPath: "bb.upper" },
        bbLow: { snapshotPath: "bb.lower" },
      },
    });

    emitTick(candle(1000, 100), {
      bb: { upper: 112, middle: 100, lower: 88 },
    });

    const handles = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results;
    expect(handles[0].value.update).toHaveBeenCalledWith({ time: 1000, value: 112 });
    expect(handles[1].value.update).toHaveBeenCalledWith({ time: 1000, value: 88 });
  });

  it("should pass compound object when snapshotPath points to an object", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        bb: { snapshotPath: "bb" },
      },
    });

    const bbValue = { upper: 112, middle: 100, lower: 88 };
    emitTick(candle(1000, 100), { bb: bbValue });

    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 1000, value: bbValue });
  });

  it("should extract candle field when candleField is set", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        vol: { candleField: "volume", series: { type: "histogram" } },
      },
    });

    const c = candle(1000, 100); // volume = 100
    emitTick(c, {});

    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 1000, value: 100 });
  });

  it("should pass null when snapshot path resolves to non-number", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    connectLiveFeed(chart, source, {
      indicators: {
        sma: { snapshotPath: "sma20" },
      },
    });

    emitTick(candle(1000, 100), { sma20: undefined });

    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 1000, value: null });
  });

  it("should add indicator dynamically", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    const conn = connectLiveFeed(chart, source);
    expect(chart.addIndicator).not.toHaveBeenCalled();

    conn.addIndicator("ema", { snapshotPath: "ema50", series: { color: "#FF9800" } });
    expect(chart.addIndicator).toHaveBeenCalledTimes(1);

    // Verify it receives updates
    emitTick(candle(1000, 100), { ema50: 98 });
    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(handle.update).toHaveBeenCalledWith({ time: 1000, value: 98 });
  });

  it("should remove indicator and call handle.remove()", () => {
    const { chart } = createMockChart();
    const { source, emitTick } = createMockSource();

    const conn = connectLiveFeed(chart, source, {
      indicators: {
        sma: { snapshotPath: "sma20" },
      },
    });

    const handle = (chart.addIndicator as ReturnType<typeof vi.fn>).mock.results[0].value;
    conn.removeIndicator("sma");
    expect(handle.remove).toHaveBeenCalled();

    // After removal, tick should not update the old handle
    handle.update.mockClear();
    emitTick(candle(1000, 100), { sma20: 99 });
    expect(handle.update).not.toHaveBeenCalled();
  });

  it("should disconnect and remove all handles", () => {
    const { chart, handles } = createMockChart();
    const { source, tickCallbackCount, completeCallbackCount } = createMockSource();

    const conn = connectLiveFeed(chart, source, {
      indicators: {
        a: { snapshotPath: "a" },
        b: { snapshotPath: "b" },
      },
    });

    expect(conn.connected).toBe(true);

    conn.disconnect();

    expect(conn.connected).toBe(false);
    expect(handles.every((h) => h.removed)).toBe(true);
    expect(tickCallbackCount()).toBe(0);
    expect(completeCallbackCount()).toBe(0);
  });

  it("should throw on operations after disconnect", () => {
    const { chart } = createMockChart();
    const { source } = createMockSource();

    const conn = connectLiveFeed(chart, source);
    conn.disconnect();

    expect(() => conn.addIndicator("x", { snapshotPath: "x" })).toThrow("disconnected");
    expect(() => conn.removeIndicator("x")).toThrow("disconnected");
  });
});
