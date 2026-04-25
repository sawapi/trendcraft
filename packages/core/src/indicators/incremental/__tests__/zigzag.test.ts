/**
 * Parity tests for incremental Zigzag vs batch zigzag().
 *
 * Both should confirm the same set of pivot points (same bar times, same
 * direction). Pivot detection in zigzag is deterministic and causal, so the
 * incremental version should produce byte-identical pivot sets.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { zigzag } from "../../price/zigzag";
import { createZigzag } from "../price/zigzag";

function generateCandles(count: number, seed = 7): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS = 86400000;
  const base = new Date("2020-01-01").getTime();
  let price = 100;
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const change = (r() - 0.5) * 6;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + r() * 0.02);
    const low = Math.min(open, close) * (1 - r() * 0.02);
    candles.push({ time: base + i * MS, open, high, low, close, volume: 1000 });
    price = close;
  }
  return candles;
}

type Pivot = { time: number; point: "high" | "low"; price: number };

function pivotsFromSeries(
  series: Array<{ time: number; value: { point: "high" | "low" | null; price: number | null } }>,
): Pivot[] {
  const out: Pivot[] = [];
  for (const r of series) {
    if (r.value.point !== null && r.value.price !== null) {
      out.push({ time: r.time, point: r.value.point, price: r.value.price });
    }
  }
  return out;
}

/**
 * Collapse streamed pivots the same way batch does: when multiple pivots
 * land on the same bar time (a bar that is both the prior trend's extreme
 * and the new trend's seed), batch overwrites `result[i]` so the last-confirmed
 * direction wins. Apply that rule here to reconstruct batch-equivalent output.
 */
function collapseByTimeLastWins(pivots: Pivot[]): Pivot[] {
  const byTime = new Map<number, Pivot>();
  for (const p of pivots) byTime.set(p.time, p);
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

describe("createZigzag", () => {
  const candles = generateCandles(300);

  it("matches batch pivots for percent-deviation mode (same last-write-wins semantics)", () => {
    const batch = pivotsFromSeries(zigzag(candles, { deviation: 3 }));
    const live = createZigzag({ deviation: 3 });
    const liveOut: Array<{
      time: number;
      value: { point: "high" | "low" | null; price: number | null };
    }> = [];
    for (const c of candles) liveOut.push(live.next(c));
    const livePivots = collapseByTimeLastWins(pivotsFromSeries(liveOut));

    expect(livePivots.length).toBeGreaterThan(0);
    expect(livePivots.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(livePivots[i].time).toBe(batch[i].time);
      expect(livePivots[i].point).toBe(batch[i].point);
      expect(livePivots[i].price).toBeCloseTo(batch[i].price, 10);
    }
  });

  it("matches batch pivots for ATR mode", () => {
    const opts = { useAtr: true, atrPeriod: 14, atrMultiplier: 2 };
    const batch = pivotsFromSeries(zigzag(candles, opts));
    const live = createZigzag(opts);
    const liveOut: Array<{
      time: number;
      value: { point: "high" | "low" | null; price: number | null };
    }> = [];
    for (const c of candles) liveOut.push(live.next(c));
    const livePivots = collapseByTimeLastWins(pivotsFromSeries(liveOut));

    expect(livePivots.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(livePivots[i].time).toBe(batch[i].time);
      expect(livePivots[i].point).toBe(batch[i].point);
      expect(livePivots[i].price).toBeCloseTo(batch[i].price, 10);
    }
  });

  it("restores from snapshot and continues consistently", () => {
    const a = createZigzag({ deviation: 3 });
    for (let i = 0; i < 120; i++) a.next(candles[i]);
    const b = createZigzag({ deviation: 3 }, { fromState: a.getState() });
    for (let i = 120; i < 200; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.point).toBe(va.point);
      if (va.price !== null) {
        expect(vb.price).toBeCloseTo(va.price, 10);
      }
    }
  });

  it("peek does not mutate state", () => {
    const z = createZigzag({ deviation: 3 });
    for (let i = 0; i < 50; i++) z.next(candles[i]);
    const before = JSON.stringify(z.getState());
    z.peek(candles[50]);
    expect(JSON.stringify(z.getState())).toBe(before);
  });

  it("throws on invalid deviation", () => {
    expect(() => createZigzag({ deviation: 0 })).toThrow();
    expect(() => createZigzag({ deviation: -1 })).toThrow();
  });
});
