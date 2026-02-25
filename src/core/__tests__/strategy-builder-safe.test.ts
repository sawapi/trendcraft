/**
 * Tests for StrategyBuilder.backtestSafe() and MtfStrategyBuilder.backtestSafe()
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle, Condition } from "../../types";
import { StrategyBuilder, MtfStrategyBuilder } from "../strategy-builder";

const makeCandles = (count: number, basePrice = 100): NormalizedCandle[] =>
  Array.from({ length: count }, (_, i) => {
    const price = basePrice + Math.sin(i * 0.1) * 10 + i * 0.5;
    return {
      time: 1700000000000 + i * 86400000,
      open: price,
      high: price + 2,
      low: price - 2,
      close: price + (i % 2 === 0 ? 1 : -1),
      volume: 100000,
    };
  });

const entryEveryN = (n: number): Condition => (_indicators, _candle, i) => i % n === 0;

describe("StrategyBuilder.backtestSafe", () => {
  it("returns Ok with valid backtest result", () => {
    const candles = makeCandles(200);
    const result = new StrategyBuilder(candles)
      .entry(entryEveryN(10))
      .exit(entryEveryN(15))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.initialCapital).toBe(1000000);
      expect(result.value.trades).toBeDefined();
    }
  });

  it("returns Err with MISSING_CONDITION when entry is not set", () => {
    const candles = makeCandles(50);
    const result = new StrategyBuilder(candles)
      .exit(entryEveryN(5))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_CONDITION");
      expect(result.error.message).toContain("Entry condition");
    }
  });

  it("returns Err with MISSING_CONDITION when exit is not set", () => {
    const candles = makeCandles(50);
    const result = new StrategyBuilder(candles)
      .entry(entryEveryN(5))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_CONDITION");
      expect(result.error.message).toContain("Exit condition");
    }
  });

  it("returns Err with BACKTEST_FAILED when backtest throws", () => {
    const candles = makeCandles(50);
    const throwingCondition: Condition = () => {
      throw new Error("Test error from condition");
    };

    const result = new StrategyBuilder(candles)
      .entry(throwingCondition)
      .exit(entryEveryN(5))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BACKTEST_FAILED");
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });
});

describe("MtfStrategyBuilder.backtestSafe", () => {
  it("returns Ok with valid backtest result", () => {
    const candles = makeCandles(200);
    const result = new MtfStrategyBuilder(candles, ["weekly"])
      .entry(entryEveryN(10))
      .exit(entryEveryN(15))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.initialCapital).toBe(1000000);
    }
  });

  it("returns Err with MISSING_CONDITION when entry is not set", () => {
    const candles = makeCandles(50);
    const result = new MtfStrategyBuilder(candles, ["weekly"])
      .exit(entryEveryN(5))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_CONDITION");
    }
  });

  it("returns Err with MISSING_CONDITION when exit is not set", () => {
    const candles = makeCandles(50);
    const result = new MtfStrategyBuilder(candles, ["weekly"])
      .entry(entryEveryN(5))
      .backtestSafe({ capital: 1000000 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("MISSING_CONDITION");
    }
  });
});
