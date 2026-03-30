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

  it(`DataLayer.setCandles with ${SIZE} candles < 16ms (median of 5 runs)`, () => {
    const candles = generateCandles(SIZE);
    const dl = new DataLayer();

    const median = medianMs(() => dl.setCandles(candles));

    expect(dl.candleCount).toBe(SIZE);
    expect(median).toBeLessThan(16);
  });

  it(`TimeScale scroll with ${SIZE} candles < 1ms`, () => {
    const ts = new TimeScale();
    ts.setWidth(1200);
    ts.setTotalCount(SIZE);
    ts.scrollToEnd();

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      ts.scrollBy(10);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(16); // 100 scroll ops < 16ms
  });

  it(`TimeScale zoom with ${SIZE} candles < 1ms`, () => {
    const ts = new TimeScale();
    ts.setWidth(1200);
    ts.setTotalCount(SIZE);

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      ts.zoom(i % 2 === 0 ? 1.1 : 0.9);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(16);
  });

  it(`LTTB decimation ${SIZE} → 800 points < 16ms`, () => {
    const data = generateLineData(SIZE);

    const start = performance.now();
    const result = lttb(data, 800);
    const elapsed = performance.now() - start;

    expect(result.length).toBe(800);
    expect(elapsed).toBeLessThan(16);
  });

  it(`Candle decimation ${SIZE} → 1000 bars < 16ms`, () => {
    const candles = generateCandles(SIZE);

    const start = performance.now();
    const result = decimateCandles(candles, 0, SIZE, 1000);
    const elapsed = performance.now() - start;

    expect(result.length).toBe(1000);
    expect(elapsed).toBeLessThan(16);
  });

  it(`DataLayer.indexAtTime binary search on ${SIZE} candles < 1ms`, () => {
    const candles = generateCandles(SIZE);
    const dl = new DataLayer();
    dl.setCandles(candles);

    const midTime = candles[Math.floor(SIZE / 2)].time;

    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      dl.indexAtTime(midTime);
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(16); // 10K lookups < 16ms
  });
});
