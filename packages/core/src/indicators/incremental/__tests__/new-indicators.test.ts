/**
 * Tests for new incremental indicators: T3, CMO, ADXR, IMI, Klinger
 * and new series utilities: normalizeToPercent, alignAndNormalize
 *
 * Each test verifies batch/streaming consistency, peek immutability,
 * and state persistence (getState → fromState restore).
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { alignAndNormalize, normalizeToPercent } from "../../../utils/series";
import { adxr } from "../../momentum/adxr";
import { cmo } from "../../momentum/cmo";
import { imi } from "../../momentum/imi";
import { t3 } from "../../moving-average/t3";
import { klinger } from "../../volume/klinger";
import type { KlingerValue } from "../../volume/klinger";
import { processAll } from "../bridge";
import { createAdxr } from "../momentum/adxr";
import { createCmo } from "../momentum/cmo";
import { createImi } from "../momentum/imi";
import { createT3 } from "../moving-average/t3";
import { createKlinger } from "../volume/klinger";

/**
 * Generate test candles with realistic-looking data
 */
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

function assertConsistency(
  batchResult: { time: number; value: number | null }[],
  incrementalResult: { time: number; value: number | null }[],
  tolerance = 1e-10,
) {
  expect(incrementalResult.length).toBe(batchResult.length);

  for (let i = 0; i < batchResult.length; i++) {
    expect(incrementalResult[i].time).toBe(batchResult[i].time);

    const bv = batchResult[i].value;
    const iv = incrementalResult[i].value;

    if (bv === null) {
      expect(iv).toBeNull();
    } else {
      expect(iv).not.toBeNull();
      expect(Math.abs(iv! - bv)).toBeLessThan(tolerance);
    }
  }
}

// ---- T3 ----

describe("T3 incremental", () => {
  it("matches batch output", () => {
    const batch = t3(candles, { period: 5, vFactor: 0.7 });
    const incremental = processAll(createT3({ period: 5, vFactor: 0.7 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createT3({ period: 5 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createT3({ period: 5 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createT3({ period: 5 }, { fromState: state });

    for (let i = 50; i < 100; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(v2).not.toBeNull();
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- CMO ----

describe("CMO incremental", () => {
  it("matches batch output", () => {
    const batch = cmo(candles, { period: 14 });
    const incremental = processAll(createCmo({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createCmo({ period: 14 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createCmo({ period: 14 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createCmo({ period: 14 }, { fromState: state });

    for (let i = 50; i < 100; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(v2).not.toBeNull();
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- ADXR ----

describe("ADXR incremental", () => {
  it("matches batch output", () => {
    const batch = adxr(candles, { period: 14 });
    const incremental = processAll(createAdxr({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createAdxr({ period: 14 });
    for (let i = 0; i < 60; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[60]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createAdxr({ period: 14 });
    for (let i = 0; i < 80; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createAdxr({ period: 14 }, { fromState: state });

    for (let i = 80; i < 150; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(v2).not.toBeNull();
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- IMI ----

describe("IMI incremental", () => {
  it("matches batch output", () => {
    const batch = imi(candles, { period: 14 });
    const incremental = processAll(createImi({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createImi({ period: 14 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createImi({ period: 14 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createImi({ period: 14 }, { fromState: state });

    for (let i = 50; i < 100; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(v2).not.toBeNull();
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Klinger ----

describe("Klinger incremental", () => {
  it("matches batch KVO output", () => {
    const batch = klinger(candles, { shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
    const ind = createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });

    for (let i = 0; i < candles.length; i++) {
      const result = ind.next(candles[i]);
      const bv = batch[i].value;
      const iv = result.value;

      expect(result.time).toBe(batch[i].time);

      if (bv.kvo === null) {
        expect(iv.kvo).toBeNull();
      } else {
        expect(iv.kvo).not.toBeNull();
        expect(Math.abs(iv.kvo! - bv.kvo)).toBeLessThan(1e-6);
      }

      if (bv.signal === null) {
        expect(iv.signal).toBeNull();
      } else if (iv.signal !== null) {
        expect(Math.abs(iv.signal - bv.signal)).toBeLessThan(1e-6);
      }
    }
  });

  it("peek does not mutate state", () => {
    const ind = createKlinger();
    for (let i = 0; i < 60; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[60]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createKlinger();
    for (let i = 0; i < 80; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createKlinger({}, { fromState: state });

    for (let i = 80; i < 150; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;

      if (v1.kvo === null) {
        expect(v2.kvo).toBeNull();
      } else {
        expect(v2.kvo).not.toBeNull();
        expect(Math.abs(v1.kvo - v2.kvo!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Series Utilities ----

describe("normalizeToPercent", () => {
  it("converts to percent change from first non-null value", () => {
    const series = [
      { time: 1, value: null },
      { time: 2, value: 100 },
      { time: 3, value: 110 },
      { time: 4, value: 90 },
      { time: 5, value: null },
    ];

    const result = normalizeToPercent(series);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeCloseTo(0);
    expect(result[2].value).toBeCloseTo(10);
    expect(result[3].value).toBeCloseTo(-10);
    expect(result[4].value).toBeNull();
  });

  it("uses specified baseIndex", () => {
    const series = [
      { time: 1, value: 50 },
      { time: 2, value: 100 },
      { time: 3, value: 150 },
    ];

    const result = normalizeToPercent(series, 1);

    expect(result[0].value).toBeCloseTo(-50);
    expect(result[1].value).toBeCloseTo(0);
    expect(result[2].value).toBeCloseTo(50);
  });

  it("handles zero base", () => {
    const series = [
      { time: 1, value: 0 },
      { time: 2, value: 100 },
    ];

    const result = normalizeToPercent(series);
    expect(result[0].value).toBe(0);
    expect(result[1].value).toBe(0);
  });
});

describe("alignAndNormalize", () => {
  it("aligns and normalizes two candle arrays", () => {
    const main = [
      { time: 1, close: 100 },
      { time: 2, close: 110 },
      { time: 3, close: 120 },
    ];

    const comparison = [
      { time: 1, close: 50 },
      { time: 2, close: 60 },
      { time: 3, close: 55 },
    ];

    const result = alignAndNormalize(main, comparison);

    expect(result.main.length).toBe(3);
    expect(result.comparison.length).toBe(3);

    // Main: 0%, 10%, 20%
    expect(result.main[0].value).toBeCloseTo(0);
    expect(result.main[1].value).toBeCloseTo(10);
    expect(result.main[2].value).toBeCloseTo(20);

    // Comparison: 0%, 20%, 10%
    expect(result.comparison[0].value).toBeCloseTo(0);
    expect(result.comparison[1].value).toBeCloseTo(20);
    expect(result.comparison[2].value).toBeCloseTo(10);
  });

  it("handles mismatched timestamps", () => {
    const main = [
      { time: 1, close: 100 },
      { time: 2, close: 110 },
      { time: 4, close: 120 },
    ];

    const comparison = [
      { time: 2, close: 50 },
      { time: 3, close: 60 },
      { time: 4, close: 55 },
    ];

    const result = alignAndNormalize(main, comparison);

    // Only timestamps 2 and 4 overlap
    expect(result.main.length).toBe(2);
    expect(result.comparison.length).toBe(2);

    expect(result.main[0].time).toBe(2);
    expect(result.main[1].time).toBe(4);
  });
});
