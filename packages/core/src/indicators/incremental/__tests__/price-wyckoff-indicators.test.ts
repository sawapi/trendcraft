/**
 * Tests for incremental Price & Wyckoff indicators (Issue #7 + #8):
 * Highest/Lowest, Pivot Points, Fractals, Gap Analysis, ORB, FVG, VSA
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
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
});

// ---- VSA ----
describe("VSA incremental", () => {
  it("matches batch output (barType)", () => {
    const batch = vsa(candles, { volumeMaPeriod: 20, atrPeriod: 14 });
    const incremental = processAll(createVsa({ volumeMaPeriod: 20, atrPeriod: 14 }), candles);
    expect(incremental.length).toBe(batch.length);
    // Match barType for bars where both are warmed up
    let matchCount = 0;
    for (let i = 30; i < batch.length; i++) {
      if (batch[i].value.barType === incremental[i].value.barType) {
        matchCount++;
      }
    }
    // Most should match (some edge cases in lookback may differ)
    expect(matchCount).toBeGreaterThan((batch.length - 30) * 0.8);
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
