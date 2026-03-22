import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { evaluateCondition, priceAboveSma, priceBelowSma, priceDroppedAtr } from "../../conditions";
import { generateCandles, generateStrongUptrend } from "./test-helpers";

describe("priceAboveSma()", () => {
  it("should create a valid preset condition", () => {
    const condition = priceAboveSma(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("priceAboveSma(20)");
  });

  it("should return true when close is above SMA", () => {
    // Strong uptrend: price rises well above SMA
    const candles = generateStrongUptrend(60);
    const condition = priceAboveSma(10);
    const indicators: Record<string, unknown> = {};

    // Near end of uptrend, price should be well above SMA
    const result = evaluateCondition(condition, indicators, candles[55], 55, candles);
    expect(result).toBe(true);
  });

  it("should return false when close is below SMA", () => {
    // Generate downtrend candles
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 60; i++) {
      const price = 200 - i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = priceAboveSma(10);
    const indicators: Record<string, unknown> = {};

    // In downtrend, price should be below SMA
    const result = evaluateCondition(condition, indicators, candles[50], 50, candles);
    expect(result).toBe(false);
  });

  it("should return false for index before SMA period", () => {
    const candles = generateCandles(50);
    const condition = priceAboveSma(20);
    const indicators: Record<string, unknown> = {};

    // SMA(20) requires 20 candles, so index 5 should have null SMA
    const result = evaluateCondition(condition, indicators, candles[5], 5, candles);
    expect(result).toBe(false);
  });

  it("should cache SMA data in indicators object", () => {
    const candles = generateCandles(50);
    const condition = priceAboveSma(10);
    const indicators: Record<string, unknown> = {};

    evaluateCondition(condition, indicators, candles[20], 20, candles);
    expect(indicators.sma10).toBeDefined();

    // Second call should reuse cached data
    evaluateCondition(condition, indicators, candles[30], 30, candles);
    expect(indicators.sma10).toBeDefined();
  });
});

describe("priceBelowSma()", () => {
  it("should create a valid preset condition", () => {
    const condition = priceBelowSma(20);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("priceBelowSma(20)");
  });

  it("should return true when close is below SMA", () => {
    // Generate downtrend candles
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 60; i++) {
      const price = 200 - i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 0.5,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = priceBelowSma(10);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[50], 50, candles);
    expect(result).toBe(true);
  });

  it("should return false when close is above SMA", () => {
    const candles = generateStrongUptrend(60);
    const condition = priceBelowSma(10);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[55], 55, candles);
    expect(result).toBe(false);
  });
});

describe("priceDroppedAtr()", () => {
  it("should create a valid preset condition", () => {
    const condition = priceDroppedAtr(2.0, 10, 14);
    expect(condition.type).toBe("preset");
    expect(condition.name).toBe("priceDroppedAtr(2, 10, 14)");
  });

  it("should return false when index < lookback", () => {
    const candles = generateCandles(50);
    const condition = priceDroppedAtr(2.0, 10, 14);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[5], 5, candles);
    expect(result).toBe(false);
  });

  it("should detect price drop after spike", () => {
    // Create candles with a spike followed by a drop
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 60 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 60; i++) {
      let price = 100;
      // Create a spike at indices 30-40
      if (i >= 30 && i <= 40) {
        price = 150;
      }
      // Drop sharply after the spike
      if (i > 40) {
        price = 90;
      }
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price,
        high: price + 2,
        low: price - 2,
        close: price,
        volume: 1000000,
      });
    }

    const condition = priceDroppedAtr(1.0, 10, 14);
    const indicators: Record<string, unknown> = {};

    // After the spike+drop, price should be significantly below recent high
    let found = false;
    for (let i = 41; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        found = true;
        break;
      }
    }

    expect(found).toBe(true);
  });

  it("should not trigger during steady uptrend", () => {
    const candles = generateStrongUptrend(60);
    const condition = priceDroppedAtr(2.0, 10, 14);
    const indicators: Record<string, unknown> = {};

    // In a steady uptrend, price should not be 2x ATR below recent high
    let triggered = false;
    for (let i = 40; i < candles.length; i++) {
      if (evaluateCondition(condition, indicators, candles[i], i, candles)) {
        triggered = true;
        break;
      }
    }

    expect(triggered).toBe(false);
  });

  it("should cache ATR data in indicators object", () => {
    const candles = generateCandles(50);
    const condition = priceDroppedAtr(2.0, 10, 14);
    const indicators: Record<string, unknown> = {};

    evaluateCondition(condition, indicators, candles[30], 30, candles);
    expect(indicators.atr14).toBeDefined();
  });
});
