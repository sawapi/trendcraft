import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import { evaluateCondition, rsiAbove, rsiBelow } from "../../conditions";

describe("rsiBelow()", () => {
  it("should detect RSI below threshold in strong downtrend", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 - i * 2;
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

    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(true);
  });

  it("should not trigger in strong uptrend", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 + i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(false);
  });

  it("should cache RSI data in indicators", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 30; i++) {
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: 100,
        high: 101,
        low: 99,
        close: 100,
        volume: 1000000,
      });
    }

    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    evaluateCondition(condition, indicators, candles[20], 20, candles);
    expect(indicators["rsi14"]).toBeDefined();
  });
});

describe("rsiAbove()", () => {
  it("should create a valid preset condition", () => {
    const condition = rsiAbove(70);
    expect(condition.type).toBe("preset");
    expect(condition.name).toContain("rsiAbove");
  });

  it("should detect RSI above threshold in strong uptrend", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 + i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiAbove(70);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(true);
  });

  it("should not trigger in strong downtrend", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 200 - i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price + 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiAbove(70);
    const indicators: Record<string, unknown> = {};

    const result = evaluateCondition(condition, indicators, candles[40], 40, candles);
    expect(result).toBe(false);
  });

  it("should respect custom period parameter", () => {
    const candles: NormalizedCandle[] = [];
    const baseTime = Date.now() - 50 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < 50; i++) {
      const price = 100 + i * 2;
      candles.push({
        time: baseTime + i * 24 * 60 * 60 * 1000,
        open: price - 1,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 1000000,
      });
    }

    const condition = rsiAbove(70, 7);
    const indicators: Record<string, unknown> = {};

    evaluateCondition(condition, indicators, candles[30], 30, candles);
    expect(indicators["rsi7"]).toBeDefined();
  });
});
