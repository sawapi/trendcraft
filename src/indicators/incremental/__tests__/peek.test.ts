/**
 * Peek Tests
 *
 * Verifies that peek() returns the same value as the next next() call
 * without modifying internal state.
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

/**
 * Generic peek test:
 * 1. Process warmup candles
 * 2. For each remaining candle, peek then next and compare
 * 3. Verify state is unchanged after peek
 */
function testPeek(
  name: string,
  createFn: () => {
    next: (c: NormalizedCandle) => { time: number; value: unknown };
    peek: (c: NormalizedCandle) => { time: number; value: unknown };
    getState: () => unknown;
    readonly count: number;
  },
  warmupCount = 30,
  tolerance = 1e-10,
) {
  it(`${name}: peek matches next without modifying state`, () => {
    const indicator = createFn();

    // Warm up
    for (let i = 0; i < warmupCount; i++) {
      indicator.next(candles[i]);
    }

    // Test peek for remaining candles
    for (let i = warmupCount; i < candles.length; i++) {
      const stateBefore = JSON.stringify(indicator.getState());
      const countBefore = indicator.count;

      const peekResult = indicator.peek(candles[i]);

      // State should be unchanged
      expect(JSON.stringify(indicator.getState())).toBe(stateBefore);
      expect(indicator.count).toBe(countBefore);

      const nextResult = indicator.next(candles[i]);

      // peek and next should return the same value
      expect(peekResult.time).toBe(nextResult.time);

      // Deep comparison with tolerance for numeric values
      const peekStr = JSON.stringify(peekResult.value);
      const nextStr = JSON.stringify(nextResult.value);

      if (tolerance === 0) {
        expect(peekResult.value).toEqual(nextResult.value);
      } else {
        // For floating point, compare stringified then fall back to deep check
        if (peekStr !== nextStr) {
          // Values differ slightly - check within tolerance
          compareWithTolerance(
            peekResult.value,
            nextResult.value,
            tolerance,
            `${name} at index ${i}`,
          );
        }
      }
    }
  });
}

function compareWithTolerance(a: unknown, b: unknown, tolerance: number, context: string): void {
  if (a === null && b === null) return;
  if (typeof a === "number" && typeof b === "number") {
    expect(Math.abs(a - b)).toBeLessThan(tolerance);
    return;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    expect(a).toBe(b);
    return;
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    for (const key of Object.keys(aObj)) {
      compareWithTolerance(aObj[key], bObj[key], tolerance, `${context}.${key}`);
    }
    return;
  }
  expect(a).toEqual(b);
}

describe("Peek correctness", () => {
  testPeek("SMA", () => createSma({ period: 10 }));
  testPeek("EMA", () => createEma({ period: 12 }));
  testPeek("WMA", () => createWma({ period: 10 }), 30, 1e-8);
  testPeek("OBV", () => createObv(), 5, 0);
  testPeek("RSI", () => createRsi({ period: 14 }), 30, 1e-8);
  testPeek("ATR", () => createAtr({ period: 14 }), 30, 1e-8);
  testPeek("MACD", () => createMacd(), 40, 1e-8);
  testPeek("Bollinger Bands", () => createBollingerBands({ period: 20, stdDev: 2 }), 30, 1e-6);
  testPeek("CMF", () => createCmf({ period: 20 }), 30, 1e-8);
  testPeek("VWAP", () => createVwap(), 5, 1e-8);
  testPeek("Stochastics", () => createStochastics(), 30, 1e-8);
  testPeek("Supertrend", () => createSupertrend(), 30, 1e-8);
  testPeek("Parabolic SAR", () => createParabolicSar(), 30, 1e-8);
  testPeek("DMI", () => createDmi(), 40, 1e-8);
});
