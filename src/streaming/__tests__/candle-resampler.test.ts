import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../types";
import { createCandleResampler } from "../candle-resampler";

function candle(
  time: number,
  o: number,
  h: number,
  l: number,
  c: number,
  v = 100,
): NormalizedCandle {
  return { time, open: o, high: h, low: l, close: c, volume: v };
}

describe("createCandleResampler", () => {
  const TARGET = 300_000; // 5 minutes

  it("should return null for the first candle", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    const result = r.addCandle(candle(0, 100, 105, 95, 102, 50));
    expect(result).toBeNull();
  });

  it("should merge candles within the same higher-TF period", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    r.addCandle(candle(0, 100, 105, 95, 102, 50));
    r.addCandle(candle(60_000, 102, 110, 100, 108, 30));
    r.addCandle(candle(120_000, 108, 108, 90, 92, 20));

    const current = r.getCurrentCandle();
    expect(current).not.toBeNull();
    expect(current?.time).toBe(0);
    expect(current?.open).toBe(100);
    expect(current?.high).toBe(110);
    expect(current?.low).toBe(90);
    expect(current?.close).toBe(92);
    expect(current?.volume).toBe(100);
  });

  it("should complete a candle when a new period starts", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    r.addCandle(candle(0, 100, 110, 90, 105, 50));
    r.addCandle(candle(60_000, 105, 115, 100, 112, 30));

    // Candle in next 5-min period
    const completed = r.addCandle(candle(300_000, 112, 120, 110, 118, 40));
    expect(completed).not.toBeNull();
    expect(completed?.time).toBe(0);
    expect(completed?.open).toBe(100);
    expect(completed?.high).toBe(115);
    expect(completed?.low).toBe(90);
    expect(completed?.close).toBe(112);
    expect(completed?.volume).toBe(80);

    // Current candle is the new period
    const current = r.getCurrentCandle();
    expect(current?.time).toBe(300_000);
    expect(current?.open).toBe(112);
  });

  it("should handle single-candle periods", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    r.addCandle(candle(0, 100, 110, 90, 105, 50));
    const completed = r.addCandle(candle(300_000, 105, 115, 95, 110, 60));

    expect(completed).not.toBeNull();
    expect(completed?.time).toBe(0);
    expect(completed?.open).toBe(100);
    expect(completed?.high).toBe(110);
    expect(completed?.low).toBe(90);
    expect(completed?.close).toBe(105);
    expect(completed?.volume).toBe(50);
  });

  it("should flush the current candle", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    r.addCandle(candle(0, 100, 110, 90, 105, 50));
    r.addCandle(candle(60_000, 105, 115, 100, 112, 30));

    const flushed = r.flush();
    expect(flushed).not.toBeNull();
    expect(flushed?.open).toBe(100);
    expect(flushed?.high).toBe(115);
    expect(flushed?.low).toBe(90);
    expect(flushed?.close).toBe(112);
    expect(flushed?.volume).toBe(80);

    expect(r.getCurrentCandle()).toBeNull();
    expect(r.flush()).toBeNull();
  });

  it("should return null from flush/getCurrentCandle when no data", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    expect(r.flush()).toBeNull();
    expect(r.getCurrentCandle()).toBeNull();
  });

  describe("state persistence", () => {
    it("should serialize and restore state", () => {
      const r1 = createCandleResampler({ targetIntervalMs: TARGET });
      r1.addCandle(candle(0, 100, 110, 90, 105, 50));
      r1.addCandle(candle(60_000, 105, 115, 100, 112, 30));

      const state = JSON.parse(JSON.stringify(r1.getState()));
      const r2 = createCandleResampler({ targetIntervalMs: TARGET }, state);

      // Add another candle in same period
      r2.addCandle(candle(120_000, 112, 120, 108, 118, 20));

      const current = r2.getCurrentCandle();
      expect(current?.open).toBe(100);
      expect(current?.high).toBe(120);
      expect(current?.low).toBe(90);
      expect(current?.close).toBe(118);
      expect(current?.volume).toBe(100);
    });

    it("should produce identical candle after state restore + new period", () => {
      const r1 = createCandleResampler({ targetIntervalMs: TARGET });
      r1.addCandle(candle(0, 100, 110, 90, 105, 50));

      const state = JSON.parse(JSON.stringify(r1.getState()));
      const r2 = createCandleResampler({ targetIntervalMs: TARGET }, state);

      const c1 = r1.addCandle(candle(300_000, 108, 120, 100, 115, 60));
      const c2 = r2.addCandle(candle(300_000, 108, 120, 100, 115, 60));
      expect(c1).toEqual(c2);
    });
  });

  it("should throw on non-positive targetIntervalMs", () => {
    expect(() => createCandleResampler({ targetIntervalMs: 0 })).toThrow();
    expect(() => createCandleResampler({ targetIntervalMs: -1 })).toThrow();
  });

  it("should resample 1m → 5m correctly with realistic data", () => {
    const r = createCandleResampler({ targetIntervalMs: TARGET });
    const completed: NormalizedCandle[] = [];

    // 15 one-minute candles → should produce 2 completed 5-min candles + 1 partial
    for (let i = 0; i < 15; i++) {
      const t = i * 60_000;
      const base = 100 + i;
      const result = r.addCandle(candle(t, base, base + 2, base - 1, base + 1, 10));
      if (result) completed.push(result);
    }

    // First 5 candles (0-4min) → completed at 5min mark
    // Next 5 candles (5-9min) → completed at 10min mark
    // Last 5 candles (10-14min) → still in progress
    expect(completed).toHaveLength(2);
    expect(completed[0].time).toBe(0);
    expect(completed[0].open).toBe(100);
    expect(completed[0].close).toBe(105); // close of 4th minute candle
    expect(completed[1].time).toBe(300_000);
    expect(completed[1].open).toBe(105);
    expect(completed[1].close).toBe(110); // close of 9th minute candle

    const partial = r.getCurrentCandle();
    expect(partial?.time).toBe(600_000);
    expect(partial?.open).toBe(110);
  });
});
