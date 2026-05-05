/**
 * State Persistence Tests — Round 2
 *
 * Mirrors `state-persistence.test.ts` for the long-tail of incremental
 * indicators that have a `getState` / `fromState` API but were missing
 * a snapshot/resume round-trip test (split-stream → restore → continue
 * → outputs match).
 *
 * 300-candle dataset, split at 150, so Hurst (maxWindow 100), KST
 * (~50-bar warmup), Coppock, STC and Mass Index all have non-null
 * comparison samples in the second half.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
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
import { createT3 } from "../moving-average/t3";
import { createRegime } from "../volatility/regime";

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
const splitAt = 150;
const firstHalf = candles.slice(0, splitAt);
const secondHalf = candles.slice(splitAt);

function testStatePersistence(
  name: string,
  createFn: () => {
    next: (c: NormalizedCandle) => { time: number; value: unknown };
    getState: () => unknown;
  },
  restoreFn: (state: unknown) => {
    next: (c: NormalizedCandle) => { time: number; value: unknown };
    getState: () => unknown;
  },
) {
  it(`${name}: restored indicator produces identical output`, () => {
    const original = createFn();
    for (const candle of firstHalf) {
      original.next(candle);
    }

    const state = JSON.parse(JSON.stringify(original.getState()));
    const restored = restoreFn(state);

    let nonNullSamples = 0;
    for (const candle of secondHalf) {
      const origResult = original.next(candle);
      const restoredResult = restored.next(candle);

      expect(restoredResult.time).toBe(origResult.time);
      expect(restoredResult.value).toEqual(origResult.value);

      if (origResult.value !== null) nonNullSamples++;
    }

    // Guard: a roundtrip that only ever compares null vs null is not
    // a real test. Every indicator below should warm up well within
    // the 150-bar firstHalf.
    expect(nonNullSamples).toBeGreaterThan(0);
  });
}

describe("State persistence (round 2)", () => {
  testStatePersistence(
    "Awesome Oscillator",
    () => createAwesomeOscillator({ fastPeriod: 5, slowPeriod: 34 }),
    (s) => createAwesomeOscillator({ fastPeriod: 5, slowPeriod: 34 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Balance of Power",
    () => createBalanceOfPower({ smoothPeriod: 14 }),
    (s) => createBalanceOfPower({ smoothPeriod: 14 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Coppock Curve",
    () => createCoppockCurve({ wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 }),
    (s) =>
      createCoppockCurve(
        { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 },
        { fromState: s as never },
      ),
  );

  testStatePersistence(
    "DPO",
    () => createDpo({ period: 20 }),
    (s) => createDpo({ period: 20 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Hurst Exponent",
    () => createHurst({ minWindow: 10, maxWindow: 60 }),
    (s) => createHurst({ minWindow: 10, maxWindow: 60 }, { fromState: s as never }),
  );

  testStatePersistence(
    "KST",
    () =>
      createKst({
        rocPeriods: [10, 15, 20, 30],
        smaPeriods: [10, 10, 10, 15],
        signalPeriod: 9,
      }),
    (s) =>
      createKst(
        {
          rocPeriods: [10, 15, 20, 30],
          smaPeriods: [10, 10, 10, 15],
          signalPeriod: 9,
        },
        { fromState: s as never },
      ),
  );

  testStatePersistence(
    "Mass Index",
    () => createMassIndex({ emaPeriod: 9, sumPeriod: 25 }),
    (s) => createMassIndex({ emaPeriod: 9, sumPeriod: 25 }, { fromState: s as never }),
  );

  testStatePersistence(
    "PPO",
    () => createPpo({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }),
    (s) =>
      createPpo({ fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 }, { fromState: s as never }),
  );

  testStatePersistence(
    "QStick",
    () => createQStick({ period: 14 }),
    (s) => createQStick({ period: 14 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Schaff Trend Cycle",
    () => createStc({ fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10, factor: 0.5 }),
    (s) =>
      createStc(
        { fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10, factor: 0.5 },
        { fromState: s as never },
      ),
  );

  testStatePersistence(
    "TSI",
    () => createTsi({ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 }),
    (s) =>
      createTsi({ longPeriod: 25, shortPeriod: 13, signalPeriod: 7 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Ultimate Oscillator",
    () => createUltimateOscillator({ period1: 7, period2: 14, period3: 28 }),
    (s) =>
      createUltimateOscillator({ period1: 7, period2: 14, period3: 28 }, { fromState: s as never }),
  );

  testStatePersistence(
    "T3",
    () => createT3({ period: 5, vFactor: 0.7 }),
    (s) => createT3({ period: 5, vFactor: 0.7 }, { fromState: s as never }),
  );

  testStatePersistence(
    "Regime",
    () => createRegime({ atrPeriod: 14, bbPeriod: 20, dmiPeriod: 14, lookback: 50 }),
    (s) =>
      createRegime(
        { atrPeriod: 14, bbPeriod: 20, dmiPeriod: 14, lookback: 50 },
        { fromState: s as never },
      ),
  );
});
