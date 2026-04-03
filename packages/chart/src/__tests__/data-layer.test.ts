import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import type { CandleData, DataPoint } from "../core/types";

function makeCandle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 1000 };
}

describe("DataLayer", () => {
  it("stores and retrieves candles sorted by time", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(3, 100), makeCandle(1, 98), makeCandle(2, 99)]);

    expect(dl.candleCount).toBe(3);
    expect(dl.candles[0].time).toBe(1);
    expect(dl.candles[1].time).toBe(2);
    expect(dl.candles[2].time).toBe(3);
  });

  it("updates last candle in place", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(1, 100), makeCandle(2, 101)]);

    dl.updateCandle(makeCandle(2, 105));
    expect(dl.candleCount).toBe(2);
    expect(dl.candles[1].close).toBe(105);
  });

  it("appends new candle", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(1, 100)]);

    dl.updateCandle(makeCandle(2, 101));
    expect(dl.candleCount).toBe(2);
  });

  it("binary searches for index by time", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(100, 10), makeCandle(200, 20), makeCandle(300, 30)]);

    expect(dl.indexAtTime(200)).toBe(1);
    expect(dl.indexAtTime(150)).toBe(1); // Inserts between
  });

  it("manages series lifecycle", () => {
    const dl = new DataLayer();
    dl.setCandles([makeCandle(1, 100), makeCandle(2, 101)]);

    const data: DataPoint<number>[] = [
      { time: 1, value: 50 },
      { time: 2, value: 60 },
    ];

    const handle = dl.addSeries(data, { pane: "sub" }, "line");
    expect(dl.getAllSeries().length).toBe(1);

    handle.setVisible(false);
    expect(dl.getVisibleSeries().length).toBe(0);

    handle.setVisible(true);
    expect(dl.getVisibleSeries().length).toBe(1);

    handle.remove();
    expect(dl.getAllSeries().length).toBe(0);
  });

  it("filters series by pane", () => {
    const dl = new DataLayer();
    const data: DataPoint<number>[] = [{ time: 1, value: 42 }];

    dl.addSeries(data, { pane: "main" }, "line");
    dl.addSeries(data, { pane: "sub1" }, "line");
    dl.addSeries(data, { pane: "sub1" }, "histogram");

    expect(dl.getSeriesForPane("main").length).toBe(1);
    expect(dl.getSeriesForPane("sub1").length).toBe(2);
    expect(dl.getSeriesForPane("nonexistent").length).toBe(0);
  });

  it("tracks dirty state", () => {
    const dl = new DataLayer();
    dl.clearDirty();
    expect(dl.dirty).toBe(false);

    dl.setCandles([makeCandle(1, 100)]);
    expect(dl.dirty).toBe(true);
  });

  it("stores signals and trades", () => {
    const dl = new DataLayer();
    dl.setSignals([{ time: 1, type: "buy" }]);
    expect(dl.signals.length).toBe(1);

    dl.setTrades([{ entryTime: 1, entryPrice: 100, exitTime: 2, exitPrice: 110 }]);
    expect(dl.trades.length).toBe(1);
  });

  it("streaming update on series handle", () => {
    const dl = new DataLayer();
    const handle = dl.addSeries([{ time: 1, value: 10 }], { pane: "main" }, "line");

    // Append
    handle.update({ time: 2, value: 20 });
    const series = dl.getAllSeries()[0];
    expect(series.data.length).toBe(2);

    // Update in place
    handle.update({ time: 2, value: 25 });
    expect(series.data.length).toBe(2);
    expect((series.data[1] as DataPoint<number>).value).toBe(25);
  });

  it("manages drawings via DataLayer", () => {
    const dl = new DataLayer();
    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    expect(dl.getDrawings().length).toBe(1);
    dl.removeDrawing("h1");
    expect(dl.getDrawings().length).toBe(0);
  });

  it("onPaneEmpty fires after last series removed", () => {
    const dl = new DataLayer();
    const events: string[] = [];
    dl.setOnPaneEmpty((id) => events.push(id));

    const h1 = dl.addSeries([{ time: 1, value: 1 }], { pane: "test" }, "line");
    const h2 = dl.addSeries([{ time: 1, value: 2 }], { pane: "test" }, "line");

    h1.remove();
    expect(events.length).toBe(0); // h2 still in pane

    h2.remove();
    expect(events).toEqual(["test"]);
  });

  it("onChange fires on every mutation", () => {
    const dl = new DataLayer();
    let count = 0;
    dl.setOnChange(() => count++);

    dl.setCandles([makeCandle(1, 100)]);
    expect(count).toBe(1);

    dl.updateCandle(makeCandle(2, 101));
    expect(count).toBe(2);

    dl.addDrawing({ id: "h1", type: "hline", price: 100 });
    expect(count).toBe(3);
  });
});
