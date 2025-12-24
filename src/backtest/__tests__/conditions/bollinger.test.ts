import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { bollingerBreakout, evaluateCondition } from "../../conditions";

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
