/**
 * Tests for incremental volume indicators (Issue #6):
 * PVT, NVI, CVD, Weis Wave, Anchored VWAP, EMV, Volume Trend
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { anchoredVwap } from "../../volume/anchored-vwap";
import { cvd } from "../../volume/cvd";
import { easeOfMovement } from "../../volume/ease-of-movement";
import { nvi } from "../../volume/nvi";
import { pvt } from "../../volume/pvt";
import { volumeTrend } from "../../volume/volume-trend";
import { weisWave } from "../../volume/weis-wave";
import { processAll } from "../bridge";
import { createAnchoredVwap } from "../volume/anchored-vwap";
import { createCvd } from "../volume/cvd";
import { createEmv } from "../volume/ease-of-movement";
import { createNvi } from "../volume/nvi";
import { createPvt } from "../volume/pvt";
import { createVolumeTrend } from "../volume/volume-trend";
import { createWeisWave } from "../volume/weis-wave";

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

// ---- PVT ----
describe("PVT incremental", () => {
  it("matches batch output", () => {
    const batch = pvt(candles);
    const incremental = processAll(createPvt(), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createPvt();
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createPvt();
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createPvt({}, { fromState: ind1.getState() });
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
});

// ---- NVI ----
describe("NVI incremental", () => {
  it("matches batch output", () => {
    const batch = nvi(candles);
    const incremental = processAll(createNvi(), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createNvi();
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createNvi();
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createNvi({}, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value as number;
      const v2 = ind2.next(candles[i]).value as number;
      expect(Math.abs(v1 - v2)).toBeLessThan(1e-10);
    }
  });
});

// ---- CVD ----
describe("CVD incremental", () => {
  it("matches batch output", () => {
    const batch = cvd(candles);
    const incremental = processAll(createCvd(), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createCvd();
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createCvd();
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createCvd({}, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = ind1.next(candles[i]).value as number;
      const v2 = ind2.next(candles[i]).value as number;
      expect(Math.abs(v1 - v2)).toBeLessThan(1e-10);
    }
  });
});

// ---- Weis Wave ----
describe("Weis Wave incremental", () => {
  const extractWave = (v: unknown) => (v as { waveVolume: number } | null)?.waveVolume ?? null;

  function makeCandle(i: number, close: number, volume = 1000): NormalizedCandle {
    return {
      time: 1700000000000 + i * 60000,
      open: close,
      high: close + 0.5,
      low: close - 0.5,
      close,
      volume,
    };
  }

  // Bar 0 direction can differ by construction: batch seeds it from the
  // bar0->bar1 move, which a streaming consumer has not seen yet, so the
  // incremental labels bar 0 "up" provisionally. Everything else —
  // waveVolume on every bar, direction from bar 1 on — must match batch.
  function expectBatchParity(
    stream: NormalizedCandle[],
    opts: { method?: "close" | "highlow"; threshold?: number } = {},
  ) {
    const batch = weisWave(stream, opts);
    const ind = createWeisWave(opts);
    for (let i = 0; i < stream.length; i++) {
      const peeked = ind.peek(stream[i]).value;
      const advanced = ind.next(stream[i]).value;
      expect(peeked).toEqual(advanced);
      expect(advanced.waveVolume).toBeCloseTo(batch[i].value.waveVolume, 8);
      if (i >= 1) {
        expect(advanced.direction).toBe(batch[i].value.direction);
      }
    }
  }

  it("matches batch on waveVolume (all bars) and direction (bar 1 on)", () => {
    expectBatchParity(candles);
    expectBatchParity(candles, { method: "highlow" });
    expectBatchParity(candles, { threshold: 0.5 });
  });

  it("keeps bar-0 volume in the first wave when the stream starts with a down move", () => {
    // Falling market: the whole stream is one down wave. The first
    // observed move must be adopted as the initial direction, not
    // treated as a reversal that resets the wave and drops bar 0.
    const falling = Array.from({ length: 10 }, (_, i) => makeCandle(i, 100 - i));
    expectBatchParity(falling);
    const ind = createWeisWave();
    const values = falling.map((c) => ind.next(c).value);
    expect(values[1]).toEqual({ waveVolume: 2000, direction: "down" });
    expect(values[9]).toEqual({ waveVolume: 10000, direction: "down" });
  });

  it("adopts the first move as initial direction even when it is under the threshold", () => {
    // Batch seeds bar-0 direction from the first move with no threshold
    // applied; the incremental must do the same on the second bar, or a
    // stream of sub-threshold down moves stays labeled "up" forever.
    const drifting = Array.from({ length: 4 }, (_, i) => makeCandle(i, 100 - i * 0.1));
    expectBatchParity(drifting, { threshold: 0.5 });
    const ind = createWeisWave({ threshold: 0.5 });
    const values = drifting.map((c) => ind.next(c).value);
    expect(values[3]).toEqual({ waveVolume: 4000, direction: "down" });
  });

  it("resumes from a bar-0 snapshot through a JSON round trip without dropping bar 0", () => {
    const falling = Array.from({ length: 10 }, (_, i) => makeCandle(i, 100 - i));
    const batch = weisWave(falling);
    const ind1 = createWeisWave();
    ind1.next(falling[0]);
    const snap = JSON.parse(JSON.stringify(ind1.getState()));
    const ind2 = createWeisWave({}, { fromState: snap });
    for (let i = 1; i < falling.length; i++) {
      const v = ind2.next(falling[i]).value;
      expect(v).toEqual(batch[i].value);
    }
  });

  it("peek does not mutate state", () => {
    const ind = createWeisWave();
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createWeisWave();
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createWeisWave({}, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = extractWave(ind1.next(candles[i]).value);
      const v2 = extractWave(ind2.next(candles[i]).value);
      expect(Math.abs(v1! - v2!)).toBeLessThan(1e-10);
    }
  });
});

// ---- Anchored VWAP ----
describe("Anchored VWAP incremental", () => {
  const anchorTime = candles[10].time;
  const extractVwap = (v: unknown) => (v as { vwap: number | null } | null)?.vwap ?? null;

  it("matches batch output (vwap)", () => {
    const batch = anchoredVwap(candles, { anchorTime });
    const incremental = processAll(createAnchoredVwap({ anchorTime }), candles);
    assertConsistency(batch, incremental, 1e-8, extractVwap);
  });

  it("peek does not mutate state", () => {
    const ind = createAnchoredVwap({ anchorTime });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createAnchoredVwap({ anchorTime });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createAnchoredVwap({ anchorTime }, { fromState: ind1.getState() });
    for (let i = 30; i < 60; i++) {
      const v1 = extractVwap(ind1.next(candles[i]).value);
      const v2 = extractVwap(ind2.next(candles[i]).value);
      if (v1 === null) {
        expect(v2).toBeNull();
      } else {
        expect(Math.abs(v1 - v2!)).toBeLessThan(1e-10);
      }
    }
  });
});

// ---- EMV ----
describe("EMV incremental", () => {
  it("matches batch output", () => {
    const batch = easeOfMovement(candles, { period: 14 });
    const incremental = processAll(createEmv({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });

  it("peek does not mutate state", () => {
    const ind = createEmv({ period: 14 });
    for (let i = 0; i < 20; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[20]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createEmv({ period: 14 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const ind2 = createEmv({ period: 14 }, { fromState: ind1.getState() });
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

  it("default volumeDivisor matches StockCharts canonical scaling (1e8)", () => {
    // Sanity check: sign / slope must equal a manual-divisor variant, but
    // EMV is *proportional* to `volumeDivisor` (rawEmv = distanceMoved *
    // volumeDivisor * hl / volume), so the canonical 1e8 default produces
    // values 10000× LARGER than the legacy 1e4 default.
    const canonical = easeOfMovement(candles, { period: 14 });
    const legacy = easeOfMovement(candles, { period: 14, volumeDivisor: 10000 });
    let comparedAny = false;
    for (let i = 0; i < canonical.length; i++) {
      const a = canonical[i].value;
      const b = legacy[i].value;
      if (a !== null && b !== null && b !== 0) {
        // canonical / legacy = 10000
        expect(Math.abs(a / b - 10000)).toBeLessThan(1e-6);
        comparedAny = true;
      }
    }
    expect(comparedAny).toBe(true);
  });

  it("fromState preserves the volumeDivisor captured in the snapshot", () => {
    // Resume contract: a state created under the legacy divisor must
    // continue computing on that divisor when restored, even after the
    // library default has moved. Without this guard, the resumed series
    // would jump 10000× at the resume boundary.
    const ind1 = createEmv({ period: 14, volumeDivisor: 10000 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(state.meta.params.volumeDivisor).toBe(10000);

    // Resume without re-passing options — the legacy divisor must be
    // recovered from the snapshot, NOT silently swapped for the
    // canonical default.
    const ind2 = createEmv({ period: 14 }, { fromState: state });
    expect(ind2.getState().meta.params.volumeDivisor).toBe(10000);

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

  it("refuses resume with a different volumeDivisor", () => {
    // Under the State Contract, EMV is `mixed`: `volumeDivisor` scales
    // every buffered raw EMV value, so resuming a snapshot with a
    // different divisor is a hard refuse rather than a silent override.
    const ind1 = createEmv({ period: 14, volumeDivisor: 10000 });
    for (let i = 0; i < 30; i++) ind1.next(candles[i]);
    const state = ind1.getState();
    expect(() => createEmv({ period: 14, volumeDivisor: 5000 }, { fromState: state })).toThrow(
      /incompatible snapshot|cannot be reconfigured/,
    );
  });
});

// ---- Volume Trend ----
describe("Volume Trend incremental", () => {
  const extractConfidence = (v: unknown) =>
    (v as { confidence: number } | null)?.confidence ?? null;

  it("matches batch output (confidence)", () => {
    const batch = volumeTrend(candles);
    const incremental = processAll(createVolumeTrend({}), candles);
    assertConsistency(batch, incremental, 1, extractConfidence);
  });

  it("peek does not mutate state", () => {
    const ind = createVolumeTrend({});
    for (let i = 0; i < 30; i++) ind.next(candles[i]);
    const s = JSON.stringify(ind.getState());
    ind.peek(candles[30]);
    expect(JSON.stringify(ind.getState())).toBe(s);
  });

  it("getState/fromState restores correctly", () => {
    const ind1 = createVolumeTrend({});
    for (let i = 0; i < 40; i++) ind1.next(candles[i]);
    const ind2 = createVolumeTrend({}, { fromState: ind1.getState() });
    for (let i = 40; i < 70; i++) {
      const v1 = extractConfidence(ind1.next(candles[i]).value);
      const v2 = extractConfidence(ind2.next(candles[i]).value);
      expect(v1).toBe(v2);
    }
  });
});
