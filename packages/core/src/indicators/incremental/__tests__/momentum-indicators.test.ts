/**
 * Tests for incremental momentum indicators (Issue #4):
 * AO, BOP, QStick, PPO, Coppock, Mass Index, DPO, Ultimate Oscillator,
 * TSI, KST, Hurst, Schaff Trend Cycle
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { awesomeOscillator } from "../../momentum/awesome-oscillator";
import { balanceOfPower } from "../../momentum/balance-of-power";
import { coppockCurve } from "../../momentum/coppock-curve";
import { dpo } from "../../momentum/dpo";
import { hurst } from "../../momentum/hurst";
import { kst } from "../../momentum/kst";
import { massIndex } from "../../momentum/mass-index";
import { ppo } from "../../momentum/ppo";
import { qstick } from "../../momentum/qstick";
import { tsi } from "../../momentum/tsi";
import { ultimateOscillator } from "../../momentum/ultimate-oscillator";
import { schaffTrendCycle } from "../../trend/schaff-trend-cycle";
import { processAll } from "../bridge";
import { createAwesomeOscillator } from "../momentum/awesome-oscillator";
import { createBalanceOfPower } from "../momentum/balance-of-power";
import { createCoppockCurve } from "../momentum/coppock-curve";
import { createDpo } from "../momentum/dpo";
import { createHurst } from "../momentum/hurst";
import { createKst } from "../momentum/kst";
import { createMassIndex } from "../momentum/mass-index";
import { createPpo } from "../momentum/ppo";
import { createQStick } from "../momentum/qstick";
import { createStc } from "../momentum/schaff-trend-cycle";
import { createTsi } from "../momentum/tsi";
import { createUltimateOscillator } from "../momentum/ultimate-oscillator";

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

const candles = generateCandles(300);

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

function peekTest(
  createFn: (...args: unknown[]) => {
    next: (c: NormalizedCandle) => unknown;
    peek: (c: NormalizedCandle) => unknown;
    getState: () => unknown;
  },
  args: unknown[],
  warmUpCount: number,
) {
  const ind = (createFn as any)(...args);
  for (let i = 0; i < warmUpCount; i++) ind.next(candles[i]);
  const stateBefore = JSON.stringify(ind.getState());
  ind.peek(candles[warmUpCount]);
  const stateAfter = JSON.stringify(ind.getState());
  expect(stateAfter).toBe(stateBefore);
}

function stateRestoreTest(
  createFn: (...args: unknown[]) => {
    next: (c: NormalizedCandle) => { value: unknown };
    getState: () => unknown;
  },
  args: unknown[],
  splitAt: number,
  extractValue?: (v: unknown) => number | null,
) {
  const ind1 = (createFn as any)(...args);
  for (let i = 0; i < splitAt; i++) ind1.next(candles[i]);
  const state = ind1.getState();
  const ind2 = (createFn as any)(args[0], { fromState: state });
  const extract = extractValue ?? ((v: unknown) => v as number | null);

  for (let i = splitAt; i < splitAt + 50; i++) {
    const v1 = extract(ind1.next(candles[i]).value);
    const v2 = extract(ind2.next(candles[i]).value);
    if (v1 === null || v1 === undefined) {
      expect(v2 === null || v2 === undefined).toBe(true);
    } else {
      expect(v2).not.toBeNull();
      expect(Math.abs((v1 as number) - (v2 as number))).toBeLessThan(1e-10);
    }
  }
}

// ---- QStick ----
describe("QStick incremental", () => {
  it("matches batch output", () => {
    const batch = qstick(candles, { period: 14 });
    const incremental = processAll(createQStick({ period: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () => peekTest(createQStick, [{ period: 14 }], 20));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createQStick, [{ period: 14 }], 30));
});

// ---- BOP ----
describe("BOP incremental", () => {
  it("matches batch output", () => {
    const batch = balanceOfPower(candles, { smoothPeriod: 14 });
    const incremental = processAll(createBalanceOfPower({ smoothPeriod: 14 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createBalanceOfPower, [{ smoothPeriod: 14 }], 20));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createBalanceOfPower, [{ smoothPeriod: 14 }], 30));
});

// ---- AO ----
describe("AO incremental", () => {
  it("matches batch output", () => {
    const batch = awesomeOscillator(candles, { fastPeriod: 5, slowPeriod: 34 });
    const incremental = processAll(
      createAwesomeOscillator({ fastPeriod: 5, slowPeriod: 34 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createAwesomeOscillator, [{ fastPeriod: 5, slowPeriod: 34 }], 40));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createAwesomeOscillator, [{ fastPeriod: 5, slowPeriod: 34 }], 50));
});

// ---- PPO ----
describe("PPO incremental", () => {
  const extractPpo = (v: unknown) => (v as { ppo: number } | null)?.ppo ?? null;
  it("matches batch output (ppo line)", () => {
    const batch = ppo(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    const incremental = processAll(
      createPpo({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8, extractPpo);
  });
  it("peek does not mutate state", () =>
    peekTest(createPpo, [{ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }], 40));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(
      createPpo,
      [{ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }],
      50,
      extractPpo,
    ));
});

// ---- Coppock Curve ----
describe("Coppock incremental", () => {
  it("matches batch output", () => {
    const batch = coppockCurve(candles, { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 });
    const incremental = processAll(
      createCoppockCurve({ wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createCoppockCurve, [{ wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 }], 40));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(
      createCoppockCurve,
      [{ wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 }],
      50,
    ));
});

// ---- Mass Index ----
describe("Mass Index incremental", () => {
  it("matches batch output", () => {
    const batch = massIndex(candles, { emaPeriod: 9, sumPeriod: 25 });
    const incremental = processAll(createMassIndex({ emaPeriod: 9, sumPeriod: 25 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createMassIndex, [{ emaPeriod: 9, sumPeriod: 25 }], 50));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createMassIndex, [{ emaPeriod: 9, sumPeriod: 25 }], 60));
});

// ---- DPO ----
describe("DPO incremental", () => {
  it("matches batch output (delayed alignment)", () => {
    const period = 20;
    const shift = Math.floor(period / 2) + 1; // 11
    const batch = dpo(candles, { period });
    const ind = createDpo({ period });

    // Collect non-null incremental results keyed by time
    const incResults = new Map<number, number>();
    for (const candle of candles) {
      const result = ind.next(candle);
      if (result.value !== null) {
        incResults.set(result.time, result.value);
      }
    }

    // Compare with batch: for each non-null batch value, incremental should match
    let matchCount = 0;
    for (let i = 0; i < batch.length; i++) {
      const bv = batch[i].value;
      if (bv === null) continue;
      const iv = incResults.get(batch[i].time);
      if (iv !== undefined) {
        expect(Math.abs(iv - bv)).toBeLessThan(1e-8);
        matchCount++;
      }
    }
    // Should have matched at least some values
    expect(matchCount).toBeGreaterThan(0);

    // Incremental can't compute DPO for the last `shift` bars (no future SMA)
    // so matchCount should be total non-null minus those that incremental can't resolve
    expect(matchCount).toBeGreaterThan(batch.length / 2);
  });
  it("peek does not mutate state", () => peekTest(createDpo, [{ period: 20 }], 30));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createDpo, [{ period: 20 }], 40));
});

// ---- Ultimate Oscillator ----
describe("Ultimate Oscillator incremental", () => {
  it("matches batch output", () => {
    const batch = ultimateOscillator(candles, { period1: 7, period2: 14, period3: 28 });
    const incremental = processAll(
      createUltimateOscillator({ period1: 7, period2: 14, period3: 28 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createUltimateOscillator, [{ period1: 7, period2: 14, period3: 28 }], 40));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createUltimateOscillator, [{ period1: 7, period2: 14, period3: 28 }], 50));
});

// ---- TSI ----
describe("TSI incremental", () => {
  const extractTsi = (v: unknown) => (v as { tsi: number } | null)?.tsi ?? null;
  it("matches batch output (tsi line)", () => {
    const batch = tsi(candles, { longPeriod: 25, shortPeriod: 13, signalPeriod: 7 });
    const incremental = processAll(
      createTsi({ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8, extractTsi);
  });
  it("peek does not mutate state", () =>
    peekTest(createTsi, [{ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 }], 60));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(
      createTsi,
      [{ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 }],
      70,
      extractTsi,
    ));
});

// ---- KST ----
describe("KST incremental", () => {
  const extractKst = (v: unknown) => (v as { kst: number } | null)?.kst ?? null;
  it("matches batch output (kst line)", () => {
    const batch = kst(candles);
    const incremental = processAll(createKst({}), candles);
    assertConsistency(batch, incremental, 1e-8, extractKst);
  });
  it("peek does not mutate state", () => peekTest(createKst, [{}], 80));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createKst, [{}], 90, extractKst));
});

// ---- Hurst ----
describe("Hurst incremental", () => {
  it("matches batch output", () => {
    const batch = hurst(candles, { minWindow: 20, maxWindow: 100 });
    const incremental = processAll(createHurst({ minWindow: 20, maxWindow: 100 }), candles);
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createHurst, [{ minWindow: 20, maxWindow: 100 }], 110));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createHurst, [{ minWindow: 20, maxWindow: 100 }], 120));
});

// ---- STC ----
describe("STC incremental", () => {
  it("matches batch output", () => {
    const batch = schaffTrendCycle(candles, { fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 });
    const incremental = processAll(
      createStc({ fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 }),
      candles,
    );
    assertConsistency(batch, incremental, 1e-8);
  });
  it("peek does not mutate state", () =>
    peekTest(createStc, [{ fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 }], 80));
  it("getState/fromState restores correctly", () =>
    stateRestoreTest(createStc, [{ fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 }], 90));
});
