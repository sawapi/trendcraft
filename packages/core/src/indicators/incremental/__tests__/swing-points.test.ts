/**
 * Parity tests for incremental Swing Points vs the batch swingPoints().
 *
 * Batch emits one entry per candle at candle.time; incremental emits at
 * mid-bar time with `rightBars` delay. We reconcile by grouping emissions
 * by time and comparing the set of confirmed swing highs/lows.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { swingPoints } from "../../price/swing-points";
import { createSwingPoints } from "../price/swing-points";

function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS_PER_DAY = 86400000;
  const baseTime = new Date("2020-01-01").getTime();
  let price = 100;
  let seed = 123;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const change = (random() - 0.5) * 6;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + random() * 0.02);
    const low = Math.min(open, close) * (1 - random() * 0.02);
    candles.push({
      time: baseTime + i * MS_PER_DAY,
      open,
      high,
      low,
      close,
      volume: 1000,
    });
    price = close;
  }
  return candles;
}

describe("createSwingPoints", () => {
  const candles = generateCandles(200);

  it("emits the same confirmed swing highs / lows as batch", () => {
    const leftBars = 3;
    const rightBars = 3;
    const batch = swingPoints(candles, { leftBars, rightBars });
    const batchHighs = new Set<number>();
    const batchLows = new Set<number>();
    for (const r of batch) {
      if (r.value.isSwingHigh) batchHighs.add(r.time);
      if (r.value.isSwingLow) batchLows.add(r.time);
    }
    expect(batchHighs.size).toBeGreaterThan(0);
    expect(batchLows.size).toBeGreaterThan(0);

    const ind = createSwingPoints({ leftBars, rightBars });
    const liveHighs = new Set<number>();
    const liveLows = new Set<number>();
    for (const c of candles) {
      const r = ind.next(c);
      if (r.value.isSwingHigh) liveHighs.add(r.time);
      if (r.value.isSwingLow) liveLows.add(r.time);
    }

    expect([...liveHighs].sort()).toEqual([...batchHighs].sort());
    expect([...liveLows].sort()).toEqual([...batchLows].sort());
  });

  it("tracks trailing swingHighPrice/swingLowPrice", () => {
    const ind = createSwingPoints({ leftBars: 2, rightBars: 2 });
    let sawHigh = false;
    let sawLow = false;
    for (const c of candles.slice(0, 100)) {
      const { value } = ind.next(c);
      if (value.isSwingHigh) sawHigh = true;
      if (value.isSwingLow) sawLow = true;
      if (sawHigh) expect(value.swingHighPrice).not.toBeNull();
      if (sawLow) expect(value.swingLowPrice).not.toBeNull();
    }
  });

  it("restores from state without drift", () => {
    const a = createSwingPoints({ leftBars: 3, rightBars: 3 });
    for (let i = 0; i < 80; i++) a.next(candles[i]);
    const b = createSwingPoints({ leftBars: 3, rightBars: 3 }, { fromState: a.getState() });
    for (let i = 80; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.isSwingHigh).toBe(va.isSwingHigh);
      expect(vb.isSwingLow).toBe(va.isSwingLow);
      expect(vb.swingHighPrice).toBe(va.swingHighPrice);
      expect(vb.swingLowPrice).toBe(va.swingLowPrice);
    }
  });

  it("peek does not mutate state", () => {
    const ind = createSwingPoints({ leftBars: 3, rightBars: 3 });
    for (let i = 0; i < 50; i++) ind.next(candles[i]);
    const before = JSON.stringify(ind.getState());
    ind.peek(candles[50]);
    expect(JSON.stringify(ind.getState())).toBe(before);
  });

  it("returns null value during warm-up", () => {
    const ind = createSwingPoints({ leftBars: 5, rightBars: 5 });
    for (let i = 0; i < 10; i++) {
      const { value } = ind.next(candles[i]);
      expect(value.isSwingHigh).toBe(false);
      expect(value.isSwingLow).toBe(false);
    }
    expect(ind.isWarmedUp).toBe(false);
    ind.next(candles[10]);
    expect(ind.isWarmedUp).toBe(true);
  });

  it("throws on invalid bars", () => {
    expect(() => createSwingPoints({ leftBars: 0, rightBars: 3 })).toThrow();
    expect(() => createSwingPoints({ leftBars: 3, rightBars: 0 })).toThrow();
  });
});
