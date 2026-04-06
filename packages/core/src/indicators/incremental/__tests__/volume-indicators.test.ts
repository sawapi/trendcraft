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
    const ind2 = createPvt({ fromState: ind1.getState() });
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
    const ind2 = createCvd({ fromState: ind1.getState() });
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

  it("matches batch output from bar 2 onward (waveVolume)", () => {
    // Bar 0 direction differs: batch looks ahead to bar 1, incremental defaults to 'up'
    // From bar 2 onward the wave state has converged
    const batch = weisWave(candles);
    const ind = createWeisWave();
    const incr = candles.map((c) => ind.next(c));

    let matchCount = 0;
    for (let i = 2; i < batch.length; i++) {
      const bv = extractWave(batch[i].value);
      const iv = extractWave(incr[i].value);
      if (bv !== null && iv !== null) {
        expect(Math.abs(bv - iv)).toBeLessThan(1e-8);
        matchCount++;
      }
    }
    expect(matchCount).toBeGreaterThan(batch.length / 2);
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
