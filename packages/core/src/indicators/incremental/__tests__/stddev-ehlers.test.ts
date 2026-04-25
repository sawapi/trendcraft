/**
 * Parity tests for the new statistical / filter incremental indicators:
 * Standard Deviation, Super Smoother, Roofing Filter.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { roofingFilter } from "../../filter/roofing-filter";
import { superSmoother } from "../../filter/super-smoother";
import { standardDeviation } from "../../volatility/standard-deviation";
import { processAll } from "../bridge";
import { createRoofingFilter } from "../filter/roofing-filter";
import { createSuperSmoother } from "../filter/super-smoother";
import { createStandardDeviation } from "../volatility/standard-deviation";

function generateCandles(count: number, seed = 17): NormalizedCandle[] {
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

describe("createStandardDeviation", () => {
  const candles = generateCandles(200);

  for (const period of [5, 20, 50]) {
    it(`matches batch standardDeviation (period=${period})`, () => {
      const batch = standardDeviation(candles, { period });
      const incr = processAll(createStandardDeviation({ period }), candles);
      for (let i = 0; i < batch.length; i++) {
        if (batch[i].value === null) {
          expect(incr[i].value).toBeNull();
        } else {
          expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 8);
        }
      }
    });
  }

  it("source=hl2 matches batch", () => {
    const batch = standardDeviation(candles, { period: 20, source: "hl2" });
    const incr = processAll(createStandardDeviation({ period: 20, source: "hl2" }), candles);
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].value === null) {
        expect(incr[i].value).toBeNull();
      } else {
        expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 8);
      }
    }
  });

  it("snapshot resume", () => {
    const a = createStandardDeviation({ period: 20 });
    for (let i = 0; i < 80; i++) a.next(candles[i]);
    const b = createStandardDeviation({ period: 20 }, { fromState: a.getState() });
    const batch = standardDeviation(candles, { period: 20 });
    for (let i = 80; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 8);
    }
  });

  it("peek does not mutate state", () => {
    const sd = createStandardDeviation({ period: 20 });
    for (let i = 0; i < 50; i++) sd.next(candles[i]);
    const before = JSON.stringify(sd.getState());
    sd.peek(candles[50]);
    expect(JSON.stringify(sd.getState())).toBe(before);
  });

  it("peek result equals next result", () => {
    const sd = createStandardDeviation({ period: 10 });
    for (let i = 0; i < 30; i++) sd.next(candles[i]);
    const peeked = sd.peek(candles[30]).value;
    const advanced = sd.next(candles[30]).value;
    expect(peeked as number).toBeCloseTo(advanced as number, 12);
  });

  it("throws on invalid period", () => {
    expect(() => createStandardDeviation({ period: 0 })).toThrow();
  });

  it("restoring from snapshot uses saved period/source even if options omit them", () => {
    const a = createStandardDeviation({ period: 30, source: "hlc3" });
    for (let i = 0; i < 80; i++) a.next(candles[i]);
    const b = createStandardDeviation({}, { fromState: a.getState() });
    const batch = standardDeviation(candles, { period: 30, source: "hlc3" });
    for (let i = 80; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 8);
    }
  });
});

describe("createSuperSmoother", () => {
  const candles = generateCandles(120);

  for (const period of [5, 10, 25]) {
    it(`matches batch superSmoother (period=${period})`, () => {
      const batch = superSmoother(candles, { period });
      const incr = processAll(createSuperSmoother({ period }), candles);
      for (let i = 0; i < batch.length; i++) {
        if (batch[i].value === null) {
          expect(incr[i].value).toBeNull();
        } else {
          expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 10);
        }
      }
    });
  }

  it("source=hlc3 matches batch", () => {
    const batch = superSmoother(candles, { period: 10, source: "hlc3" });
    const incr = processAll(createSuperSmoother({ period: 10, source: "hlc3" }), candles);
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].value === null) continue;
      expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });

  it("snapshot resume", () => {
    const a = createSuperSmoother({ period: 10 });
    for (let i = 0; i < 60; i++) a.next(candles[i]);
    const b = createSuperSmoother({ period: 10 }, { fromState: a.getState() });
    const batch = superSmoother(candles, { period: 10 });
    for (let i = 60; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });

  it("throws on invalid period", () => {
    expect(() => createSuperSmoother({ period: 0 })).toThrow();
  });

  it("isWarmedUp aligns with the first non-null output", () => {
    const ss = createSuperSmoother({ period: 10 });
    expect(ss.isWarmedUp).toBe(false);
    const a = ss.next(candles[0]); // null
    expect(a.value).toBeNull();
    expect(ss.isWarmedUp).toBe(false);
    const b = ss.next(candles[1]); // null (still warming up)
    expect(b.value).toBeNull();
    expect(ss.isWarmedUp).toBe(false);
    const c = ss.next(candles[2]); // first real value
    expect(c.value).not.toBeNull();
    expect(ss.isWarmedUp).toBe(true);
  });

  it("restoring from snapshot uses saved period/source even if options omit them", () => {
    const a = createSuperSmoother({ period: 25, source: "hlc3" });
    for (let i = 0; i < 60; i++) a.next(candles[i]);
    const b = createSuperSmoother({}, { fromState: a.getState() });
    const batch = superSmoother(candles, { period: 25, source: "hlc3" });
    for (let i = 60; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });
});

describe("createRoofingFilter", () => {
  const candles = generateCandles(150);

  it("matches batch roofingFilter (default params)", () => {
    const batch = roofingFilter(candles);
    const incr = processAll(createRoofingFilter(), candles);
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].value === null) {
        expect(incr[i].value).toBeNull();
      } else {
        expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 10);
      }
    }
  });

  it("matches batch roofingFilter (custom params)", () => {
    const opts = { highPassPeriod: 30, lowPassPeriod: 8, source: "hlc3" as const };
    const batch = roofingFilter(candles, opts);
    const incr = processAll(createRoofingFilter(opts), candles);
    for (let i = 0; i < batch.length; i++) {
      if (batch[i].value === null) continue;
      expect(incr[i].value as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });

  it("snapshot resume preserves filter memory", () => {
    const a = createRoofingFilter({ highPassPeriod: 48, lowPassPeriod: 10 });
    for (let i = 0; i < 70; i++) a.next(candles[i]);
    const b = createRoofingFilter(
      { highPassPeriod: 48, lowPassPeriod: 10 },
      { fromState: a.getState() },
    );
    const batch = roofingFilter(candles);
    for (let i = 70; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });

  it("throws on invalid params", () => {
    expect(() => createRoofingFilter({ highPassPeriod: 0 })).toThrow();
    expect(() => createRoofingFilter({ lowPassPeriod: 0 })).toThrow();
  });

  it("isWarmedUp aligns with the first non-null output", () => {
    const rf = createRoofingFilter();
    expect(rf.isWarmedUp).toBe(false);
    const a = rf.next(candles[0]); // null
    expect(a.value).toBeNull();
    expect(rf.isWarmedUp).toBe(false);
    const b = rf.next(candles[1]); // null
    expect(b.value).toBeNull();
    expect(rf.isWarmedUp).toBe(false);
    const c = rf.next(candles[2]); // first real value
    expect(c.value).not.toBeNull();
    expect(rf.isWarmedUp).toBe(true);
  });

  it("restoring from snapshot uses saved highPass/lowPass/source even if options omit them", () => {
    const opts = { highPassPeriod: 30, lowPassPeriod: 8, source: "hlc3" as const };
    const a = createRoofingFilter(opts);
    for (let i = 0; i < 70; i++) a.next(candles[i]);
    const b = createRoofingFilter({}, { fromState: a.getState() });
    const batch = roofingFilter(candles, opts);
    for (let i = 70; i < candles.length; i++) {
      const v = b.next(candles[i]).value;
      expect(v as number).toBeCloseTo(batch[i].value as number, 10);
    }
  });
});
