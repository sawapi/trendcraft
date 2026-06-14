import { describe, expect, it } from "vitest";
import type { NormalizedCandle, Series } from "../../types";
import { eventStudy } from "../event-study";

const DAY = 86_400_000;
const flat = (price: number, t: number): NormalizedCandle => ({
  time: t,
  open: price,
  high: price + 1,
  low: price - 1,
  close: price,
  volume: 1_000_000,
});

// 30 cycles of 10 bars: bars 0-4 at 100, bars 5-9 at the cycle's "up" price
// (110 or 112, alternating so event forward returns vary). Bar 4 of each cycle
// is always followed by a +10%/+12% step.
const CYCLES = 30;
function cycleCandles(): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  let t = 1_700_000_000_000;
  for (let c = 0; c < CYCLES; c++) {
    const up = c % 2 === 0 ? 110 : 112;
    for (let b = 0; b < 10; b++) {
      candles.push(flat(b < 5 ? 100 : up, t));
      t += DAY;
    }
  }
  return candles;
}

const candles = cycleCandles();
const edgeIndices = Array.from({ length: CYCLES }, (_, c) => c * 10 + 4);
const edgeTimes = edgeIndices.map((i) => candles[i].time);

describe("eventStudy — detects a real forward edge", () => {
  it("reports a large, significant abnormal return after the events", () => {
    const study = eventStudy(candles, edgeTimes, { horizons: [1, 5] });
    expect(study.eventCount).toBe(CYCLES);

    const h1 = study.horizons[0];
    expect(h1.n).toBe(CYCLES);
    // Every event steps up 10% or 12%, so the mean is ~11% and the hit rate 1.
    expect(h1.meanReturn).toBeCloseTo(0.11, 2);
    expect(h1.hitRate).toBe(1);
    expect(h1.meanAbnormalReturn).toBeGreaterThan(0.09);
    // The bootstrap null almost never matches a +11% conditional mean.
    expect(h1.bootstrapPValue).toBeLessThan(0.01);
    expect(h1.hitRatePValue).toBeLessThan(0.01);
    expect(h1.tStat).toBeGreaterThan(3);
  });
});

describe("eventStudy — null events show no edge", () => {
  it("is not significant when events sample all phases evenly", () => {
    // Step 7 is coprime with the 10-bar cycle, so these events cycle through
    // every phase -> conditional ≈ unconditional.
    const nullTimes: number[] = [];
    for (let i = 0; i < candles.length; i += 7) nullTimes.push(candles[i].time);

    const study = eventStudy(candles, nullTimes, { horizons: [1] });
    expect(Math.abs(study.horizons[0].meanAbnormalReturn)).toBeLessThan(0.02);
    expect(study.horizons[0].bootstrapPValue).toBeGreaterThan(0.05);
  });
});

describe("eventStudy — determinism & input forms", () => {
  it("is deterministic for a fixed seed", () => {
    const a = eventStudy(candles, edgeTimes, { horizons: [1], seed: 7 });
    const b = eventStudy(candles, edgeTimes, { horizons: [1], seed: 7 });
    expect(a.horizons[0].bootstrapPValue).toBe(b.horizons[0].bootstrapPValue);
  });

  it("accepts a Series<boolean> equivalently to a timestamp list", () => {
    const eventSet = new Set(edgeIndices);
    const series: Series<boolean> = candles.map((c, i) => ({
      time: c.time,
      value: eventSet.has(i),
    }));
    const fromSeries = eventStudy(candles, series, { horizons: [1], seed: 1 });
    const fromTimes = eventStudy(candles, edgeTimes, { horizons: [1], seed: 1 });
    expect(fromSeries.eventCount).toBe(fromTimes.eventCount);
    expect(fromSeries.horizons[0].meanReturn).toBe(fromTimes.horizons[0].meanReturn);
  });
});

describe("eventStudy — windows, separation and edge cases", () => {
  it("counts overlapping events and thins them with minSeparation", () => {
    // Events are 10 bars apart; with maxHorizon 20 every gap overlaps.
    const overlapping = eventStudy(candles, edgeTimes, { horizons: [20], bootstrap: 0 });
    expect(overlapping.overlappingEvents).toBe(CYCLES - 1);

    const thinned = eventStudy(candles, edgeTimes, {
      horizons: [1],
      minSeparation: 11,
      bootstrap: 0,
    });
    // Keeping only events ≥ 11 bars apart drops every other one.
    expect(thinned.eventCount).toBe(Math.ceil(CYCLES / 2));
  });

  it("shrinks n at horizons whose window runs off the end of the data", () => {
    const study = eventStudy(candles, edgeTimes, { horizons: [1, 20], bootstrap: 0 });
    expect(study.horizons[0].n).toBe(CYCLES);
    // The last events have no full 20-bar forward window.
    expect(study.horizons[1].n).toBeLessThan(CYCLES);
  });

  it("yields NaN stats for a horizon with no events", () => {
    const study = eventStudy(candles, [], { horizons: [5] });
    expect(study.eventCount).toBe(0);
    expect(study.horizons[0].n).toBe(0);
    expect(Number.isNaN(study.horizons[0].meanReturn)).toBe(true);
    expect(Number.isNaN(study.horizons[0].bootstrapPValue)).toBe(true);
  });

  it("populates a Benjamini-Hochberg-adjusted bootstrap p-value per horizon", () => {
    const study = eventStudy(candles, edgeTimes, { horizons: [1, 5, 10] });
    for (const h of study.horizons) {
      expect(h.bootstrapPValueAdjusted).toBeGreaterThanOrEqual(h.bootstrapPValue - 1e-12);
      expect(h.bootstrapPValueAdjusted).toBeLessThanOrEqual(1);
    }
  });

  it("supports a raw (vs zero) baseline", () => {
    const raw = eventStudy(candles, edgeTimes, { horizons: [1], baseline: "raw" });
    // With a raw baseline the abnormal return equals the mean return itself.
    expect(raw.horizons[0].meanAbnormalReturn).toBe(raw.horizons[0].meanReturn);
  });

  it("tests the documented zero null under a raw baseline, even with drift", () => {
    // A clear ~+1%/bar drift with modest variance. Taking *every* bar as an
    // event makes the event set identical to the population, so the event mean
    // equals the unconditional mean exactly — not abnormal. But that same mean
    // sits far from zero relative to the sampling noise. With the null correctly
    // imposed (pseudo-event means centred on the unconditional mean), the two
    // baselines must diverge sharply.
    const drift: NormalizedCandle[] = [];
    let t = 1_700_000_000_000;
    let price = 100;
    for (let i = 0; i < 200; i++) {
      drift.push(flat(price, t));
      price *= 1 + (i % 2 === 0 ? 0.015 : 0.005); // mean ~1%/bar, nonzero variance
      t += DAY;
    }
    const evTimes = drift.map((c) => c.time); // every bar is an event

    const meanAdj = eventStudy(drift, evTimes, { horizons: [1], baseline: "mean-adjusted" });
    const raw = eventStudy(drift, evTimes, { horizons: [1], baseline: "raw" });
    // mean-adjusted: the event mean equals the unconditional mean → not abnormal.
    expect(meanAdj.horizons[0].bootstrapPValue).toBeGreaterThan(0.9);
    // raw: the same return is significantly different from zero.
    expect(raw.horizons[0].bootstrapPValue).toBeLessThan(0.01);
  });
});
