import { describe, it, expect } from "vitest";
import { stochBelow, stochAbove, stochCrossUp, stochCrossDown, evaluateCondition } from "../../conditions";
import type { NormalizedCandle } from "../../../types";
import { generateCandles } from "./test-helpers";

describe("stochBelow()", () => {
  // Generate strong downtrend to get low stochastics
  function generateDowntrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 - i * 1.5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = stochBelow(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("stochBelow");
  });

  it("should detect stochastics below threshold in downtrend", () => {
    const candles = generateDowntrend(50);
    const condition = stochBelow(20);
    const indicators: Record<string, unknown> = {};

    // After sufficient downtrend, stoch should be low
    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("stochAbove()", () => {
  // Generate strong uptrend to get high stochastics
  function generateUptrend(count: number): NormalizedCandle[] {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const price = 100 + i * 1.5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }
    return candles;
  }

  it("should create a valid preset condition", () => {
    const condition = stochAbove(80);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("stochAbove");
  });

  it("should detect stochastics above threshold in uptrend", () => {
    const candles = generateUptrend(50);
    const condition = stochAbove(80);
    const indicators: Record<string, unknown> = {};

    // After sufficient uptrend, stoch should be high
    let found = false;
    for (let i = 20; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });
});

describe("stochCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = stochCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("stochCrossUp()");
  });

  it("should not trigger on first candle", () => {
    const candles = generateCandles(50);
    const condition = stochCrossUp();
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[0], 0, candles)).toBe(false);
  });
});

describe("stochCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = stochCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("stochCrossDown()");
  });
});
