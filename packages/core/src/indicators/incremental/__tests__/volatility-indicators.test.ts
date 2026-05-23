/**
 * Tests for incremental volatility indicators (Issue #5):
 * EWMA Volatility, Garman-Klass, Historical Volatility, ATR Stops, Ulcer Index
 */

import { describe, expect, it } from "vitest";
import type { AtrStopsValue, NormalizedCandle } from "../../../types";
import { atrStops } from "../../volatility/atr-stops";
import { garmanKlass } from "../../volatility/garman-klass";
import { historicalVolatility } from "../../volatility/historical-volatility";
import { ulcerIndex } from "../../volatility/ulcer-index";
import { processAll } from "../bridge";
import { createAtrStops } from "../volatility/atr-stops";
import { createEwmaVolatility } from "../volatility/ewma-volatility";
import { createGarmanKlass } from "../volatility/garman-klass";
import { createHistoricalVolatility } from "../volatility/historical-volatility";
import { createUlcerIndex } from "../volatility/ulcer-index";

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
  batchResult: { time: number; value: unknown }[],
  incrementalResult: { time: number; value: unknown }[],
  tolerance = 1e-10,
  extractValue?: (v: unknown) => number | null,
) {
  expect(incrementalResult.length).toBe(batchResult.length);
  const extract = extractValue ?? ((v: unknown) => v as number | null);

  for (let i = 0; i < batchResult.length; i++) {
    expect(incrementalResult[i].time).toBe(batchResult[i].time);
    const bv = extract(batchResult[i].value);
    const iv = extract(incrementalResult[i].value);

    if (bv === null || bv === undefined) {
      expect(iv === null || iv === undefined).toBe(true);
    } else {
      expect(iv).not.toBeNull();
      expect(Math.abs((iv as number) - bv)).toBeLessThan(tolerance);
    }
  }
}

// ---- Garman-Klass ----
describe("Garman-Klass incremental", () => {
  it("matches batch output", () => {
    const batch = garmanKlass(candles, { period: 20 });
    const incremental = processAll(createGarmanKlass({ period: 20 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createGarmanKlass({ period: 20 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);
    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    expect(JSON.stringify(ind.getState())).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createGarmanKlass({ period: 20 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const ind2 = createGarmanKlass({ period: 20 }, { fromState: ind1.getState() });
    for (let i = 40; i < 80; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Historical Volatility ----
describe("Historical Volatility incremental", () => {
  it("matches batch output", () => {
    const batch = historicalVolatility(candles, { period: 20 });
    const incremental = processAll(createHistoricalVolatility({ period: 20 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createHistoricalVolatility({ period: 20 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);
    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    expect(JSON.stringify(ind.getState())).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createHistoricalVolatility({ period: 20 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const ind2 = createHistoricalVolatility({ period: 20 }, { fromState: ind1.getState() });
    for (let i = 40; i < 80; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- ATR Stops ----
describe("ATR Stops incremental", () => {
  const extractAtr = (v: unknown) => (v as AtrStopsValue)?.atr ?? null;

  it("matches batch output (atr field)", () => {
    const batch = atrStops(candles, { period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 });
    const incremental = processAll(
      createAtrStops({ period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8, extractAtr);
  });

  it("peek does not mutate state", () => {
    const ind = createAtrStops({ period: 14 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createAtrStops({ period: 14 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createAtrStops({ period: 14 }, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = extractAtr(ind1.next(candles[i]).value);
      const v2 = extractAtr(ind2.next(candles[i]).value);
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- Ulcer Index ----
describe("Ulcer Index incremental", () => {
  it("matches batch output", () => {
    const batch = ulcerIndex(candles, { period: 14 });
    const incremental = processAll(createUlcerIndex({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createUlcerIndex({ period: 14 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createUlcerIndex({ period: 14 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createUlcerIndex({ period: 14 }, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });

  it("pre-0.4.0 bare-state snapshot is rejected by the State Contract", () => {
    // A pre-0.4.0 snapshot is bare state without the `meta` envelope.
    // Includes the now-removed single-buffer field as well — both
    // shapes flunk the same missing-meta check in resolveResume.
    // The dedicated translation shim that used to live inside
    // createUlcerIndex was removed: per-indicator guards aren't added;
    // resolveResume handles legacy snapshots centrally.
    const legacyState = {
      period: 14,
      source: "close" as const,
      buffer: { capacity: 14, items: [100, 101, 102] },
      count: 3,
    };
    expect(() => createUlcerIndex({ period: 14 }, { fromState: legacyState as never })).toThrow(
      /incompatible snapshot|pre-0\.4\.0/i,
    );
  });
});

// ---- EWMA Volatility ----
// Note: EWMA batch takes returns[], not candles. Test incremental internally.
describe("EWMA Volatility incremental", () => {
  it("peek does not mutate state", () => {
    const ind = createEwmaVolatility({ lambda: 0.94 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createEwmaVolatility({ lambda: 0.94 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createEwmaVolatility({ lambda: 0.94 }, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });

  it("emits null during seeding and produces non-null once seed completes", () => {
    // Default seedSize=10 — need 10 returns (= 11 candles) before the
    // first stable sample-variance estimate is emitted.
    const ind = createEwmaVolatility({ lambda: 0.94 });
    // Candle 0 has no return yet; candles 1..9 are mid-seed (9 returns).
    for (let i = 0; i < 10; i++) {
      expect(ind.next(candles[i]).value).toBeNull();
    }
    expect(ind.isWarmedUp).toBe(false);
    // Candle 10 produces the 10th return — seed completes and the
    // first non-null value is emitted alongside `isWarmedUp=true`.
    const v = ind.next(candles[10]).value;
    expect(v).not.toBeNull();
    expect(v).toBeGreaterThan(0);
    expect(ind.isWarmedUp).toBe(true);
  });
});
