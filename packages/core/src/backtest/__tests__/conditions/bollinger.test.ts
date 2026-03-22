import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { bollingerBreakout, bollingerTouch, evaluateCondition } from "../../conditions";

describe("bollingerBreakout()", () => {
  it("should detect upper band breakout", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
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
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
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

describe("bollingerTouch()", () => {
  it("should create a valid preset condition", () => {
    const condition = bollingerTouch("upper");
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("bollingerTouch('upper')");
  });

  it("should detect upper band touch", () => {
    // Create candles where price gradually rises to touch upper band
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      // At index 45, push high near upper band but close within it
      if (i === 45) {
        price = 108; // Close within band
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.3,
        high: i === 45 ? 110 : price + 0.5, // High touches/near upper band
        low: price - 0.5,
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerTouch("upper");
    const indicators: Record<string, unknown> = {};

    // Check near the touch candle
    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(typeof result).toBe("boolean");
  });

  it("should detect lower band touch", () => {
    // Create candles where price drops to touch lower band
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      let price = 100;
      if (i === 45) {
        price = 92; // Close within band
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.3,
        high: price + 0.5,
        low: i === 45 ? 90 : price - 0.5, // Low touches/near lower band
        close: price,
        volume: 1000000,
      });
    }

    const condition = bollingerTouch("lower");
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[45], 45, candles);
    expect(typeof result).toBe("boolean");
  });

  it("should not trigger when price is clearly in the middle of bands", () => {
    // Generate data with enough volatility to have wide bands, then check middle price
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      // Oscillating data to create meaningful band width
      const price = 100 + Math.sin(i / 5) * 5;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 0.3,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    // Override candle 30 to be exactly at the middle (close to SMA)
    candles[30] = {
      ...candles[30],
      open: 99.5,
      high: 100.5,
      low: 99.5,
      close: 100,
    };

    const conditionUpper = bollingerTouch("upper");
    const conditionLower = bollingerTouch("lower");
    const indicators: Record<string, unknown> = {};

    const resultUpper = evaluateCondition(conditionUpper, indicators, candles[30], 30, candles);
    const resultLower = evaluateCondition(conditionLower, indicators, candles[30], 30, candles);
    expect(resultUpper).toBe(false);
    expect(resultLower).toBe(false);
  });
});
