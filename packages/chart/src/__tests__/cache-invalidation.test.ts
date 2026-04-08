/**
 * Cache Invalidation Tests
 *
 * Verifies that render caches correctly invalidate when data changes
 * in-place (live feed updates), and that empty-then-stream patterns work.
 */

import { describe, expect, it } from "vitest";
import { DataLayer } from "../core/data-layer";
import { decimateCandles, getDecimationTarget } from "../core/decimation";
import { defaultRegistry } from "../core/series-registry";
import type { CandleData, DataPoint } from "../core/types";

function makeCandle(time: number, close: number): CandleData {
  return { time, open: close - 1, high: close + 1, low: close - 2, close, volume: 1000 };
}

describe("Cache invalidation", () => {
  // -----------------------------------------------------------
  // P1: DataLayer.version increments on every mutation
  // -----------------------------------------------------------

  describe("DataLayer.version", () => {
    it("increments on setCandles", () => {
      const dl = new DataLayer();
      const v0 = dl.version;
      dl.setCandles([makeCandle(1, 100)]);
      expect(dl.version).toBe(v0 + 1);
    });

    it("increments on updateCandle (in-place)", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100)]);
      const v1 = dl.version;

      // In-place update (same time, different close) — array length unchanged
      dl.updateCandle(makeCandle(1, 105));
      expect(dl.version).toBe(v1 + 1);
      expect(dl.candleCount).toBe(1); // Length did NOT change
    });

    it("increments on updateCandle (append)", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100)]);
      const v1 = dl.version;

      dl.updateCandle(makeCandle(2, 110));
      expect(dl.version).toBe(v1 + 1);
      expect(dl.candleCount).toBe(2);
    });
  });

  // -----------------------------------------------------------
  // P1: Series rule re-detection for empty-then-stream pattern
  // -----------------------------------------------------------

  describe("Series rule re-detection", () => {
    it("detects rule when streaming into initially empty series", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100), makeCandle(2, 101)]);

      // Add series with empty data — _rule should be null
      const handle = dl.addSeries([], { label: "SMA" }, "line");
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id);
      expect(series).toBeDefined();
      expect(series!._rule).toBeNull();

      // Stream a numeric value — _rule should now be detected
      handle.update({ time: 1, value: 99.5 });
      expect(series!._rule).not.toBeNull();
      expect(series!._rule!.name).toBe("number");
    });

    it("detects rule for compound types when streaming", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100)]);

      const handle = dl.addSeries([], { label: "BB" }, "band");
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id);
      expect(series!._rule).toBeNull();

      handle.update({ time: 1, value: { upper: 110, middle: 100, lower: 90 } });
      expect(series!._rule).not.toBeNull();
      expect(series!._rule!.name).toBe("band");
    });

    it("preserves rule on further updates (no unnecessary re-detection)", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100), makeCandle(2, 101)]);

      const handle = dl.addSeries(
        [{ time: 1, value: 99 }] as DataPoint<number>[],
        { label: "RSI" },
        "line",
      );
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id);
      const ruleRef = series!._rule;
      expect(ruleRef).not.toBeNull();

      // Subsequent update should NOT change the rule reference
      handle.update({ time: 2, value: 100 });
      expect(series!._rule).toBe(ruleRef);
    });
  });

  // -----------------------------------------------------------
  // P2: _dataVersion increments on series mutations
  // -----------------------------------------------------------

  describe("Series _dataVersion", () => {
    it("increments on handle.update()", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100), makeCandle(2, 101)]);

      const handle = dl.addSeries(
        [{ time: 1, value: 50 }] as DataPoint<number>[],
        { label: "test" },
        "line",
      );
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;
      const v0 = series._dataVersion ?? 0;

      // In-place update (same time)
      handle.update({ time: 1, value: 55 });
      expect(series._dataVersion).toBe(v0 + 1);

      // Append
      handle.update({ time: 2, value: 60 });
      expect(series._dataVersion).toBe(v0 + 2);
    });

    it("increments on handle.setData()", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100)]);

      const handle = dl.addSeries(
        [{ time: 1, value: 50 }] as DataPoint<number>[],
        { label: "test" },
        "line",
      );
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;
      const v0 = series._dataVersion ?? 0;

      handle.setData([{ time: 1, value: 99 }]);
      expect(series._dataVersion).toBe(v0 + 1);
    });

    it("clears _channels on update (forces decomposeAll recomputation)", () => {
      const dl = new DataLayer();
      dl.setCandles([makeCandle(1, 100)]);

      const data: DataPoint<{ upper: number; middle: number; lower: number }>[] = [
        { time: 1, value: { upper: 110, middle: 100, lower: 90 } },
      ];
      const handle = dl.addSeries(data, { label: "BB" }, "band");
      const series = dl.getVisibleSeries().find((s) => s.id === handle.id)!;

      // Simulate what renderer does: populate _channels cache
      const rule = series._rule!;
      series._channels = defaultRegistry.decomposeAll(series.data, rule);
      series._channelsLen = series.data.length;
      expect(series._channels).toBeDefined();

      // In-place update should clear the cache
      handle.update({ time: 1, value: { upper: 115, middle: 105, lower: 95 } });
      expect(series._channels).toBeUndefined();
    });
  });

  // -----------------------------------------------------------
  // Decimation cache: version-aware invalidation
  // -----------------------------------------------------------

  describe("Candle decimation version awareness", () => {
    it("decimateCandles returns different results for different close prices", () => {
      const candles1: CandleData[] = [];
      const candles2: CandleData[] = [];
      for (let i = 0; i < 100; i++) {
        candles1.push(makeCandle(i, 100 + i));
        candles2.push(makeCandle(i, 200 + i)); // Different prices
      }

      const result1 = decimateCandles(candles1, 0, 100, 10);
      const result2 = decimateCandles(candles2, 0, 100, 10);

      // Same structure but different values
      expect(result1.length).toBe(result2.length);
      expect(result1[0].close).not.toBe(result2[0].close);
    });

    it("getDecimationTarget returns 0 when data fits", () => {
      expect(getDecimationTarget(100, 200)).toBe(0); // 100 points in 200px = no decimation
    });

    it("getDecimationTarget returns target when too dense", () => {
      const target = getDecimationTarget(10000, 1000);
      expect(target).toBe(1000); // 10000 points in 1000px → decimate to 1000
    });
  });
});
