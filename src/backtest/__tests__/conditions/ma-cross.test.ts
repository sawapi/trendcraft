import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import {
  deadCross,
  evaluateCondition,
  goldenCross,
  validatedDeadCross,
  validatedGoldenCross,
} from "../../conditions";
import { generateCandles, generateUptrendCandles } from "./test-helpers";

describe("goldenCross()", () => {
  it("should detect golden cross in uptrend data", () => {
    const candles = generateUptrendCandles(100);
    const condition = goldenCross(5, 25);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger on first candle", () => {
    const candles = generateCandles(50);
    const condition = goldenCross(5, 25);
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[0], 0, candles)).toBe(false);
  });
});

describe("deadCross()", () => {
  it("should create a valid preset condition", () => {
    const condition = deadCross(5, 25);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("deadCross");
  });

  it("should detect dead cross in downtrend transition", () => {
    // Uptrend then downtrend
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 100; i++) {
      let price: number;
      if (i < 50) {
        price = 100 + i * 2;
      } else {
        price = 200 - (i - 50) * 2;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = deadCross(5, 25);
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("validatedGoldenCross()", () => {
  it("should create a valid preset condition with default minScore", () => {
    const condition = validatedGoldenCross();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("validatedGoldenCross(minScore=50)");
  });

  it("should detect validated golden cross in strong uptrend", () => {
    const candles = generateUptrendCandles(100);
    // Use low minScore to catch the cross
    const condition = validatedGoldenCross({ shortPeriod: 5, longPeriod: 25, minScore: 15 });
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should return false at early indices", () => {
    const candles = generateCandles(50);
    const condition = validatedGoldenCross();
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[5], 5, candles)).toBe(false);
  });
});

describe("validatedDeadCross()", () => {
  it("should create a valid preset condition with default minScore", () => {
    const condition = validatedDeadCross();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("validatedDeadCross(minScore=50)");
  });

  it("should detect validated dead cross in downtrend transition", () => {
    // Strong uptrend then sharp reversal
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 100 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 100; i++) {
      let price: number;
      if (i < 50) {
        price = 100 + i * 2;
      } else {
        price = 200 - (i - 50) * 3;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1500000,
      });
    }

    const condition = validatedDeadCross({ shortPeriod: 5, longPeriod: 25, minScore: 15 });
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 30; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should return false at early indices", () => {
    const candles = generateCandles(50);
    const condition = validatedDeadCross();
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[5], 5, candles)).toBe(false);
  });
});
