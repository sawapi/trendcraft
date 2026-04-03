/**
 * Tests for batchUpdates() and error/warning behavior.
 *
 * Since CanvasChart requires a browser DOM and jsdom is not installed,
 * we test the batch logic and error handling by verifying the mock
 * ChartInstance contract — ensuring batchUpdates exists on the type
 * and testing the internal mechanics through the DataLayer + TimeScale.
 */
import { describe, expect, it, vi } from "vitest";
import { DataLayer } from "../core/data-layer";
import { TimeScale } from "../core/scale";
import type { CandleData, ChartInstance, DataPoint, SeriesHandle } from "../core/types";

function makeCandles(count: number, startTime = 1000): CandleData[] {
  return Array.from({ length: count }, (_, i) => ({
    time: startTime + i * 60_000,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 10,
  }));
}

/**
 * Minimal mock implementing the batchUpdates pattern from CanvasChart.
 * This mirrors the actual implementation logic.
 */
function createBatchableChart() {
  const data = new DataLayer();
  const timeScale = new TimeScale();
  const timeToIndex = new Map<number, number>();
  const warnings: Array<{ message: string; detail: unknown }> = [];
  const events = new Map<string, Set<(data: unknown) => void>>();
  let batching = false;
  let batchScrollToEnd = false;
  let renderCount = 0;
  let needsRender = false;

  function emit(event: string, payload: unknown) {
    const handlers = events.get(event);
    if (handlers) {
      for (const h of handlers) h(payload);
    }
  }

  function warn(message: string, detail?: unknown) {
    warnings.push({ message, detail });
    emit("error", { message, detail });
  }

  function scheduleRender() {
    needsRender = true;
  }

  function flushRender() {
    if (needsRender) {
      needsRender = false;
      renderCount++;
    }
  }

  function rebuildTimeIndex() {
    timeToIndex.clear();
    const candles = data.candles;
    for (let i = 0; i < candles.length; i++) {
      timeToIndex.set(candles[i].time, i);
    }
  }

  return {
    data,
    timeScale,
    warnings,
    get renderCount() {
      return renderCount;
    },
    flushRender,

    setCandles(candles: CandleData[]) {
      if (!Array.isArray(candles)) {
        warn("setCandles: expected an array", typeof candles);
        return;
      }
      const valid = candles.filter(
        (c) =>
          c &&
          typeof c.time === "number" &&
          Number.isFinite(c.open) &&
          Number.isFinite(c.high) &&
          Number.isFinite(c.low) &&
          Number.isFinite(c.close) &&
          Number.isFinite(c.volume),
      );
      const removed = candles.length - valid.length;
      data.setCandles(valid);
      rebuildTimeIndex();
      timeScale.setTotalCount(data.candleCount);
      timeScale.scrollToEnd();
      scheduleRender();
      if (removed > 0) {
        emit("dataFiltered", { total: candles.length, valid: valid.length, removed });
      }
    },

    updateCandle(candle: CandleData) {
      if (
        !candle ||
        typeof candle.time !== "number" ||
        !Number.isFinite(candle.open) ||
        !Number.isFinite(candle.close)
      ) {
        warn("updateCandle: invalid candle data ignored", candle);
        return;
      }
      const wasAtEnd = timeScale.endIndex >= data.candleCount - 1;
      const prevCount = data.candleCount;
      data.updateCandle(candle);

      if (data.candleCount > prevCount) {
        timeToIndex.set(candle.time, data.candleCount - 1);
      }
      timeScale.setTotalCount(data.candleCount);

      if (wasAtEnd) {
        if (batching) {
          batchScrollToEnd = true;
        } else {
          timeScale.scrollToEnd();
        }
      }
      scheduleRender();
    },

    batchUpdates(fn: () => void) {
      batching = true;
      batchScrollToEnd = false;
      try {
        fn();
      } finally {
        batching = false;
        if (batchScrollToEnd) {
          timeScale.scrollToEnd();
        }
        scheduleRender();
      }
    },

    addIndicator(series: DataPoint[]) {
      if (!Array.isArray(series)) {
        warn("addIndicator: expected an array", typeof series);
        return;
      }
      if (series.length === 0) {
        warn("addIndicator: empty series array — indicator will not be visible");
      }
    },

    on(event: string, handler: (data: unknown) => void) {
      let set = events.get(event);
      if (!set) {
        set = new Set();
        events.set(event, set);
      }
      set.add(handler);
    },
  };
}

describe("batchUpdates", () => {
  it("batches multiple updateCandle calls into deferred scrollToEnd", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(50));
    chart.flushRender(); // flush initial

    const scrollSpy = vi.spyOn(chart.timeScale, "scrollToEnd");

    chart.batchUpdates(() => {
      for (let i = 0; i < 10; i++) {
        chart.updateCandle({
          time: 1000 + (50 + i) * 60_000,
          open: 200 + i,
          high: 210 + i,
          low: 195 + i,
          close: 205 + i,
          volume: 3000 + i,
        });
      }
    });

    // scrollToEnd should be called once at end of batch, not 10 times
    // (Once per batch completion, not per updateCandle)
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("does not call scrollToEnd during batch", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(50));
    chart.flushRender();

    let scrollCalled = false;
    const origScrollToEnd = chart.timeScale.scrollToEnd.bind(chart.timeScale);
    vi.spyOn(chart.timeScale, "scrollToEnd").mockImplementation(() => {
      scrollCalled = true;
      origScrollToEnd();
    });

    chart.batchUpdates(() => {
      chart.updateCandle({
        time: 1000 + 50 * 60_000,
        open: 200,
        high: 210,
        low: 195,
        close: 205,
        volume: 3000,
      });
      // During batch, scrollToEnd should not have been called yet
      expect(scrollCalled).toBe(false);
    });

    // After batch, it should be called
    expect(scrollCalled).toBe(true);
  });

  it("recovers from errors inside batch callback", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(50));

    expect(() => {
      chart.batchUpdates(() => {
        chart.updateCandle({
          time: 1000 + 49 * 60_000,
          open: 150,
          high: 160,
          low: 140,
          close: 155,
          volume: 2000,
        });
        throw new Error("user error");
      });
    }).toThrow("user error");

    // Chart should still be usable (batching flag reset)
    expect(() => {
      chart.updateCandle({
        time: 1000 + 49 * 60_000,
        open: 151,
        high: 161,
        low: 141,
        close: 156,
        volume: 2001,
      });
    }).not.toThrow();
  });

  it("handles update of existing candle within batch", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(50));

    chart.batchUpdates(() => {
      // Update existing candle multiple times
      for (let i = 0; i < 5; i++) {
        chart.updateCandle({
          time: 1000 + 49 * 60_000,
          open: 149,
          high: 160 + i,
          low: 140,
          close: 155 + i,
          volume: 2000 + i,
        });
      }
    });

    // Last update should be reflected
    const lastCandle = chart.data.candles[49];
    expect(lastCandle.high).toBe(164);
    expect(lastCandle.close).toBe(159);
  });
});

describe("error warnings", () => {
  it("warns on setCandles with non-array", () => {
    const chart = createBatchableChart();
    chart.setCandles("not an array" as unknown as CandleData[]);
    expect(chart.warnings).toHaveLength(1);
    expect(chart.warnings[0].message).toContain("setCandles");
  });

  it("emits error event on invalid setCandles", () => {
    const chart = createBatchableChart();
    const errorHandler = vi.fn();
    chart.on("error", errorHandler);
    chart.setCandles(null as unknown as CandleData[]);
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("setCandles") }),
    );
  });

  it("warns on updateCandle with invalid data", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(5));
    chart.updateCandle({ time: 1000, open: Number.NaN } as CandleData);
    expect(chart.warnings).toHaveLength(1);
    expect(chart.warnings[0].message).toContain("updateCandle");
  });

  it("warns on addIndicator with non-array", () => {
    const chart = createBatchableChart();
    chart.addIndicator("not an array" as unknown as []);
    expect(chart.warnings).toHaveLength(1);
    expect(chart.warnings[0].message).toContain("addIndicator");
  });

  it("warns on addIndicator with empty array", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(5));
    chart.addIndicator([]);
    expect(chart.warnings).toHaveLength(1);
    expect(chart.warnings[0].message).toContain("addIndicator");
  });

  it("emits dataFiltered event when candles are filtered", () => {
    const chart = createBatchableChart();
    const handler = vi.fn();
    chart.on("dataFiltered", handler);
    chart.setCandles([
      { time: 1, open: 1, high: 2, low: 0, close: 1, volume: 100 },
      { time: 2, open: Number.NaN, high: 2, low: 0, close: 1, volume: 100 },
    ]);
    expect(handler).toHaveBeenCalledWith({ total: 2, valid: 1, removed: 1 });
  });

  it("does not warn on valid setCandles", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(10));
    expect(chart.warnings).toHaveLength(0);
  });

  it("does not warn on valid updateCandle", () => {
    const chart = createBatchableChart();
    chart.setCandles(makeCandles(5));
    chart.updateCandle({
      time: 1000,
      open: 100,
      high: 110,
      low: 95,
      close: 105,
      volume: 500,
    });
    expect(chart.warnings).toHaveLength(0);
  });
});

describe("ChartInstance type includes batchUpdates", () => {
  it("batchUpdates is defined on ChartInstance type", () => {
    // Type-level check — if this compiles, the type is correct
    const _typeCheck: ChartInstance["batchUpdates"] = (_fn: () => void) => {};
    expect(typeof _typeCheck).toBe("function");
  });
});
