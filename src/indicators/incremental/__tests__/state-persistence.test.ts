/**
 * State Persistence Tests
 *
 * Verifies that getState/fromState roundtrip preserves indicator behavior.
 * After restoring from state, the indicator should produce identical output.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { createDmi } from "../momentum/dmi";
import { createMacd } from "../momentum/macd";
import { createRsi } from "../momentum/rsi";
import { createStochastics } from "../momentum/stochastics";
import { createEma } from "../moving-average/ema";
import { createSma } from "../moving-average/sma";
import { createWma } from "../moving-average/wma";
import { createParabolicSar } from "../trend/parabolic-sar";
import { createSupertrend } from "../trend/supertrend";
import { createAtr } from "../volatility/atr";
import { createBollingerBands } from "../volatility/bollinger-bands";
import { createCmf } from "../volume/cmf";
import { createObv } from "../volume/obv";
import { createVwap } from "../volume/vwap";

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

const candles = generateCandles(100);
const splitAt = 50;
const firstHalf = candles.slice(0, splitAt);
const secondHalf = candles.slice(splitAt);

/**
 * Generic state persistence test:
 * 1. Process firstHalf with indicator A
 * 2. Save state
 * 3. Create indicator B from saved state (via JSON roundtrip)
 * 4. Process secondHalf with both A and B
 * 5. Verify identical output
 */
function testStatePersistence(
  name: string,
  createFn: () => { next: (c: NormalizedCandle) => { time: number; value: unknown }; getState: () => unknown },
  restoreFn: (state: unknown) => { next: (c: NormalizedCandle) => { time: number; value: unknown }; getState: () => unknown },
) {
  it(`${name}: restored indicator produces identical output`, () => {
    const original = createFn();

    // Process first half
    for (const candle of firstHalf) {
      original.next(candle);
    }

    // Save and restore state (JSON roundtrip to verify serializability)
    const state = JSON.parse(JSON.stringify(original.getState()));
    const restored = restoreFn(state);

    // Process second half with both
    for (const candle of secondHalf) {
      const origResult = original.next(candle);
      const restoredResult = restored.next(candle);

      expect(restoredResult.time).toBe(origResult.time);
      expect(restoredResult.value).toEqual(origResult.value);
    }
  });
}

describe("State persistence", () => {
  testStatePersistence(
    "SMA",
    () => createSma({ period: 10 }),
    (s) => createSma({ period: 10 }, { fromState: s as any }),
  );

  testStatePersistence(
    "EMA",
    () => createEma({ period: 12 }),
    (s) => createEma({ period: 12 }, { fromState: s as any }),
  );

  testStatePersistence(
    "WMA",
    () => createWma({ period: 10 }),
    (s) => createWma({ period: 10 }, { fromState: s as any }),
  );

  testStatePersistence(
    "OBV",
    () => createObv(),
    (s) => createObv({ fromState: s as any }),
  );

  testStatePersistence(
    "RSI",
    () => createRsi({ period: 14 }),
    (s) => createRsi({ period: 14 }, { fromState: s as any }),
  );

  testStatePersistence(
    "ATR",
    () => createAtr({ period: 14 }),
    (s) => createAtr({ period: 14 }, { fromState: s as any }),
  );

  testStatePersistence(
    "MACD",
    () => createMacd(),
    (s) => createMacd({}, { fromState: s as any }),
  );

  testStatePersistence(
    "Bollinger Bands",
    () => createBollingerBands({ period: 20, stdDev: 2 }),
    (s) => createBollingerBands({ period: 20, stdDev: 2 }, { fromState: s as any }),
  );

  testStatePersistence(
    "CMF",
    () => createCmf({ period: 20 }),
    (s) => createCmf({ period: 20 }, { fromState: s as any }),
  );

  testStatePersistence(
    "VWAP",
    () => createVwap(),
    (s) => createVwap({ fromState: s as any }),
  );

  testStatePersistence(
    "Stochastics",
    () => createStochastics({ kPeriod: 14, dPeriod: 3, slowing: 3 }),
    (s) => createStochastics({ kPeriod: 14, dPeriod: 3, slowing: 3 }, { fromState: s as any }),
  );

  testStatePersistence(
    "Supertrend",
    () => createSupertrend({ period: 10, multiplier: 3 }),
    (s) => createSupertrend({ period: 10, multiplier: 3 }, { fromState: s as any }),
  );

  testStatePersistence(
    "Parabolic SAR",
    () => createParabolicSar({ step: 0.02, max: 0.2 }),
    (s) => createParabolicSar({ step: 0.02, max: 0.2 }, { fromState: s as any }),
  );

  testStatePersistence(
    "DMI",
    () => createDmi({ period: 14, adxPeriod: 14 }),
    (s) => createDmi({ period: 14, adxPeriod: 14 }, { fromState: s as any }),
  );
});
