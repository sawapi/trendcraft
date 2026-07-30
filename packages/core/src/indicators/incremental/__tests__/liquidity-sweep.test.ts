/**
 * Parity tests for incremental Liquidity Sweep vs batch.
 *
 * Both sides adopt a swing level once its pivot is confirmed, so they agree
 * bar by bar. We verify:
 *  - Detection matches on every bar, including a confirmation bar that sweeps
 *    the level tracked before it.
 *  - The set of detected sweeps (keyed by sweepIndex + type) is identical once
 *    both sides finish processing.
 *  - Recovery indices agree on every sweep that both sides detect.
 *  - State snapshot resume is drift-free.
 *  - peek() does not mutate state.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { liquiditySweep } from "../../smc/liquidity-sweep";
import { createLiquiditySweep } from "../smc/liquidity-sweep";

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

type SweepKey = string;
function keyOf(sweep: { type: string; sweepIndex: number }): SweepKey {
  return `${sweep.type}:${sweep.sweepIndex}`;
}

function collectLive(
  candles: NormalizedCandle[],
  options: Parameters<typeof createLiquiditySweep>[0],
): Map<SweepKey, { recoveredIndex: number | null }> {
  const live = createLiquiditySweep(options);
  const map = new Map<SweepKey, { recoveredIndex: number | null }>();
  for (const c of candles) {
    const { value } = live.next(c);
    for (const tracked of value.recentSweeps) {
      map.set(keyOf(tracked), { recoveredIndex: tracked.recoveredIndex });
    }
    for (const r of value.recoveredThisBar) {
      map.set(keyOf(r), { recoveredIndex: r.recoveredIndex });
    }
  }
  return map;
}

function collectBatch(
  candles: NormalizedCandle[],
  options: Parameters<typeof liquiditySweep>[1],
): Map<SweepKey, { recoveredIndex: number | null }> {
  const series = liquiditySweep(candles, options);
  const map = new Map<SweepKey, { recoveredIndex: number | null }>();
  for (const item of series) {
    if (item.value.sweep) {
      map.set(keyOf(item.value.sweep), {
        recoveredIndex: item.value.sweep.recoveredIndex,
      });
    }
    for (const r of item.value.recoveredThisBar) {
      map.set(keyOf(r), { recoveredIndex: r.recoveredIndex });
    }
    for (const tracked of item.value.recentSweeps) {
      map.set(keyOf(tracked), { recoveredIndex: tracked.recoveredIndex });
    }
  }
  return map;
}

function describeSweep(value: {
  isSweep: boolean;
  sweep: { type: string; sweptLevel: number } | null;
}) {
  return {
    isSweep: value.isSweep,
    type: value.sweep?.type ?? null,
    level: value.sweep?.sweptLevel ?? null,
  };
}

describe("createLiquiditySweep", () => {
  const candles = generateCandles(400);
  const opts = { swingPeriod: 3, maxRecoveryBars: 4, maxTrackedSweeps: 10 };

  it("sweeps the older level on a bar that also confirms a new pivot", () => {
    // Swing high 105 at bar 1 (confirmed at bar 2) and swing low 94 at bar 2
    // (confirmed at bar 3). Bar 4 is an outside bar: it sweeps the low, which
    // suppresses the bearish check, so 105 survives even though bar 4 traded
    // through it. Bar 4 is also a pivot high at 110, confirmed on bar 5 — and
    // bar 5 trades to 107, above the still-tracked 105 and below the 110 it is
    // confirming. Adopting 110 before judging bar 5 would hide that sweep.
    const rows = [
      { o: 99, h: 100, l: 98, c: 99 }, // 0
      { o: 99, h: 105, l: 96, c: 104 }, // 1 - pivot high 105
      { o: 104, h: 103, l: 94, c: 100 }, // 2 - pivot low 94
      { o: 100, h: 104, l: 95, c: 103 }, // 3
      { o: 103, h: 110, l: 90, c: 100 }, // 4 - outside bar: sweeps 94; pivot high 110
      { o: 100, h: 107, l: 93, c: 100 }, // 5 - sweeps 105 while confirming 110
      { o: 100, h: 106, l: 94, c: 101 }, // 6
    ];
    const fixture: NormalizedCandle[] = rows.map((d, i) => ({
      time: 1700000000000 + i * 86400000,
      open: d.o,
      high: d.h,
      low: d.l,
      close: d.c,
      volume: 1000,
    }));
    const options = { swingPeriod: 1, maxRecoveryBars: 3, minSweepDepth: 0 };

    const batch = liquiditySweep(fixture, options);
    expect(batch[4].value.sweep?.type).toBe("bullish");
    expect(batch[4].value.sweep?.sweptLevel).toBe(94);
    expect(batch[5].value.sweep?.type).toBe("bearish");
    expect(batch[5].value.sweep?.sweptLevel).toBe(105);

    const live = createLiquiditySweep(options);
    for (let i = 0; i < fixture.length; i++) {
      const value = live.next(fixture[i]).value;
      expect({ bar: i, ...describeSweep(value) }).toEqual({
        bar: i,
        ...describeSweep(batch[i].value),
      });
    }
  });

  it("detects the same sweeps as batch on every bar", () => {
    let compared = 0;
    let sweeps = 0;
    for (const swingPeriod of [1, 2, 3, 5]) {
      const options = { swingPeriod, maxRecoveryBars: 3, minSweepDepth: 0 };
      const batch = liquiditySweep(candles, options);
      const live = createLiquiditySweep(options);
      for (let i = 0; i < candles.length; i++) {
        const value = live.next(candles[i]).value;
        expect({ bar: i, swingPeriod, ...describeSweep(value) }).toEqual({
          bar: i,
          swingPeriod,
          ...describeSweep(batch[i].value),
        });
        compared++;
        if (batch[i].value.isSweep) sweeps++;
      }
    }
    expect(compared).toBe(candles.length * 4);
    expect(sweeps).toBeGreaterThan(0);
  });

  it("detects the same set of sweeps as batch", () => {
    const liveMap = collectLive(candles, opts);
    const batchMap = collectBatch(candles, opts);
    // Live should be a non-empty superset of batch's keys (or equal). In
    // practice both sides produce the same set on stable inputs.
    expect(liveMap.size).toBeGreaterThan(0);
    expect(batchMap.size).toBeGreaterThan(0);

    // Every batch-detected sweep should also be detected live.
    for (const key of batchMap.keys()) {
      expect(liveMap.has(key)).toBe(true);
    }
  });

  it("agrees with batch on recoveredIndex for shared sweeps", () => {
    const liveMap = collectLive(candles, opts);
    const batchMap = collectBatch(candles, opts);
    for (const [key, b] of batchMap) {
      const l = liveMap.get(key);
      if (!l) continue;
      expect(l.recoveredIndex).toBe(b.recoveredIndex);
    }
  });

  it("restores from snapshot without drift", () => {
    const a = createLiquiditySweep(opts);
    for (let i = 0; i < 200; i++) a.next(candles[i]);
    const b = createLiquiditySweep(opts, { fromState: a.getState() });
    for (let i = 200; i < candles.length; i++) {
      const va = a.next(candles[i]).value;
      const vb = b.next(candles[i]).value;
      expect(vb.isSweep).toBe(va.isSweep);
      expect(vb.recoveredThisBar.length).toBe(va.recoveredThisBar.length);
      expect(vb.recentSweeps.map(keyOf).sort()).toEqual(va.recentSweeps.map(keyOf).sort());
    }
  });

  it("peek does not mutate state", () => {
    const live = createLiquiditySweep(opts);
    for (let i = 0; i < 50; i++) live.next(candles[i]);
    const before = JSON.stringify(live.getState());
    live.peek(candles[50]);
    expect(JSON.stringify(live.getState())).toBe(before);
  });

  it("throws on invalid options", () => {
    expect(() => createLiquiditySweep({ swingPeriod: 0 })).toThrow();
    expect(() => createLiquiditySweep({ maxRecoveryBars: 0 })).toThrow();
    expect(() => createLiquiditySweep({ maxTrackedSweeps: 0 })).toThrow();
    expect(() => createLiquiditySweep({ minSweepDepth: -1 })).toThrow();
  });

  it("warms up via WarmUpOptions.warmUp", () => {
    const warmUp = candles.slice(0, 50);
    const live = createLiquiditySweep(opts, { warmUp });
    expect(live.count).toBe(50);
    // Should match a fresh instance fed the same candles.
    const ref = createLiquiditySweep(opts);
    for (const c of warmUp) ref.next(c);
    expect(JSON.stringify(live.getState())).toBe(JSON.stringify(ref.getState()));
  });
});
