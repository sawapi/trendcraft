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
import { alma } from "../../moving-average/alma";
import { dema } from "../../moving-average/dema";
import { frama } from "../../moving-average/frama";
import { t3 } from "../../moving-average/t3";
import { tema } from "../../moving-average/tema";
import { zlema } from "../../moving-average/zlema";
import { klinger } from "../../volume/klinger";
import { processAll } from "../bridge";
import { createAdxr } from "../momentum/adxr";
import { createCmo } from "../momentum/cmo";
import { createImi } from "../momentum/imi";
import { createAlma } from "../moving-average/alma";
import { createDema } from "../moving-average/dema";
import { createFrama } from "../moving-average/frama";
import { createT3 } from "../moving-average/t3";
import { createTema } from "../moving-average/tema";
import { createZlema } from "../moving-average/zlema";
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

  // Resume contract: Cascaded (3 internal recursive EMAs).
  it("fromState restores shortPeriod / longPeriod / signalPeriod when options are omitted", () => {
    const ind1 = createKlinger({ shortPeriod: 20, longPeriod: 40, signalPeriod: 9 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);
    const state = ind1.getState();

    const ind2 = createKlinger({}, { fromState: state });
    expect(ind2.getState().shortPeriod).toBe(20);
    expect(ind2.getState().longPeriod).toBe(40);
    expect(ind2.getState().signalPeriod).toBe(9);
  });

  it("refuses resume with a different shortPeriod", () => {
    const ind1 = createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(() =>
      createKlinger({ shortPeriod: 20, longPeriod: 55, signalPeriod: 13 }, { fromState: state }),
    ).toThrow(/incompatible snapshot/);
  });

  it("refuses resume with a different longPeriod", () => {
    const ind1 = createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(() =>
      createKlinger({ shortPeriod: 34, longPeriod: 80, signalPeriod: 13 }, { fromState: state }),
    ).toThrow(/incompatible snapshot/);
  });

  it("refuses resume with a different signalPeriod", () => {
    const ind1 = createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(() =>
      createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 9 }, { fromState: state }),
    ).toThrow(/incompatible snapshot/);
  });

  it("peek matches next at every bar and does not mutate state", () => {
    const ind = createKlinger();
    for (let i = 0; i < 100; i++) {
      const stateBeforePeek = JSON.stringify(ind.getState());
      const peeked = ind.peek(candles[i]);
      expect(JSON.stringify(ind.getState())).toBe(stateBeforePeek);
      const advanced = ind.next(candles[i]);
      expect(peeked.value.kvo === null).toBe(advanced.value.kvo === null);
      if (peeked.value.kvo !== null && advanced.value.kvo !== null) {
        expect(peeked.value.kvo).toBeCloseTo(advanced.value.kvo, 10);
      }
    }
  });
});

// ---- DEMA ----

describe("DEMA incremental", () => {
  it("matches batch output", () => {
    const batch = dema(candles, { period: 20 });
    const incremental = processAll(createDema({ period: 20 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createDema({ period: 20 });
    for (let i = 0; i < 50; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[50]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createDema({ period: 20 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createDema({ period: 20 }, { fromState: state });

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

// ---- TEMA ----

describe("TEMA incremental", () => {
  it("matches batch output", () => {
    const batch = tema(candles, { period: 20 });
    const incremental = processAll(createTema({ period: 20 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createTema({ period: 20 });
    for (let i = 0; i < 70; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[70]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createTema({ period: 20 });
    for (let i = 0; i < 70; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createTema({ period: 20 }, { fromState: state });

    for (let i = 70; i < 150; i++) {
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

// ---- ZLEMA ----

describe("ZLEMA incremental", () => {
  it("matches batch output", () => {
    const batch = zlema(candles, { period: 20 });
    const incremental = processAll(createZlema({ period: 20 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createZlema({ period: 20 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createZlema({ period: 20 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createZlema({ period: 20 }, { fromState: state });

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

  it("throws on non-positive period", () => {
    expect(() => createZlema({ period: 0 })).toThrow("ZLEMA period must be at least 1");
    expect(() => createZlema({ period: -1 })).toThrow("ZLEMA period must be at least 1");
  });
});

// ---- ALMA ----

describe("ALMA incremental", () => {
  it("matches batch output", () => {
    const batch = alma(candles, { period: 9, offset: 0.85, sigma: 6 });
    const incremental = processAll(createAlma({ period: 9, offset: 0.85, sigma: 6 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createAlma({ period: 9 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createAlma({ period: 9 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createAlma({ period: 9 }, { fromState: state });

    for (let i = 30; i < 100; i++) {
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

  it("fromState restores period / offset / sigma / source when options are not re-passed", () => {
    // The buffer capacity and the Gaussian weights are functions of all
    // four shape params. Without explicit restoration, a snapshot from
    // `{ period: 20, offset: 0.7, sigma: 8 }` would resume under the
    // canonical 9 / 0.85 / 6 defaults — different weights applied to a
    // 20-slot buffer = mathematically broken output.
    const ind1 = createAlma({ period: 20, offset: 0.7, sigma: 8 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(state.meta.params.period).toBe(20);
    expect(state.meta.params.offset).toBe(0.7);
    expect(state.meta.params.sigma).toBe(8);

    // Resume without re-passing options — params must come from the
    // snapshot, NOT silently revert to canonical defaults.
    const ind2 = createAlma({}, { fromState: state });
    expect(ind2.getState().meta.params.period).toBe(20);
    expect(ind2.getState().meta.params.offset).toBe(0.7);
    expect(ind2.getState().meta.params.sigma).toBe(8);

    // Subsequent values must match what ind1 would have produced.
    for (let i = 40; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value;
      const v2 = ind2.next(candles[i]).value;
      expect(v2).toBeCloseTo(v1!, 10);
    }
  });

  it("re-parameterizing on resume carries forward the latest snapshot prices", () => {
    // The snapshot stores raw source prices (not derived EMA / weighted
    // values), so a Gaussian-shape change does not invalidate them.
    // Resuming a 20-bar snapshot under `period: 9` must therefore emit
    // a non-null value immediately from the latest 9 prices already on
    // hand — and that value must equal what a fresh 9-bar ALMA would
    // produce when fed the same 9 prices in order.
    const ind1 = createAlma({ period: 20, offset: 0.7, sigma: 8 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const state = ind1.getState();

    const ind2 = createAlma({ period: 9, offset: 0.85, sigma: 6 }, { fromState: state });
    expect(ind2.getState().meta.params.period).toBe(9);
    // `count` preserves the public "candles processed so far" contract
    // across reconfiguration — 40 bars went through ind1.
    expect(ind2.getState().state.count).toBe(40);
    // Warm-up is gated on the buffer (filled with the latest 9 prices
    // from the snapshot), not on count. So the indicator emits a
    // value immediately on the next bar.
    expect(ind2.isWarmedUp).toBe(true);

    // Compare the resumed indicator's next bar against what a brand-new
    // 9-bar ALMA, primed with the same raw price tail, would output.
    const baseline = createAlma({ period: 9, offset: 0.85, sigma: 6 });
    for (let i = 31; i < 40; i++) baseline.next(candles[i]);
    const v1 = ind2.next(candles[40]).value;
    const v2 = baseline.next(candles[40]).value;
    expect(v1).not.toBeNull();
    expect(v1).toBeCloseTo(v2!, 10);
  });

  it("changing source on resume throws (Windowed source-change refuse rule)", () => {
    // The buffer holds source-derived numbers (close prices here).
    // Mixing them with `high` prices in the next `period` outputs
    // would be mathematically incorrect. Under the 0.4.0 State
    // Contract, a `source` change on resume is library-wide refused
    // (rather than silently discarding and re-warming), forcing the
    // caller to make a deliberate choice between re-warming a fresh
    // instance or keeping the original source.
    const ind1 = createAlma({ period: 9, source: "close" });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(state.meta.params.source).toBe("close");

    expect(() => createAlma({ source: "high" }, { fromState: state })).toThrow(
      /source mismatch|incompatible snapshot/,
    );
  });

  it("growing the period on resume waits for the buffer to fill before emitting", () => {
    // When the new period exceeds the snapshot's old period, we don't
    // have enough buffered prices to compute the wider Gaussian
    // window. `count` is reset to the carried-over buffer length so
    // `isWarmedUp` correctly stays false until more bars arrive.
    const ind1 = createAlma({ period: 9 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const state = ind1.getState();

    const ind2 = createAlma({ period: 20 }, { fromState: state });
    // `count` preserves the public processed-candles contract (30
    // bars went through ind1) regardless of the buffer carry-over.
    expect(ind2.getState().state.count).toBe(30);
    // Warm-up is gated on the buffer (only 9 of 20 entries carried
    // forward), so the new indicator stays not-yet-warmed-up until
    // 11 more bars fill the window.
    expect(ind2.isWarmedUp).toBe(false);

    // Need 11 more bars to fill the new 20-bar window.
    for (let i = 30; i < 40; i++) {
      expect(ind2.next(candles[i]).value).toBeNull();
    }
    expect(ind2.next(candles[40]).value).not.toBeNull();
  });

  it("explicit options on resume override persisted state", () => {
    const ind1 = createAlma({ period: 20, offset: 0.7, sigma: 8 });
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const ind2 = createAlma({ period: 5, offset: 0.5, sigma: 4 }, { fromState: ind1.getState() });
    expect(ind2.getState().meta.params.period).toBe(5);
    expect(ind2.getState().meta.params.offset).toBe(0.5);
    expect(ind2.getState().meta.params.sigma).toBe(4);
  });
});

// ---- FRAMA ----

describe("FRAMA incremental", () => {
  it("matches batch output", () => {
    const batch = frama(candles, { period: 16 });
    const incremental = processAll(createFrama({ period: 16 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createFrama({ period: 16 });
    for (let i = 0; i < 30; i++) ind.next(candles[i]);

    const stateBefore = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    const stateAfter = JSON.stringify(ind.getState());
    expect(stateAfter).toBe(stateBefore);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createFrama({ period: 16 });
    for (let i = 0; i < 50; i++) ind1.next(candles[i]);

    const state = ind1.getState();
    const ind2 = createFrama({ period: 16 }, { fromState: state });

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
