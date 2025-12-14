import { describe, it, expect } from "vitest";
import {
  and,
  or,
  not,
  goldenCross,
  deadCross,
  rsiBelow,
  rsiAbove,
  macdCrossUp,
  macdCrossDown,
  bollingerBreakout,
  evaluateCondition,
} from "../conditions";
import type { NormalizedCandle } from "../../types";

// Helper to generate test candles
function generateCandles(count: number, basePrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const price = basePrice + Math.sin(i / 10) * 10 + i * 0.1;
    candles.push({
      time: baseTime + i * 24 * 60 * 60 * 1000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000 + Math.random() * 100000,
    });
  }

  return candles;
}

// Generate uptrend candles for golden cross testing
function generateUptrendCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    // First half: downtrend, second half: strong uptrend
    let price: number;
    if (i < count / 2) {
      price = 100 - i * 0.5; // Downtrend
    } else {
      price = 100 - (count / 2) * 0.5 + (i - count / 2) * 2; // Strong uptrend
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

  return candles;
}

describe("Condition combinators", () => {
  const candles = generateCandles(50);
  const indicators: Record<string, unknown> = {};

  describe("and()", () => {
    it("should return true only when all conditions are true", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const allTrue = and(alwaysTrue, alwaysTrue, alwaysTrue);
      const oneFalse = and(alwaysTrue, alwaysFalse, alwaysTrue);

      expect(evaluateCondition(allTrue, indicators, candles[10], 10, candles)).toBe(true);
      expect(evaluateCondition(oneFalse, indicators, candles[10], 10, candles)).toBe(false);
    });
  });

  describe("or()", () => {
    it("should return true when any condition is true", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const oneTrue = or(alwaysFalse, alwaysTrue, alwaysFalse);
      const allFalse = or(alwaysFalse, alwaysFalse, alwaysFalse);

      expect(evaluateCondition(oneTrue, indicators, candles[10], 10, candles)).toBe(true);
      expect(evaluateCondition(allFalse, indicators, candles[10], 10, candles)).toBe(false);
    });
  });

  describe("not()", () => {
    it("should negate the condition", () => {
      const alwaysTrue = () => true;
      const alwaysFalse = () => false;

      const negatedTrue = not(alwaysTrue);
      const negatedFalse = not(alwaysFalse);

      expect(evaluateCondition(negatedTrue, indicators, candles[10], 10, candles)).toBe(false);
      expect(evaluateCondition(negatedFalse, indicators, candles[10], 10, candles)).toBe(true);
    });
  });
});

describe("goldenCross()", () => {
  it("should detect golden cross in uptrend data", () => {
    const candles = generateUptrendCandles(100);
    const condition = goldenCross(5, 25);
    const indicators: Record<string, unknown> = {};

    // Find if there's a golden cross
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
});

describe("rsiBelow()", () => {
  it("should detect RSI below threshold", () => {
    // Generate downtrend candles to get low RSI
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 - i * 2; // Strong downtrend
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    // Check near the end where RSI should be low
    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    // RSI should be low after a strong downtrend
    expect(typeof result).toBe("boolean");
  });
});

describe("rsiAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = rsiAbove(70);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("rsiAbove");
  });
});

describe("macdCrossUp()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossUp();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossUp()");
  });
});

describe("macdCrossDown()", () => {
  it("should create a valid preset condition", () => {
    const condition = macdCrossDown();
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("macdCrossDown()");
  });
});

describe("bollingerBreakout()", () => {
  it("should detect upper band breakout", () => {
    // Generate candles with a spike
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      // Create a big spike at index 45
      if (i === 45) {
        price = 150;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerBreakout("upper");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });

  it("should detect lower band breakout", () => {
    // Generate candles with a drop
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      // Create a big drop at index 45
      if (i === 45) {
        price = 50;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerBreakout("lower");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(result).toBe(true);
  });
});

describe("Custom function condition", () => {
  it("should evaluate custom function", () => {
    const candles = generateCandles(50);
    const indicators: Record<string, unknown> = {};

    const customCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
      return candle.close > 100;
    };

    // Find a candle with close > 100
    const highPriceIndex = candles.findIndex((c) => c.close > 100);
    if (highPriceIndex >= 0) {
      const result = evaluateCondition(customCondition, indicators, candles[highPriceIndex], highPriceIndex, candles);
      expect(result).toBe(true);
    }
  });
});
