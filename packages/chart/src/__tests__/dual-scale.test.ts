import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { PriceScale } from "../core/scale";
import type { DataPoint, PaneRect } from "../core/types";
import { computePaneRange } from "../renderer/range-calculator";

describe("Dual Scale — DataLayer", () => {
  it("addSeries defaults scaleId to 'right'", () => {
    const dl = new DataLayer();
    dl.setCandles([{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    const handle = dl.addSeries([{ time: 1, value: 50 }], { pane: "main" }, "line");
    const series = dl.getAllSeries().find((s) => s.id === handle.id);
    expect(series?.scaleId).toBe("right");
  });

  it("addSeries respects explicit scaleId='left'", () => {
    const dl = new DataLayer();
    dl.setCandles([{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    const handle = dl.addSeries(
      [{ time: 1, value: 50 }],
      { pane: "main", scaleId: "left" },
      "line",
    );
    const series = dl.getAllSeries().find((s) => s.id === handle.id);
    expect(series?.scaleId).toBe("left");
  });

  it("getSeriesForScale filters by scaleId", () => {
    const dl = new DataLayer();
    dl.setCandles([{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    dl.addSeries([{ time: 1, value: 100 }], { pane: "main", scaleId: "right" }, "line");
    dl.addSeries([{ time: 1, value: 50 }], { pane: "main", scaleId: "left" }, "line");
    dl.addSeries([{ time: 1, value: 75 }], { pane: "main", scaleId: "right" }, "line");

    expect(dl.getSeriesForScale("main", "right")).toHaveLength(2);
    expect(dl.getSeriesForScale("main", "left")).toHaveLength(1);
  });

  it("hasSeriesOnScale returns correct boolean", () => {
    const dl = new DataLayer();
    dl.setCandles([{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    dl.addSeries([{ time: 1, value: 100 }], { pane: "main", scaleId: "right" }, "line");

    expect(dl.hasSeriesOnScale("main", "right")).toBe(true);
    expect(dl.hasSeriesOnScale("main", "left")).toBe(false);
  });

  it("getSeriesForPane returns all series regardless of scaleId", () => {
    const dl = new DataLayer();
    dl.setCandles([{ time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 }]);
    dl.addSeries([{ time: 1, value: 100 }], { pane: "main", scaleId: "right" }, "line");
    dl.addSeries([{ time: 1, value: 50 }], { pane: "main", scaleId: "left" }, "line");

    expect(dl.getSeriesForPane("main")).toHaveLength(2);
  });
});

describe("Dual Scale — Range computation", () => {
  const pane: PaneRect = {
    id: "main",
    x: 0,
    y: 0,
    width: 800,
    height: 400,
    config: { id: "main", flex: 3 },
  };

  it("computes independent ranges for left/right scale series", () => {
    // Use a sub-pane (not "main") to avoid candle range mixing
    const subPane: PaneRect = {
      id: "sub_0",
      x: 0,
      y: 0,
      width: 800,
      height: 200,
      config: { id: "sub_0", flex: 1 },
    };

    const rightSeries = [
      {
        id: "s1",
        paneId: "sub_0",
        scaleId: "right" as const,
        type: "line",
        config: {},
        data: [
          { time: 1, value: 100 },
          { time: 2, value: 200 },
        ] as DataPoint<unknown>[],
        visible: true,
      },
    ];

    const leftSeries = [
      {
        id: "s2",
        paneId: "sub_0",
        scaleId: "left" as const,
        type: "line",
        config: {},
        data: [
          { time: 1, value: 20 },
          { time: 2, value: 80 },
        ] as DataPoint<unknown>[],
        visible: true,
      },
    ];

    const candles = [
      { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { time: 2, open: 105, high: 210, low: 95, close: 200, volume: 2000 },
    ];

    const [rMin, rMax] = computePaneRange(subPane, 0, 2, candles, rightSeries);
    const [lMin, lMax] = computePaneRange(subPane, 0, 2, candles, leftSeries);

    // Right scale: series range 100-200
    expect(rMin).toBeLessThanOrEqual(100);
    expect(rMax).toBeGreaterThanOrEqual(200);

    // Left scale: series range 20-80
    expect(lMin).toBeLessThanOrEqual(20);
    expect(lMax).toBeGreaterThanOrEqual(80);
    // Left series range should be smaller than right
    expect(lMax - lMin).toBeLessThan(rMax - rMin);
  });
});

describe("Dual Scale — PaneConfig.leftScale", () => {
  it("leftScale config defines mode and range for left axis", () => {
    const config = {
      id: "main",
      flex: 3,
      yScale: "linear" as const,
      yRange: undefined,
      leftScale: {
        mode: "linear" as const,
        range: [0, 100] as [number, number],
        referenceLines: [30, 70],
      },
    };

    const ps = new PriceScale();
    ps.setHeight(400);
    if (config.leftScale.range) ps.setFixedRange(config.leftScale.range);

    // Fixed range should clamp
    expect(ps.priceToY(0)).toBeGreaterThan(ps.priceToY(100));
    expect(config.leftScale.referenceLines).toEqual([30, 70]);
  });
});
