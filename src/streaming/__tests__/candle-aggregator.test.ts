import { describe, expect, it } from "vitest";
import { createCandleAggregator } from "../candle-aggregator";
import type { Trade } from "../types";

function trade(time: number, price: number, volume = 1): Trade {
  return { time, price, volume };
}

describe("createCandleAggregator", () => {
  const INTERVAL = 60_000; // 1 minute

  it("should return null for the first trade (no completed candle yet)", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    const result = agg.addTrade(trade(0, 100));
    expect(result).toBeNull();
  });

  it("should accumulate trades within the same interval", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    agg.addTrade(trade(0, 100, 10));
    agg.addTrade(trade(10_000, 105, 5));
    agg.addTrade(trade(20_000, 95, 3));
    agg.addTrade(trade(30_000, 102, 8));

    const current = agg.getCurrentCandle();
    expect(current).not.toBeNull();
    expect(current?.open).toBe(100);
    expect(current?.high).toBe(105);
    expect(current?.low).toBe(95);
    expect(current?.close).toBe(102);
    expect(current?.volume).toBe(26);
    expect(current?.time).toBe(0);
  });

  it("should complete a candle when a trade arrives in a new period", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    agg.addTrade(trade(0, 100, 10));
    agg.addTrade(trade(30_000, 110, 5));

    // Trade in the next minute triggers completion
    const completed = agg.addTrade(trade(60_000, 108, 3));
    expect(completed).not.toBeNull();
    expect(completed?.time).toBe(0);
    expect(completed?.open).toBe(100);
    expect(completed?.high).toBe(110);
    expect(completed?.low).toBe(100);
    expect(completed?.close).toBe(110);
    expect(completed?.volume).toBe(15);

    // Current candle is the new period
    const current = agg.getCurrentCandle();
    expect(current?.time).toBe(60_000);
    expect(current?.open).toBe(108);
    expect(current?.close).toBe(108);
    expect(current?.volume).toBe(3);
  });

  it("should handle multiple period rollovers", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    agg.addTrade(trade(0, 100));

    const c1 = agg.addTrade(trade(60_000, 200));
    expect(c1).not.toBeNull();
    expect(c1?.close).toBe(100);

    const c2 = agg.addTrade(trade(120_000, 300));
    expect(c2).not.toBeNull();
    expect(c2?.close).toBe(200);

    const c3 = agg.addTrade(trade(180_000, 400));
    expect(c3).not.toBeNull();
    expect(c3?.close).toBe(300);
  });

  it("should flush the current candle", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    agg.addTrade(trade(0, 100, 10));
    agg.addTrade(trade(30_000, 110, 5));

    const flushed = agg.flush();
    expect(flushed).not.toBeNull();
    expect(flushed?.open).toBe(100);
    expect(flushed?.high).toBe(110);
    expect(flushed?.close).toBe(110);
    expect(flushed?.volume).toBe(15);

    // After flush, no current candle
    expect(agg.getCurrentCandle()).toBeNull();
    expect(agg.flush()).toBeNull();
  });

  it("should return null from flush when no data", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    expect(agg.flush()).toBeNull();
  });

  it("should return null from getCurrentCandle when no data", () => {
    const agg = createCandleAggregator({ intervalMs: INTERVAL });
    expect(agg.getCurrentCandle()).toBeNull();
  });

  it("should align periods to interval boundaries", () => {
    const agg = createCandleAggregator({ intervalMs: 300_000 }); // 5 minutes
    // Trade at 2:03 → period start = 2:00 (120_000)
    agg.addTrade(trade(123_000, 100));
    const current = agg.getCurrentCandle();
    expect(current?.time).toBe(0); // floor(123_000 / 300_000) * 300_000 = 0
  });

  it("should align 5-min period correctly", () => {
    const base = 300_000; // 5 min
    const agg = createCandleAggregator({ intervalMs: base });
    // Trade at 7m30s → period = 5m
    agg.addTrade(trade(450_000, 100));
    const current = agg.getCurrentCandle();
    expect(current?.time).toBe(300_000);
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const agg1 = createCandleAggregator({ intervalMs: INTERVAL });
      agg1.addTrade(trade(0, 100, 10));
      agg1.addTrade(trade(30_000, 110, 5));

      const state = agg1.getState();
      const json = JSON.parse(JSON.stringify(state));

      const agg2 = createCandleAggregator({ intervalMs: INTERVAL }, json);
      // Continue adding trades in the same period
      agg2.addTrade(trade(45_000, 90, 3));

      const current = agg2.getCurrentCandle();
      expect(current?.open).toBe(100);
      expect(current?.high).toBe(110);
      expect(current?.low).toBe(90);
      expect(current?.close).toBe(90);
      expect(current?.volume).toBe(18);
    });

    it("should produce identical candle after state restore + new period", () => {
      const agg1 = createCandleAggregator({ intervalMs: INTERVAL });
      agg1.addTrade(trade(0, 100, 10));
      agg1.addTrade(trade(30_000, 110, 5));

      const state = JSON.parse(JSON.stringify(agg1.getState()));
      const agg2 = createCandleAggregator({ intervalMs: INTERVAL }, state);

      // Complete the period
      const c1 = agg1.addTrade(trade(60_000, 120, 2));
      const c2 = agg2.addTrade(trade(60_000, 120, 2));
      expect(c1).toEqual(c2);
    });
  });

  it("should throw on non-positive intervalMs", () => {
    expect(() => createCandleAggregator({ intervalMs: 0 })).toThrow();
    expect(() => createCandleAggregator({ intervalMs: -1 })).toThrow();
  });
});
