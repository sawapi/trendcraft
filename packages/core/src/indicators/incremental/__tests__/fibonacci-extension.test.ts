/**
 * Parity tests for incremental Fibonacci Extension vs batch.
 *
 * Same shifted-parity property as Fib Retracement: batch uses look-ahead via
 * batch `swingPoints`, live confirms swings with `rightBars` delay, so
 * `live.next(c_t).value` matches `batch[t - rightBars].value` once both sides
 * have warmed up.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { fibonacciExtension } from "../../price/fibonacci-extension";
import { createFibonacciExtension } from "../price/fibonacci-extension";

function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS = 86400000;
  const base = new Date("2020-01-01").getTime();
  let price = 100;
  let s = 31;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const change = (r() - 0.5) * 5;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + r() * 0.015);
    const low = Math.min(open, close) * (1 - r() * 0.015);
    candles.push({ time: base + i * MS, open, high, low, close, volume: 1000 });
    price = close;
  }
  return candles;
}

describe("createFibonacciExtension", () => {
  const leftBars = 5;
  const rightBars = 5;
  const candles = generateCandles(400);

  it("matches batch with rightBars shift once both have a pattern", () => {
    const batch = fibonacciExtension(candles, { leftBars, rightBars });
    const live = createFibonacciExtension({ leftBars, rightBars });
    let comparedNonNull = 0;
    for (let t = 0; t < candles.length; t++) {
      const liveVal = live.next(candles[t]).value;
      const batchIdx = t - rightBars;
      if (batchIdx < 0) continue;
      const batchVal = batch[batchIdx].value;
      expect(liveVal.pointA).toBe(batchVal.pointA);
      expect(liveVal.pointB).toBe(batchVal.pointB);
      expect(liveVal.pointC).toBe(batchVal.pointC);
      expect(liveVal.direction).toBe(batchVal.direction);
      if (liveVal.levels !== null && batchVal.levels !== null) {
        expect(liveVal.levels).toEqual(batchVal.levels);
        comparedNonNull++;
      } else {
        expect(liveVal.levels).toBe(batchVal.levels);
      }
    }
    expect(comparedNonNull).toBeGreaterThan(50);
  });

  it("eventually produces a non-null A→B→C pattern", () => {
    const live = createFibonacciExtension({ leftBars, rightBars });
    let sawPattern = false;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.levels !== null) {
        sawPattern = true;
        expect(Object.keys(value.levels)).toHaveLength(7);
        expect(value.direction === "bullish" || value.direction === "bearish").toBe(true);
        break;
      }
    }
    expect(sawPattern).toBe(true);
  });

  it("restores from snapshot without drift", () => {
    const a = createFibonacciExtension({ leftBars, rightBars });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createFibonacciExtension({ leftBars, rightBars }, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.direction).toBe(va.direction);
      expect(vb.pointA).toBe(va.pointA);
      expect(vb.pointB).toBe(va.pointB);
      expect(vb.pointC).toBe(va.pointC);
      expect(vb.levels).toEqual(va.levels);
    }
  });

  it("preserves custom config when restored without re-passing options", () => {
    const customLevels = [0, 1, 1.5, 2];
    const customLeft = 7;
    const customRight = 4;
    const a = createFibonacciExtension({
      leftBars: customLeft,
      rightBars: customRight,
      levels: customLevels,
    });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createFibonacciExtension(undefined, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.direction).toBe(va.direction);
      expect(vb.pointA).toBe(va.pointA);
      expect(vb.pointB).toBe(va.pointB);
      expect(vb.pointC).toBe(va.pointC);
      expect(vb.levels).toEqual(va.levels);
      if (vb.levels !== null) {
        expect(Object.keys(vb.levels).sort()).toEqual(["0", "1", "1.5", "2"]);
      }
    }
    const stateB = b.getState();
    expect(stateB.leftBars).toBe(customLeft);
    expect(stateB.rightBars).toBe(customRight);
    expect(stateB.levels).toEqual(customLevels);
  });

  it("peek does not mutate state", () => {
    const live = createFibonacciExtension({ leftBars, rightBars });
    for (let i = 0; i < 80; i++) live.next(candles[i]);
    const before = JSON.stringify(live.getState());
    live.peek(candles[80]);
    expect(JSON.stringify(live.getState())).toBe(before);
  });

  it("throws on invalid options", () => {
    expect(() => createFibonacciExtension({ leftBars: 0 })).toThrow();
    expect(() => createFibonacciExtension({ rightBars: 0 })).toThrow();
    expect(() => createFibonacciExtension({ levels: [] })).toThrow();
  });

  it("warms up via WarmUpOptions.warmUp", () => {
    const warmUp = candles.slice(0, 80);
    const live = createFibonacciExtension({ leftBars, rightBars }, { warmUp });
    expect(live.count).toBe(80);
    const ref = createFibonacciExtension({ leftBars, rightBars });
    for (const c of warmUp) ref.next(c);
    expect(JSON.stringify(live.getState())).toBe(JSON.stringify(ref.getState()));
  });

  it("respects custom levels", () => {
    const customLevels = [0, 1, 2];
    const live = createFibonacciExtension({ leftBars, rightBars, levels: customLevels });
    let saw: Record<string, number> | null = null;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.levels !== null) {
        saw = value.levels;
        break;
      }
    }
    expect(saw).not.toBeNull();
    expect(Object.keys(saw ?? {}).sort()).toEqual(["0", "1", "2"]);
  });
});
