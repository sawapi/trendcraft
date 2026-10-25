import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { decimateCandles, lttb } from "../core/decimation";
import { TimeScale } from "../core/scale";
import type { CandleData, DataPoint } from "../core/types";

function generateCandles(count: number): CandleData[] {
  const candles: CandleData[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 4;
    price += change;
    const open = price;
    const close = price + (Math.random() - 0.5) * 2;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;
    candles.push({
      time: 1700000000000 + i * 86400000,
      open,
      high,
      low,
      close,
      volume: Math.round(Math.random() * 10000000),
    });
  }
  return candles;
}

function generateLineData(count: number): DataPoint<number>[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1700000000000 + i * 86400000,
    value: 100 + Math.sin(i * 0.01) * 50,
  }));
}

/**
 * Timing policy. These tests catch a gross regression, such as an
 * accidental O(n^2) loop, not a constant-factor drift: that needs a benchmark.
 * The budgets leave wide headroom on a developer machine, but shared CI runners
 * run this file alongside the other test files and swing by far more: LTTB on
 * 100k points takes ~2ms locally and has measured 57ms on CI (when it ran
 * Node 20) against a 50ms budget, for a change that did not touch the chart.
 * So on CI every budget is multiplied by CI_SLACK.
 */
const CI_SLACK = process.env.CI && process.env.CI !== "false" ? 3 : 1;

/** A time budget in ms, widened on CI (see CI_SLACK). */
function budget(ms: number): number {
  return ms * CI_SLACK;
}

/** Run fn multiple times and return the median elapsed ms (avoids JIT warm-up outliers) */
function medianMs(fn: () => void, runs = 5): number {
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

describe("Performance", () => {
  const SIZE = 10_000;
  const LARGE = 100_000;
  const XLARGE = 500_000;

  it(`DataLayer.setCandles with ${SIZE} candles < 16ms (median of 5 runs)`, () => {
    const candles = generateCandles(SIZE);
    const dl = new DataLayer();

    const median = medianMs(() => dl.setCandles(candles));

    expect(dl.candleCount).toBe(SIZE);
    expect(median).toBeLessThan(budget(16));
  });

  it(`100 TimeScale scrolls with ${SIZE} candles < 16ms (median of 5 runs)`, () => {
    const ts = new TimeScale();
    ts.setWidth(1200);
    ts.setTotalCount(SIZE);
    ts.scrollToEnd();

    const median = medianMs(() => {
      for (let i = 0; i < 100; i++) {
        ts.scrollBy(10);
      }
    });

    expect(median).toBeLessThan(budget(16));
  });

  it(`100 TimeScale zooms with ${SIZE} candles < 16ms (median of 5 runs)`, () => {
    const ts = new TimeScale();
    ts.setWidth(1200);
    ts.setTotalCount(SIZE);

    const median = medianMs(() => {
      for (let i = 0; i < 100; i++) {
        ts.zoom(i % 2 === 0 ? 1.1 : 0.9);
      }
    });

    expect(median).toBeLessThan(budget(16));
  });

  it(`LTTB decimation ${SIZE} → 800 points < 16ms (median of 5 runs)`, () => {
    const data = generateLineData(SIZE);

    let result!: ReturnType<typeof lttb>;
    const median = medianMs(() => {
      result = lttb(data, 800);
    });

    expect(result.points.length).toBe(800);
    expect(median).toBeLessThan(budget(16));
  });

  it(`Candle decimation ${SIZE} → 1000 bars < 16ms (median of 5 runs)`, () => {
    const candles = generateCandles(SIZE);

    let result!: ReturnType<typeof decimateCandles>;
    const median = medianMs(() => {
      result = decimateCandles(candles, 0, SIZE, 1000);
    });

    expect(result.candles.length).toBe(1000);
    expect(median).toBeLessThan(budget(16));
  });

  it(`10K DataLayer.indexAtTime lookups on ${SIZE} candles < 16ms (median of 5 runs)`, () => {
    const candles = generateCandles(SIZE);
    const dl = new DataLayer();
    dl.setCandles(candles);

    const midTime = candles[Math.floor(SIZE / 2)].time;

    const median = medianMs(() => {
      for (let i = 0; i < 10000; i++) {
        dl.indexAtTime(midTime);
      }
    });

    expect(median).toBeLessThan(budget(16));
  });

  // ---- Large-scale benchmarks (100k+) ----

  it(`DataLayer.setCandles with ${LARGE} candles < 100ms`, () => {
    const candles = generateCandles(LARGE);
    const dl = new DataLayer();

    const median = medianMs(() => dl.setCandles(candles));

    expect(dl.candleCount).toBe(LARGE);
    expect(median).toBeLessThan(budget(100));
  });

  it(`LTTB decimation ${LARGE} → 1000 points < 50ms`, () => {
    const data = generateLineData(LARGE);

    let result!: ReturnType<typeof lttb>;
    const median = medianMs(() => {
      result = lttb(data, 1000);
    });

    expect(result.points.length).toBe(1000);
    expect(median).toBeLessThan(budget(50));
  });

  it(`Candle decimation ${LARGE} → 1000 bars < 50ms`, () => {
    const candles = generateCandles(LARGE);

    let result!: ReturnType<typeof decimateCandles>;
    const median = medianMs(() => {
      result = decimateCandles(candles, 0, LARGE, 1000);
    });

    expect(result.candles.length).toBe(1000);
    expect(median).toBeLessThan(budget(50));
  });

  it(`10K DataLayer.indexAtTime lookups on ${LARGE} candles < 16ms (median of 5 runs)`, () => {
    const candles = generateCandles(LARGE);
    const dl = new DataLayer();
    dl.setCandles(candles);

    const midTime = candles[Math.floor(LARGE / 2)].time;

    const median = medianMs(() => {
      for (let i = 0; i < 10_000; i++) {
        dl.indexAtTime(midTime);
      }
    });

    expect(median).toBeLessThan(budget(16));
  });

  it(`TimeScale operations with ${LARGE} candles < 16ms (median of 5 runs)`, () => {
    const ts = new TimeScale();
    ts.setWidth(1920);
    ts.setTotalCount(LARGE);
    ts.scrollToEnd();

    const median = medianMs(() => {
      for (let i = 0; i < 1000; i++) {
        ts.scrollBy(10);
        ts.zoom(i % 2 === 0 ? 1.01 : 0.99);
      }
    });

    expect(median).toBeLessThan(budget(16));
  });

  it(`DataLayer.setCandles with ${XLARGE} candles < 500ms`, () => {
    const candles = generateCandles(XLARGE);
    const dl = new DataLayer();

    const median = medianMs(() => dl.setCandles(candles));

    expect(dl.candleCount).toBe(XLARGE);
    expect(median).toBeLessThan(budget(500));
  });

  it(`LTTB decimation ${XLARGE} → 2000 points < 200ms`, () => {
    const data = generateLineData(XLARGE);

    let result!: ReturnType<typeof lttb>;
    const median = medianMs(() => {
      result = lttb(data, 2000);
    });

    expect(result.points.length).toBe(2000);
    expect(median).toBeLessThan(budget(200));
  });

  it(`updateCandle throughput: 1000 updates < 25ms (${SIZE} base)`, () => {
    const candles = generateCandles(SIZE);
    const dl = new DataLayer();
    dl.setCandles(candles);

    const lastTime = candles[candles.length - 1].time;

    const median = medianMs(() => {
      for (let i = 0; i < 1000; i++) {
        dl.updateCandle({
          time: lastTime,
          open: 100 + i,
          high: 110 + i,
          low: 90,
          close: 105 + i,
          volume: 5000 + i,
        });
      }
    }, 5);

    // updateCandle is a hot path, so we keep an upper bound rather than skip.
    expect(median).toBeLessThan(budget(25));
  });
});
