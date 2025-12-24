import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { and, evaluateCondition, not, or } from "../../conditions";
import { generateCandles } from "./test-helpers";

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
      const result = evaluateCondition(
        customCondition,
        indicators,
        candles[highPriceIndex],
        highPriceIndex,
        candles,
      );
      expect(result).toBe(true);
    }
  });
});
