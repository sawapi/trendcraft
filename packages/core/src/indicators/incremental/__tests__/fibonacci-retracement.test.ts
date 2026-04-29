/**
 * Parity tests for incremental Fibonacci Retracement vs batch.
 *
 * Batch `fibonacciRetracement` uses look-ahead (it consults
 * `swings[i].isSwingHigh`, which itself peeks `rightBars` bars into the
 * future), so live cannot match batch bar-by-bar. Tests verify:
 *  - Shifted parity: `live.next(c_t).value` matches `batch[t - rightBars]`
 *    once both sides have processed enough warm-up.
 *  - Snapshot resume drift-free.
 *  - peek() does not mutate state.
 *  - Option validation throws.
 *  - Warm-up via WarmUpOptions matches a fresh instance.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { fibonacciRetracement } from "../../price/fibonacci-retracement";
import { createFibonacciRetracement } from "../price/fibonacci-retracement";

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

describe("createFibonacciRetracement", () => {
  const leftBars = 5;
  const rightBars = 5;
  const candles = generateCandles(400);

  it("matches batch with rightBars shift once both have swings", () => {
    const batch = fibonacciRetracement(candles, { leftBars, rightBars });
    const live = createFibonacciRetracement({ leftBars, rightBars });
    let comparedNonNull = 0;
    for (let t = 0; t < candles.length; t++) {
      const liveVal = live.next(candles[t]).value;
      const batchIdx = t - rightBars;
      if (batchIdx < 0) continue;
      const batchVal = batch[batchIdx].value;
      // Both sides should agree on tracked swings at this aligned point.
      expect(liveVal.swingHigh).toBe(batchVal.swingHigh);
      expect(liveVal.swingLow).toBe(batchVal.swingLow);
      expect(liveVal.trend).toBe(batchVal.trend);
      if (liveVal.levels !== null && batchVal.levels !== null) {
        expect(liveVal.levels).toEqual(batchVal.levels);
        comparedNonNull++;
      } else {
        expect(liveVal.levels).toBe(batchVal.levels);
      }
    }
    // Sanity: across 400 random candles with leftBars=rightBars=5, plenty of
    // bars should have produced both swings.
    expect(comparedNonNull).toBeGreaterThan(50);
  });

  it("produces non-null levels eventually", () => {
    const live = createFibonacciRetracement({ leftBars, rightBars });
    let sawLevels = false;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.levels !== null) {
        sawLevels = true;
        // Default 7 ratios.
        expect(Object.keys(value.levels)).toHaveLength(7);
        break;
      }
    }
    expect(sawLevels).toBe(true);
  });

  it("restores from snapshot without drift", () => {
    const a = createFibonacciRetracement({ leftBars, rightBars });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createFibonacciRetracement({ leftBars, rightBars }, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.swingHigh).toBe(va.swingHigh);
      expect(vb.swingLow).toBe(va.swingLow);
      expect(vb.trend).toBe(va.trend);
      expect(vb.levels).toEqual(va.levels);
    }
  });

  it("peek does not mutate state", () => {
    const live = createFibonacciRetracement({ leftBars, rightBars });
    for (let i = 0; i < 50; i++) live.next(candles[i]);
    const before = JSON.stringify(live.getState());
    live.peek(candles[50]);
    expect(JSON.stringify(live.getState())).toBe(before);
  });

  it("throws on invalid options", () => {
    expect(() => createFibonacciRetracement({ leftBars: 0 })).toThrow();
    expect(() => createFibonacciRetracement({ rightBars: 0 })).toThrow();
    expect(() => createFibonacciRetracement({ levels: [] })).toThrow();
  });

  it("warms up via WarmUpOptions.warmUp", () => {
    const warmUp = candles.slice(0, 50);
    const live = createFibonacciRetracement({ leftBars, rightBars }, { warmUp });
    expect(live.count).toBe(50);
    const ref = createFibonacciRetracement({ leftBars, rightBars });
    for (const c of warmUp) ref.next(c);
    expect(JSON.stringify(live.getState())).toBe(JSON.stringify(ref.getState()));
  });

  it("preserves custom config when restored without re-passing options", () => {
    const customLevels = [0, 0.5, 1];
    const customLeft = 7;
    const customRight = 4;
    const a = createFibonacciRetracement({
      leftBars: customLeft,
      rightBars: customRight,
      levels: customLevels,
    });
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    // Resume with ONLY the snapshot — no options re-passed. Custom config
    // must come from state.
    const b = createFibonacciRetracement(undefined, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.swingHigh).toBe(va.swingHigh);
      expect(vb.swingLow).toBe(va.swingLow);
      expect(vb.trend).toBe(va.trend);
      expect(vb.levels).toEqual(va.levels);
      if (vb.levels !== null) {
        expect(Object.keys(vb.levels).sort()).toEqual(["0", "0.5", "1"]);
      }
    }
    const stateB = b.getState();
    expect(stateB.leftBars).toBe(customLeft);
    expect(stateB.rightBars).toBe(customRight);
    expect(stateB.levels).toEqual(customLevels);
  });

  it("respects custom levels", () => {
    const customLevels = [0, 0.5, 1];
    const live = createFibonacciRetracement({
      leftBars,
      rightBars,
      levels: customLevels,
    });
    let sawLevels: Record<string, number> | null = null;
    for (const c of candles) {
      const { value } = live.next(c);
      if (value.levels !== null) {
        sawLevels = value.levels;
        break;
      }
    }
    expect(sawLevels).not.toBeNull();
    expect(Object.keys(sawLevels ?? {}).sort()).toEqual(["0", "0.5", "1"]);
  });
});
