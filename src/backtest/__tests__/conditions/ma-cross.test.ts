import { describe, expect, it } from "vitest";
import { deadCross, evaluateCondition, goldenCross } from "../../conditions";
import { generateCandles, generateUptrendCandles } from "./test-helpers";

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
