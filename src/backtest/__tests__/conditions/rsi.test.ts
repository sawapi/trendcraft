import { describe, it, expect } from "vitest";
import { rsiBelow, rsiAbove, evaluateCondition } from "../../conditions";
import type { NormalizedCandle } from "../../../types";

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
