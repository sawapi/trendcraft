/**
 * Tests for maxCandles option — prevents unbounded memory growth in live mode.
 */

import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { CandleData, DataPoint } from "../core/types";

function makeCandle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 1000 };
}

describe("maxCandles", () => {
  it("trims oldest candles when exceeding maxCandles on updateCandle", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(5);
    dl.setCandles([makeCandle(1, 100), makeCandle(2, 101), makeCandle(3, 102)]);

    // Append candles beyond the limit
    dl.updateCandle(makeCandle(4, 103));
    dl.updateCandle(makeCandle(5, 104));
    expect(dl.candleCount).toBe(5);

    dl.updateCandle(makeCandle(6, 105));
    expect(dl.candleCount).toBe(5);
    // Oldest candle (time=1) should be trimmed
    expect(dl.candles[0].time).toBe(2);
    expect(dl.candles[4].time).toBe(6);
  });

  it("does not trim on in-place update (same time)", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(3);
    dl.setCandles([makeCandle(1, 100), makeCandle(2, 101), makeCandle(3, 102)]);

    // In-place update should not trigger trim
    dl.updateCandle(makeCandle(3, 110));
    expect(dl.candleCount).toBe(3);
    expect(dl.candles[2].close).toBe(110);
  });

  it("does not trim when maxCandles is null (unlimited)", () => {
    const dl = new DataLayer();
    // Default is null (unlimited)
    for (let i = 0; i < 100; i++) {
      dl.updateCandle(makeCandle(i, 100 + i));
    }
    expect(dl.candleCount).toBe(100);
  });

  it("rebuilds timeToIndex correctly after trim", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(3);
    dl.setCandles([makeCandle(10, 100), makeCandle(20, 101), makeCandle(30, 102)]);

    dl.updateCandle(makeCandle(40, 103));
    // time=10 should be gone, time=20 should be at index 0
    expect(dl.indexAtTime(10)).toBe(0); // Binary search returns insertion point
    expect(dl.indexAtTime(20)).toBe(0);
    expect(dl.indexAtTime(30)).toBe(1);
    expect(dl.indexAtTime(40)).toBe(2);
  });

  it("trims series data when exceeding maxCandles", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(5);
    dl.setCandles([makeCandle(1, 100)]);

    const data: DataPoint<number>[] = [{ time: 1, value: 50 }];
    const handle = dl.addSeries(data, { label: "test" }, "line");

    // Append beyond limit
    for (let i = 2; i <= 10; i++) {
      handle.update({ time: i, value: 50 + i });
    }

    const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;
    expect(series.data.length).toBe(5);
    expect(series.data[0].time).toBe(6);
    expect(series.data[4].time).toBe(10);
  });

  it("setMaxCandles can be changed at runtime", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(1, 100), makeCandle(2, 101), makeCandle(3, 102)]);

    // No limit initially
    dl.updateCandle(makeCandle(4, 103));
    expect(dl.candleCount).toBe(4);

    // Set limit — next append will trigger trim
    dl.setMaxCandles(3);
    dl.updateCandle(makeCandle(5, 104));
    expect(dl.candleCount).toBe(3);
    expect(dl.candles[0].time).toBe(3);
  });

  it("trims candles on setCandles when maxCandles is set", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(3);

    // Load 10 candles of history — should be trimmed to 3
    const candles = Array.from({ length: 10 }, (_, i) => makeCandle(i + 1, 100 + i));
    dl.setCandles(candles);
    expect(dl.candleCount).toBe(3);
    expect(dl.candles[0].time).toBe(8);
    expect(dl.candles[2].time).toBe(10);
  });

  it("trims initial series data on addSeries when maxCandles is set", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(5);
    dl.setCandles([makeCandle(1, 100)]);

    // Add series with 10 points of backfill
    const data: DataPoint<number>[] = Array.from({ length: 10 }, (_, i) => ({
      time: i + 1,
      value: 50 + i,
    }));
    const handle = dl.addSeries(data, { label: "test" }, "line");
    const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;
    expect(series.data.length).toBe(5);
    expect(series.data[0].time).toBe(6);
  });

  it("trims series data on setData when maxCandles is set", () => {
    const dl = new DataLayer();
    dl.setMaxCandles(5);
    dl.setCandles([makeCandle(1, 100)]);

    const handle = dl.addSeries(
      [{ time: 1, value: 50 }] as DataPoint<number>[],
      { label: "test" },
      "line",
    );

    // Replace with 10 points
    const newData: DataPoint<number>[] = Array.from({ length: 10 }, (_, i) => ({
      time: i + 1,
      value: 60 + i,
    }));
    handle.setData(newData);
    const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;
    expect(series.data.length).toBe(5);
    expect(series.data[0].time).toBe(6);
  });
});
