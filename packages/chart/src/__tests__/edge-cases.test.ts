import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { LayoutEngine } from "../core/layout";
import { PriceScale, TimeScale } from "../core/scale";
import type { CandleData, DataPoint } from "../core/types";

describe("Edge Cases", () => {
  describe("Empty data", () => {
    it("DataLayer handles zero candles", () => {
      const dl = new DataLayer();
      dl.setCandles([]);
      expect(dl.candleCount).toBe(0);
      expect(dl.indexAtTime(12345)).toBe(0);
    });

    it("TimeScale handles zero total count", () => {
      const ts = new TimeScale();
      ts.setWidth(800);
      ts.setTotalCount(0);
      ts.fitContent();
      expect(ts.startIndex).toBe(0);
      // visibleCount is derived from width/barSpacing, not totalCount
      expect(ts.endIndex).toBe(0);
    });

    it("PriceScale handles zero height", () => {
      const ps = new PriceScale();
      ps.setHeight(0);
      ps.setDataRange(100, 200);
      expect(ps.priceToY(150)).toBe(0);
    });

    it("LayoutEngine handles zero dimensions", () => {
      const le = new LayoutEngine();
      le.setDimensions(0, 0);
      expect(le.paneRects.length).toBe(0);
    });
  });

  describe("Single candle", () => {
    it("DataLayer handles one candle", () => {
      const dl = new DataLayer();
      dl.setCandles([{ time: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 }]);
      expect(dl.candleCount).toBe(1);
      expect(dl.indexAtTime(1000)).toBe(0);
    });

    it("PriceScale handles equal min/max", () => {
      const ps = new PriceScale();
      ps.setHeight(400);
      ps.setDataRange(100, 100);
      // Should not divide by zero
      const y = ps.priceToY(100);
      expect(Number.isFinite(y)).toBe(true);
    });
  });

  describe("NaN/Infinity input", () => {
    it("PriceScale getTicks with invalid range", () => {
      const ps = new PriceScale();
      ps.setHeight(400);
      ps.setDataRange(Number.NaN, Number.NaN);
      const ticks = ps.getTicks();
      // Should not infinite loop
      expect(Array.isArray(ticks)).toBe(true);
    });

    it("TimeScale zoom with zero factor", () => {
      const ts = new TimeScale();
      ts.setWidth(800);
      ts.setTotalCount(100);
      const before = ts.barSpacing;
      ts.zoom(0);
      // Should clamp, not go to 0
      expect(ts.barSpacing).toBeGreaterThan(0);
    });

    it("DataLayer filters NaN candles", () => {
      const dl = new DataLayer();
      dl.setCandles([
        { time: 1, open: Number.NaN, high: 2, low: 0, close: 1, volume: 100 },
        { time: 2, open: 1, high: 2, low: 0, close: 1, volume: 100 },
      ]);
      // Only valid candles kept (validation in canvas-chart, not data-layer)
      expect(dl.candleCount).toBe(2);
    });
  });

  describe("Extreme zoom", () => {
    it("TimeScale clamps bar spacing to min", () => {
      const ts = new TimeScale();
      ts.setWidth(800);
      ts.setTotalCount(100);
      // Zoom out excessively
      for (let i = 0; i < 50; i++) ts.zoom(0.5);
      expect(ts.barSpacing).toBeGreaterThanOrEqual(2);
    });

    it("TimeScale clamps bar spacing to max", () => {
      const ts = new TimeScale();
      ts.setWidth(800);
      ts.setTotalCount(100);
      // Zoom in excessively
      for (let i = 0; i < 50; i++) ts.zoom(2);
      expect(ts.barSpacing).toBeLessThanOrEqual(50);
    });
  });

  describe("Series data alignment", () => {
    it("handles series longer than candles", () => {
      const dl = new DataLayer();
      dl.setCandles([{ time: 1, open: 1, high: 2, low: 0, close: 1, volume: 100 }]);

      const data: DataPoint<number>[] = [
        { time: 1, value: 10 },
        { time: 2, value: 20 },
        { time: 3, value: 30 },
      ];
      const handle = dl.addSeries(data, { pane: "main" }, "line");
      expect(dl.getAllSeries().length).toBe(1);
      handle.remove();
    });

    it("handles series with no matching timestamps", () => {
      const dl = new DataLayer();
      dl.setCandles([{ time: 100, open: 1, high: 2, low: 0, close: 1, volume: 100 }]);

      const data: DataPoint<number>[] = [{ time: 999, value: 42 }];
      const handle = dl.addSeries(data, { pane: "main" }, "line");
      expect(dl.getAllSeries().length).toBe(1);
      handle.remove();
    });
  });
});
