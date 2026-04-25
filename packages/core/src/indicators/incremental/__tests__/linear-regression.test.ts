/**
 * Parity tests for incremental Linear Regression vs the batch
 * `linearRegression()` implementation.
 *
 * The incremental version maintains running sumY / sumY² / sumXY using a
 * sliding-window update rule, so we want to ensure the resulting four
 * outputs (value, slope, intercept, rSquared) match the batch ones bar
 * for bar across multiple periods and price sources.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { linearRegression } from "../../trend/linear-regression";
import { processAll } from "../bridge";
import { createLinearRegression } from "../trend/linear-regression";

function generateCandles(count: number, seed = 91): NormalizedCandle[] {
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
    const change = (r() - 0.5) * 4;
    const open = price;
    const close = price * (1 + change / 100);
    const high = Math.max(open, close) * (1 + r() * 0.015);
    const low = Math.min(open, close) * (1 - r() * 0.015);
    candles.push({ time: base + i * MS, open, high, low, close, volume: 1000 });
    price = close;
  }
  return candles;
}

function expectSeriesMatch(
  incr: ReturnType<typeof processAll<ReturnType<typeof linearRegression>[number]["value"]>>,
  batch: ReturnType<typeof linearRegression>,
  digits = 6,
) {
  expect(incr.length).toBe(batch.length);
  for (let i = 0; i < batch.length; i++) {
    const a = incr[i].value;
    const b = batch[i].value;
    if (a === null || b === null) {
      expect(a).toBeNull();
      expect(b).toBeNull();
      continue;
    }
    expect(a.value).toBeCloseTo(b.value, digits);
    expect(a.slope).toBeCloseTo(b.slope, digits);
    expect(a.intercept).toBeCloseTo(b.intercept, digits);
    expect(a.rSquared).toBeCloseTo(b.rSquared, digits);
  }
}

describe("createLinearRegression", () => {
  const candles = generateCandles(200);

  for (const period of [5, 14, 50]) {
    it(`matches batch linearRegression (period=${period})`, () => {
      const batch = linearRegression(candles, { period });
      const incr = processAll(createLinearRegression({ period }), candles);
      expectSeriesMatch(incr, batch, 6);
    });
  }

  it("source=hlc3 matches batch", () => {
    const batch = linearRegression(candles, { period: 20, source: "hlc3" });
    const incr = processAll(createLinearRegression({ period: 20, source: "hlc3" }), candles);
    expectSeriesMatch(incr, batch, 6);
  });

  it("snapshot resume continues with no drift", () => {
    const a = createLinearRegression({ period: 14 });
    for (let i = 0; i < 80; i++) a.next(candles[i]);
    const b = createLinearRegression({ period: 14 }, { fromState: a.getState() });
    const batch = linearRegression(candles, { period: 14 });
    for (let i = 80; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      const ref = batch[i].value;
      if (ref === null) {
        expect(v).toBeNull();
      } else {
        expect(v?.slope).toBeCloseTo(ref.slope, 6);
        expect(v?.value).toBeCloseTo(ref.value, 6);
        expect(v?.rSquared).toBeCloseTo(ref.rSquared, 6);
      }
    }
  });

  it("peek does not mutate state", () => {
    const lr = createLinearRegression({ period: 14 });
    for (let i = 0; i < 50; i++) lr.next(candles[i]);
    const before = JSON.stringify(lr.getState());
    lr.peek(candles[50]);
    expect(JSON.stringify(lr.getState())).toBe(before);
  });

  it("peek result equals next result", () => {
    const lr = createLinearRegression({ period: 10 });
    for (let i = 0; i < 30; i++) lr.next(candles[i]);
    const peeked = lr.peek(candles[30]).value;
    const advanced = lr.next(candles[30]).value;
    expect(peeked).not.toBeNull();
    expect(advanced).not.toBeNull();
    expect(peeked?.slope).toBeCloseTo(advanced?.slope as number, 10);
    expect(peeked?.value).toBeCloseTo(advanced?.value as number, 10);
    expect(peeked?.rSquared).toBeCloseTo(advanced?.rSquared as number, 10);
  });

  it("isWarmedUp aligns with the first non-null output", () => {
    const lr = createLinearRegression({ period: 5 });
    expect(lr.isWarmedUp).toBe(false);
    // First period-1 calls return null
    for (let i = 0; i < 4; i++) {
      const { value } = lr.next(candles[i]);
      expect(value).toBeNull();
      expect(lr.isWarmedUp).toBe(false);
    }
    const first = lr.next(candles[4]);
    expect(first.value).not.toBeNull();
    expect(lr.isWarmedUp).toBe(true);
  });

  it("rSquared is 1 on a perfectly linear series", () => {
    // y = 10 + 2x exactly
    const linearCandles: NormalizedCandle[] = [];
    for (let i = 0; i < 30; i++) {
      const c = 10 + 2 * i;
      linearCandles.push({
        time: 1700000000000 + i * 86400000,
        open: c,
        high: c,
        low: c,
        close: c,
        volume: 1000,
      });
    }
    const lr = createLinearRegression({ period: 10 });
    let last: ReturnType<typeof lr.next> | null = null;
    for (const c of linearCandles) last = lr.next(c);
    expect(last?.value).not.toBeNull();
    expect(last?.value?.slope).toBeCloseTo(2, 8);
    expect(last?.value?.rSquared).toBeCloseTo(1, 8);
  });

  it("throws on invalid period", () => {
    expect(() => createLinearRegression({ period: 1 })).toThrow();
    expect(() => createLinearRegression({ period: 0 })).toThrow();
  });

  it("restoring from snapshot uses saved period/source even if options omit them", () => {
    // Build a state under non-default config (period=20, source=hlc3)
    const a = createLinearRegression({ period: 20, source: "hlc3" });
    for (let i = 0; i < 80; i++) a.next(candles[i]);
    const snap = a.getState();

    // Restore WITHOUT specifying options (would otherwise default to period=14, close)
    const b = createLinearRegression({}, { fromState: snap });
    const batch = linearRegression(candles, { period: 20, source: "hlc3" });
    for (let i = 80; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      const ref = batch[i].value;
      if (ref === null) {
        expect(v).toBeNull();
      } else {
        expect(v?.slope).toBeCloseTo(ref.slope, 6);
        expect(v?.value).toBeCloseTo(ref.value, 6);
        expect(v?.rSquared).toBeCloseTo(ref.rSquared, 6);
      }
    }
  });
});
