import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { evaluateCondition, macdCrossDown, macdCrossUp } from "../../conditions";
import { generateStrongDowntrend, generateStrongUptrend, generateCandles } from "./test-helpers";

describe("macdCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossUp()");
  });

  it("should return false at index 0", () => {
    const candles = generateCandles(50);
    const condition = macdCrossUp();
    const indicators: Record<string, unknown> = {};

    expect(evaluateCondition(condition, indicators, candles[0], 0, candles)).toBe(false);
  });

  it("should detect MACD cross up in uptrend transition", () => {
    // MACD(12,26,9) needs significant data and clear trend change
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 150 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 150; i++) {
      let price: number;
      if (i < 80) {
        price = 200 - i * 1.5; // Long downtrend to establish negative MACD
      } else {
        price = 80 + (i - 80) * 3; // Strong uptrend to cross MACD up
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = macdCrossUp();
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

  it("should cache MACD data in indicators", () => {
    const candles = generateCandles(50);
    const condition = macdCrossUp();
    const indicators: Record<string, unknown> = {};

    evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(indicators["macd_12_26_9"]).toBeDefined();
  });
});

describe("macdCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossDown()");
  });

  it("should detect MACD cross down in downtrend transition", () => {
    // MACD(12,26,9) needs significant data and clear trend change
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 150 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 150; i++) {
      let price: number;
      if (i < 80) {
        price = 100 + i * 1.5; // Long uptrend to establish positive MACD
      } else {
        price = 220 - (i - 80) * 3; // Strong downtrend to cross MACD down
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

    const condition = macdCrossDown();
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

  it("should not trigger during steady uptrend", () => {
    const candles = generateStrongUptrend(100);
    const condition = macdCrossDown();
    const indicators: Record<string, unknown> = {};

    let found = false;
    for (let i = 40; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(false);
  });
});
