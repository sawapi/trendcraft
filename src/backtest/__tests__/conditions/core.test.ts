import { describe, expect, it } from "vitest";
import type { MtfPresetCondition, NormalizedCandle, PresetCondition } from "../../../types";
import {
  MtfContextRequiredError,
  and,
  evaluateCondition,
  getRequiredTimeframes,
  not,
  or,
  requiresMtf,
} from "../../conditions";
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

describe("Nested condition combinators", () => {
  const candles = generateCandles(50);
  const indicators: Record<string, unknown> = {};
  const alwaysTrue = () => true;
  const alwaysFalse = () => false;

  it("should handle and(or(...), not(...))", () => {
    // and(or(false, true), not(false)) → and(true, true) → true
    const nested = and(or(alwaysFalse, alwaysTrue), not(alwaysFalse));
    expect(evaluateCondition(nested, indicators, candles[10], 10, candles)).toBe(true);
  });

  it("should handle or(and(...), not(...))", () => {
    // or(and(true, false), not(false)) → or(false, true) → true
    const nested = or(and(alwaysTrue, alwaysFalse), not(alwaysFalse));
    expect(evaluateCondition(nested, indicators, candles[10], 10, candles)).toBe(true);
  });

  it("should handle deeply nested and(or(...), not(and(..., ...)))", () => {
    // and(or(true, false), not(and(true, true))) → and(true, false) → false
    const nested = and(or(alwaysTrue, alwaysFalse), not(and(alwaysTrue, alwaysTrue)));
    expect(evaluateCondition(nested, indicators, candles[10], 10, candles)).toBe(false);
  });

  it("should handle not(not(...))", () => {
    // not(not(true)) → not(false) → true
    const doubleNeg = not(not(alwaysTrue));
    expect(evaluateCondition(doubleNeg, indicators, candles[10], 10, candles)).toBe(true);
  });

  it("should handle mixed preset and function conditions", () => {
    const presetTrue: PresetCondition = {
      type: "preset",
      name: "alwaysTrue",
      evaluate: () => true,
    };

    const mixed = and(presetTrue, alwaysTrue, not(alwaysFalse));
    expect(evaluateCondition(mixed, indicators, candles[10], 10, candles)).toBe(true);
  });
});

describe("MTF condition handling", () => {
  const candles = generateCandles(50);
  const indicators: Record<string, unknown> = {};

  it("should return false for MTF condition without context (default)", () => {
    const mtfCondition: MtfPresetCondition = {
      type: "mtf-preset",
      name: "testMtf",
      requiredTimeframes: ["weekly"],
      evaluate: () => true,
    };

    // Without mtfContext, should return false (default behavior)
    const result = evaluateCondition(mtfCondition, indicators, candles[10], 10, candles);
    expect(result).toBe(false);
  });

  it("should throw for MTF condition without context (strictMtf)", () => {
    const mtfCondition: MtfPresetCondition = {
      type: "mtf-preset",
      name: "testMtf",
      requiredTimeframes: ["weekly"],
      evaluate: () => true,
    };

    expect(() =>
      evaluateCondition(mtfCondition, indicators, candles[10], 10, candles, undefined, {
        strictMtf: true,
      }),
    ).toThrow(MtfContextRequiredError);
  });

  it("should detect MTF requirements in nested conditions", () => {
    const mtfCondition: MtfPresetCondition = {
      type: "mtf-preset",
      name: "testMtf",
      requiredTimeframes: ["weekly", "monthly"],
      evaluate: () => true,
    };

    const nested = and(() => true, mtfCondition);
    expect(requiresMtf(nested)).toBe(true);

    const timeframes = getRequiredTimeframes(nested);
    expect(timeframes.has("weekly")).toBe(true);
    expect(timeframes.has("monthly")).toBe(true);
  });

  it("should return false for requiresMtf on non-MTF conditions", () => {
    const simple = and(
      () => true,
      () => false,
    );
    expect(requiresMtf(simple)).toBe(false);
    expect(getRequiredTimeframes(simple).size).toBe(0);
  });

  it("should return false for requiresMtf on function condition", () => {
    expect(requiresMtf(() => true)).toBe(false);
  });
});

describe("Custom function condition", () => {
  it("should evaluate custom function", () => {
    const candles = generateCandles(50);
    const indicators: Record<string, unknown> = {};

    const customCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) => {
      return candle.close > 100;
    };

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
