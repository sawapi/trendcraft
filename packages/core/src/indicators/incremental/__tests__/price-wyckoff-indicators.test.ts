/**
 * Tests for incremental Price & Wyckoff indicators (Issue #7 + #8):
 * Highest/Lowest, Pivot Points, Fractals, Gap Analysis, ORB, FVG, VSA
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { fairValueGap } from "../../price/fair-value-gap";
import { gapAnalysis } from "../../price/gap-analysis";
import { highestLowest } from "../../price/highest-lowest";
import { openingRange } from "../../price/opening-range";
import { pivotPoints } from "../../price/pivot-points";
import { vsa } from "../../wyckoff/vsa";
import { processAll } from "../bridge";
import { createFairValueGap } from "../price/fair-value-gap";
import { createFractals } from "../price/fractals";
import { createGapAnalysis } from "../price/gap-analysis";
import { createHighestLowest } from "../price/highest-lowest";
import { createOpeningRange } from "../price/opening-range";
import { createPivotPoints } from "../price/pivot-points";
import { createVsa } from "../wyckoff/vsa";

function generateCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const MS_PER_DAY = 86400000;
  let baseTime = new Date("2020-01-01").getTime();
  let price = 100;

  let seed = 42;
  function random(): number {
    seed = (seed * 16807 + 0) % 2147483647;
    return seed / 2147483647;
  }

  for (let i = 0; i < count; i++) {
    const change = (random() - 0.5) * 4;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + random() * 0.01);
    const low = Math.min(open, close) * (1 - random() * 0.01);
    const volume = Math.floor(100000 + random() * 900000);

    candles.push({
      time: baseTime,
      open: Math.round(open * 10000) / 10000,
      high: Math.round(high * 10000) / 10000,
      low: Math.round(low * 10000) / 10000,
      close: Math.round(close * 10000) / 10000,
      volume,
    });

    price = close;
    baseTime += MS_PER_DAY;
  }

  return candles;
}

const candles = generateCandles(200);

// ---- Highest/Lowest ----
describe("Highest/Lowest incremental", () => {
  it("matches batch output", () => {
    const batch = highestLowest(candles, { period: 20 });
    const incremental = processAll(createHighestLowest({ period: 20 }), candles);
    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value;
      const iv = incremental[i].value;
      if (bv.highest === null) {
        expect(iv.highest).toBeNull();
      } else {
        expect(Math.abs(iv.highest! - bv.highest)).toBeLessThan(1e-8);
      }
      if (bv.lowest === null) {
        expect(iv.lowest).toBeNull();
      } else {
        expect(Math.abs(iv.lowest! - bv.lowest)).toBeLessThan(1e-8);
      }
    }
  });

  it("peek does not mutate state", () => {
    const ind = createHighestLowest({ period: 20 });
    for (let i = 0; i < 25; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[25]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createHighestLowest({ period: 20 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createHighestLowest({ period: 20 }, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1.highest !== null) {
        expect(Math.abs(v1.highest - v2.highest!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Pivot Points ----
describe("Pivot Points incremental", () => {
  it("matches batch output (standard)", () => {
    const batch = pivotPoints(candles);
    const incremental = processAll(createPivotPoints(), candles);
    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bp = batch[i].value.pivot;
      const ip = incremental[i].value.pivot;
      if (bp === null) {
        expect(ip).toBeNull();
      } else {
        expect(Math.abs(ip! - bp)).toBeLessThan(1e-8);
      }
    }
  });

  it("peek does not mutate state", () => {
    const ind = createPivotPoints();
    for (let i = 0; i < 10; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[10]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createPivotPoints();
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const ind2 = createPivotPoints({}, { fromState: ind1.getState() });
    for (let i = 20; i < 40; i++) {
      const v1 = ind1.next(candles[i]).value.pivot;
      const v2 = ind2.next(candles[i]).value.pivot;
      if (v1 !== null) {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Fractals ----
describe("Fractals incremental", () => {
  it("produces delayed fractal signals", () => {
    const ind = createFractals({ period: 2 });
    const results = candles.map((c) => ind.next(c));
    // Should have some fractals detected
    const upFractals = results.filter((r) => r.value.upFractal);
    const downFractals = results.filter((r) => r.value.downFractal);
    expect(upFractals.length).toBeGreaterThan(0);
    expect(downFractals.length).toBeGreaterThan(0);
  });

  it("peek does not mutate state", () => {
    const ind = createFractals({ period: 2 });
    for (let i = 0; i < 10; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[10]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createFractals({ period: 2 });
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const ind2 = createFractals({ period: 2 }, { fromState: ind1.getState() });
    for (let i = 20; i < 40; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v1.upFractal).toBe(v2.upFractal);
      expect(v1.downFractal).toBe(v2.downFractal);
    }
  });
});

// ---- Gap Analysis ----
describe("Gap Analysis incremental", () => {
  it("detects gaps matching batch (type field)", () => {
    const batch = gapAnalysis(candles, { minGapPercent: 0.1 });
    const incremental = processAll(createGapAnalysis({ minGapPercent: 0.1 }), candles);
    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      expect(incremental[i].value.type).toBe(batch[i].value.type);
    }
  });

  it("peek does not mutate state", () => {
    const ind = createGapAnalysis({ minGapPercent: 0.1 });
    for (let i = 0; i < 10; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[10]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createGapAnalysis({ minGapPercent: 0.1 });
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const ind2 = createGapAnalysis({ minGapPercent: 0.1 }, { fromState: ind1.getState() });
    for (let i = 20; i < 40; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v1.type).toBe(v2.type);
    }
  });
});

// ---- Opening Range ----
describe("Opening Range incremental", () => {
  it("matches batch output", () => {
    const batch = openingRange(candles, { minutes: 30 });
    const incremental = processAll(createOpeningRange({ minutes: 30 }), candles);
    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bh = batch[i].value.high;
      const ih = incremental[i].value.high;
      if (bh === null) {
        expect(ih).toBeNull();
      } else {
        expect(Math.abs(ih! - bh)).toBeLessThan(1e-8);
      }
    }
  });

  it("peek does not mutate state", () => {
    const ind = createOpeningRange({ minutes: 30 });
    for (let i = 0; i < 10; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[10]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createOpeningRange({ minutes: 30 });
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const ind2 = createOpeningRange({ minutes: 30 }, { fromState: ind1.getState() });
    for (let i = 20; i < 40; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v1.breakout).toBe(v2.breakout);
    }
  });
});

// ---- Fair Value Gap ----
describe("FVG incremental", () => {
  it("produces FVG signals", () => {
    const ind = createFairValueGap({ minGapPercent: 0 });
    const results = candles.map((c) => ind.next(c));
    const bullishFvgs = results.filter((r) => r.value.newBullishFvg);
    const bearishFvgs = results.filter((r) => r.value.newBearishFvg);
    // At least some FVGs should be detected in 200 candles
    expect(bullishFvgs.length + bearishFvgs.length).toBeGreaterThan(0);
  });

  it("peek does not mutate state", () => {
    const ind = createFairValueGap({});
    for (let i = 0; i < 10; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[10]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createFairValueGap({});
    for (let i = 0; i < 20; i++) ind1.next(candles[i]);
    const ind2 = createFairValueGap({}, { fromState: ind1.getState() });
    for (let i = 20; i < 40; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v1.newBullishFvg).toBe(v2.newBullishFvg);
      expect(v1.newBearishFvg).toBe(v2.newBearishFvg);
    }
  });

  function fvgCandle(
    i: number,
    open: number,
    high: number,
    low: number,
    close: number,
  ): NormalizedCandle {
    return { time: 1700000000000 + i * 60000, open, high, low, close, volume: 1000 };
  }

  // The batch series stores live gap objects in historical entries, so gap
  // fields (`filled` etc.) mutate retroactively when a gap fills later.
  // Project each bar down to the fields that are stable at emission time
  // so batch-vs-incremental comparison is not polluted by that aliasing.
  function fvgProjection(v: FvgValueShape) {
    return {
      newBullishFvg: v.newBullishFvg,
      newBearishFvg: v.newBearishFvg,
      newFvg: v.newFvg ? [v.newFvg.type, v.newFvg.startIndex, v.newFvg.high, v.newFvg.low] : null,
      activeBullish: v.activeBullishFvgs.map((g) => g.startIndex),
      activeBearish: v.activeBearishFvgs.map((g) => g.startIndex),
      // full data, order-sensitive: a filled gap is never mutated again
      filledFvgs: v.filledFvgs,
    };
  }
  type FvgValueShape = ReturnType<typeof fairValueGap>[number]["value"];

  it("peek matches next when a new FVG forms while the active list is at maxActiveFvgs", () => {
    // Monotonic uptrend: every bar from i=2 on opens a new, never-filled
    // bullish FVG, so the active list reaches the cap at i = cap + 1 and
    // next() starts evicting the oldest gap on every later bar.
    const cap = 10;
    const uptrend: NormalizedCandle[] = [];
    for (let i = 0; i < cap + 4; i++) {
      const base = 100 + i * 10;
      uptrend.push(fvgCandle(i, base, base + 4, base, base + 4));
    }
    const ind = createFairValueGap({ maxActiveFvgs: cap });
    let capBarsSeen = 0;
    for (const candle of uptrend) {
      const peeked = ind.peek(candle);
      const advanced = ind.next(candle);
      expect(fvgProjection(peeked.value)).toEqual(fvgProjection(advanced.value));
      expect(peeked.value.activeBullishFvgs.length).toBeLessThanOrEqual(cap);
      if (advanced.value.activeBullishFvgs.length === cap) capBarsSeen++;
    }
    // Make sure the fixture actually exercised the cap boundary
    expect(capBarsSeen).toBeGreaterThanOrEqual(3);
  });

  it("lists same-bar multiple fills oldest-first, matching batch order", () => {
    // Bars 2 and 3 each open a bearish FVG; bar 4 rallies through both
    // zones so both fill on the same bar. Batch fills in insertion
    // (oldest-first) order, and the incremental result must match.
    const doubleFill = [
      fvgCandle(0, 100, 101, 99, 100),
      fvgCandle(1, 100, 101, 99, 100),
      fvgCandle(2, 90, 91, 89, 90),
      fvgCandle(3, 80, 81, 79, 80),
      fvgCandle(4, 80, 105, 80, 104),
    ];
    const batch = fairValueGap(doubleFill, {});
    const ind = createFairValueGap({});
    const perBar = doubleFill.map((c) => {
      const peeked = ind.peek(c).value;
      const advanced = ind.next(c).value;
      return { peeked, advanced };
    });
    expect(perBar[4].advanced.filledFvgs.map((g) => g.startIndex)).toEqual([2, 3]);
    expect(perBar[4].advanced.filledFvgs).toEqual(batch[4].value.filledFvgs);
    expect(perBar[4].peeked.filledFvgs).toEqual(batch[4].value.filledFvgs);
  });

  it("peek does not stamp fills onto gaps aliased into previous results", () => {
    // next() returns shallow copies of the active lists, so the gap
    // objects inside earlier results alias live state. A peek that
    // would fill a gap must not mutate those — the fill never happened.
    const cs = [
      fvgCandle(0, 100, 101, 100, 101),
      fvgCandle(1, 103, 104, 103, 104),
      fvgCandle(2, 106, 107, 105, 107), // bullish FVG zone 101-105
    ];
    const ind = createFairValueGap({});
    let lastActive: FvgValueShape["activeBullishFvgs"] = [];
    for (const c of cs) lastActive = ind.next(c).value.activeBullishFvgs;
    expect(lastActive).toHaveLength(1);
    const filler = fvgCandle(3, 104, 105, 100, 104); // low 100 enters the zone
    const peeked = ind.peek(filler).value;
    expect(peeked.filledFvgs).toHaveLength(1);
    expect(lastActive[0].filled).toBe(false);
    expect(lastActive[0].filledIndex).toBeNull();
    // the real next() still detects the same fill
    expect(ind.next(filler).value.filledFvgs).toHaveLength(1);
  });

  it("matches batch bar-by-bar across caps and fill modes (randomized)", () => {
    let seed = 123456789;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const maxActiveFvgs of [1, 2, 10]) {
      for (const partialFill of [true, false]) {
        const walk: NormalizedCandle[] = [];
        let price = 100;
        for (let i = 0; i < 300; i++) {
          const drift = (rnd() - 0.48) * 6;
          const open = price;
          const close = price * (1 + drift / 100);
          const high = Math.max(open, close) * (1 + rnd() * 0.02);
          const low = Math.min(open, close) * (1 - rnd() * 0.02);
          walk.push(fvgCandle(i, open, high, low, close));
          price = close;
        }
        const batch = fairValueGap(walk, { maxActiveFvgs, partialFill });
        const ind = createFairValueGap({ maxActiveFvgs, partialFill });
        for (let i = 0; i < walk.length; i++) {
          const peeked = ind.peek(walk[i]).value;
          const advanced = ind.next(walk[i]).value;
          expect(fvgProjection(peeked)).toEqual(fvgProjection(advanced));
          expect(fvgProjection(advanced)).toEqual(fvgProjection(batch[i].value));
        }
      }
    }
  });
});

// ---- VSA ----
describe("VSA incremental", () => {
  it("matches batch output exactly on every bar", () => {
    // Exact equality, not a match-rate threshold: the old 80% tolerance
    // hid a buffer off-by-one that made the 'test' rule scan 9 previous
    // bars instead of batch's 10.
    const batch = vsa(candles, { volumeMaPeriod: 20, atrPeriod: 14 });
    const incremental = processAll(createVsa({ volumeMaPeriod: 20, atrPeriod: 14 }), candles);
    expect(incremental.length).toBe(batch.length);
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value;
      const iv = incremental[i].value;
      expect(iv.barType).toBe(bv.barType);
      expect(iv.isEffortDivergence).toBe(bv.isEffortDivergence);
      expect(Math.abs(iv.spreadRelative - bv.spreadRelative)).toBeLessThan(1e-10);
      expect(Math.abs(iv.closePosition - bv.closePosition)).toBeLessThan(1e-10);
      expect(Math.abs(iv.volumeRelative - bv.volumeRelative)).toBeLessThan(1e-10);
    }
  });

  it("sees the decisive low exactly 10 bars back in the 'test' rule", () => {
    // The 'test' rule scans the 10 bars before the current one. Build a
    // stream whose lowest low sits exactly 10 bars back: a window one
    // bar short misses it and reports a spurious 'test' where batch
    // says 'normal'.
    const fixture: NormalizedCandle[] = [];
    const mk = (
      i: number,
      o: { open?: number; high?: number; low?: number; close?: number; volume?: number } = {},
    ): NormalizedCandle => ({
      time: 1700000000000 + i * 60000,
      open: o.open ?? 100,
      high: o.high ?? 100.6,
      low: o.low ?? 99.4,
      close: o.close ?? 100.2,
      volume: o.volume ?? 1000,
    });
    for (let i = 0; i < 20; i++) fixture.push(mk(i));
    fixture.push(mk(20, { low: 90, open: 100.2, close: 100 })); // decisive low
    for (let i = 21; i < 30; i++) fixture.push(mk(i));
    // Bar 30: low volume, low near the recent shallow lows; the decisive
    // low (90) is exactly 10 back and far outside ATR tolerance.
    fixture.push(mk(30, { volume: 500, low: 99.3, open: 100.1, close: 100 }));

    const batch = vsa(fixture, { volumeMaPeriod: 20, atrPeriod: 14 });
    const ind = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 });
    const inc = fixture.map((c) => {
      const peeked = ind.peek(c).value;
      const advanced = ind.next(c).value;
      expect(peeked.barType).toBe(advanced.barType);
      return advanced;
    });
    expect(batch[30].value.barType).toBe("normal");
    expect(inc[30].barType).toBe("normal");
  });

  it("matches batch barType per bar across randomized streams (peek == next)", () => {
    for (const seed0 of [12648430, 1, 987654321, 42424242]) {
      let seed = seed0;
      const rnd = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      const stream: NormalizedCandle[] = [];
      let price = 100;
      for (let i = 0; i < 300; i++) {
        const drift = (rnd() - 0.5) * 3;
        const open = price;
        const close = price * (1 + drift / 100);
        const high = Math.max(open, close) * (1 + rnd() * 0.008);
        const low = Math.min(open, close) * (1 - rnd() * 0.008);
        const volume = Math.floor(500 + rnd() * 2000);
        stream.push({ time: 1700000000000 + i * 60000, open, high, low, close, volume });
        price = close;
      }
      const batch = vsa(stream, { volumeMaPeriod: 20, atrPeriod: 14 });
      const ind = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 });
      for (let i = 0; i < stream.length; i++) {
        const peeked = ind.peek(stream[i]).value;
        const advanced = ind.next(stream[i]).value;
        expect(peeked.barType).toBe(advanced.barType);
        expect(advanced.barType).toBe(batch[i].value.barType);
      }
    }
  });

  it("peek does not mutate state", () => {
    const ind = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const ind2 = createVsa({ volumeMaPeriod: 20, atrPeriod: 14 }, { fromState: ind1.getState() });
    for (let i = 40; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v1.barType).toBe(v2.barType);
      expect(Math.abs(v1.spreadRelative - v2.spreadRelative)).toBeLessThan(1e-10);
    }
  });
});
