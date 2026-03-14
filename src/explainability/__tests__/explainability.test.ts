import { describe, expect, it } from "vitest";
import {
  and,
  deadCross,
  goldenCross,
  not,
  or,
  rsiAbove,
  rsiBelow,
} from "../../backtest/conditions";
import type { NormalizedCandle } from "../../types";
import type { ConditionTrace } from "../../types/explainability";
import { explainCondition, explainSignal } from "../explain";
import { generateNarrative } from "../narrative";
import { traceCondition } from "../trace";

/**
 * Generate candles with alternating up/down trends for testing.
 * Produces enough data for RSI and MA indicators to compute valid values.
 */
function generateTestCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 24 * 60 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const cycle = Math.floor(i / 30);
    let price: number;

    if (cycle % 2 === 0) {
      // Uptrend phase
      price = 100 + (i % 30) * 2;
    } else {
      // Downtrend phase
      price = 100 + 60 - (i % 30) * 2;
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

describe("traceCondition", () => {
  it("should trace a simple preset condition", () => {
    const candles = generateTestCandles(100);
    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles);

    expect(trace.type).toBe("preset");
    expect(trace.name).toBe("rsiBelow(30)");
    expect(typeof trace.passed).toBe("boolean");
    expect(trace.reason).toMatch(/rsiBelow\(30\): (passed|failed)/);
    // Should have captured rsi14 indicator value
    expect(trace.indicatorValues).toHaveProperty("rsi14");
  });

  it("should trace an AND combined condition", () => {
    const candles = generateTestCandles(100);
    const condition = and(rsiBelow(80), rsiAbove(20));
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles);

    expect(trace.type).toBe("combined");
    expect(trace.name).toContain("and(");
    expect(trace.children).toHaveLength(2);
    expect(trace.children![0].name).toBe("rsiBelow(80)");
    expect(trace.children![1].name).toBe("rsiAbove(20)");
  });

  it("should trace an OR combined condition", () => {
    const candles = generateTestCandles(100);
    const condition = or(rsiBelow(10), rsiAbove(20));
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles);

    expect(trace.type).toBe("combined");
    expect(trace.name).toContain("or(");
    expect(trace.children).toHaveLength(2);
    // At least one should pass (rsiAbove(20) is likely true at index 50)
    expect(trace.passed).toBe(trace.children!.some((c) => c.passed));
  });

  it("should trace a NOT condition", () => {
    const candles = generateTestCandles(100);
    // NOT rsiBelow(10) should pass (RSI is likely > 10)
    const condition = not(rsiBelow(10));
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles);

    expect(trace.type).toBe("combined");
    expect(trace.name).toContain("not(");
    expect(trace.children).toHaveLength(1);
    expect(trace.passed).toBe(!trace.children![0].passed);
  });

  it("should trace a custom function condition", () => {
    const candles = generateTestCandles(100);
    const customCondition = (_indicators: Record<string, unknown>, candle: NormalizedCandle) =>
      candle.close > 100;
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(customCondition, indicators, candles[50], 50, candles);

    expect(trace.type).toBe("function");
    expect(trace.name).toBe("custom function");
    expect(typeof trace.passed).toBe("boolean");
  });

  it("should respect maxDepth option", () => {
    const candles = generateTestCandles(100);
    // Create a deeply nested condition: and(and(rsiBelow(80)))
    const condition = and(and(rsiBelow(80)));
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles, undefined, {
      maxDepth: 1,
    });

    expect(trace.type).toBe("combined");
    expect(trace.children).toHaveLength(1);
    // The inner and() is at depth=1 which equals maxDepth, so it should be truncated
    expect(trace.children![0].type).toBe("combined");
    expect(trace.children![0].passed).toBe(false); // truncated returns false
    expect(trace.children![0].reason).toBe("Max trace depth reached");
    expect(trace.children![0].children).toBeUndefined();
  });

  it("should exclude values when includeValues is false", () => {
    const candles = generateTestCandles(100);
    const condition = rsiBelow(30);
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles, undefined, {
      includeValues: false,
    });

    expect(Object.keys(trace.indicatorValues)).toHaveLength(0);
  });

  it("should capture indicator values correctly for preset conditions", () => {
    const candles = generateTestCandles(100);
    const condition = rsiBelow(30, 14);
    const indicators: Record<string, unknown> = {};

    const trace = traceCondition(condition, indicators, candles[50], 50, candles);

    // rsi14 should be captured
    expect(trace.indicatorValues).toHaveProperty("rsi14");
    const rsiValue = trace.indicatorValues.rsi14;
    expect(typeof rsiValue).toBe("number");
  });
});

describe("explainSignal", () => {
  it("should explain when entry fires", () => {
    const candles = generateTestCandles(100);
    // Use a condition that will likely pass at some point
    // rsiBelow(100) always passes when RSI is computed
    const explanation = explainSignal(
      candles,
      50,
      rsiBelow(100), // Always passes
      rsiAbove(0), // Always passes
    );

    expect(explanation.signalType).toBe("entry");
    expect(explanation.fired).toBe(true);
    expect(explanation.time).toBe(candles[50].time);
    expect(explanation.candle.close).toBe(candles[50].close);
    expect(explanation.trace.passed).toBe(true);
    expect(explanation.contributions.length).toBeGreaterThan(0);
    expect(explanation.narrative).toContain("Entry signal fired");
  });

  it("should explain when exit fires (entry did not)", () => {
    const candles = generateTestCandles(100);
    // rsiBelow(0) never passes
    const explanation = explainSignal(
      candles,
      50,
      rsiBelow(0), // Never passes
      rsiAbove(0), // Always passes
    );

    expect(explanation.signalType).toBe("exit");
    expect(explanation.fired).toBe(true);
    expect(explanation.trace.passed).toBe(true);
    expect(explanation.narrative).toContain("Exit signal fired");
  });

  it("should explain when neither fires", () => {
    const candles = generateTestCandles(100);
    const explanation = explainSignal(
      candles,
      50,
      rsiBelow(0), // Never passes
      rsiAbove(100), // Never passes
    );

    expect(explanation.signalType).toBe("entry");
    expect(explanation.fired).toBe(false);
    expect(explanation.trace.passed).toBe(false);
    expect(explanation.narrative).toContain("did not fire");
  });

  it("should include contributions from leaf conditions", () => {
    const candles = generateTestCandles(100);
    const entry = and(rsiBelow(100), rsiAbove(0));
    const exit = rsiAbove(70);

    const explanation = explainSignal(candles, 50, entry, exit);

    // Should have 2 leaf contributions from the AND
    expect(explanation.contributions.length).toBe(2);
    expect(explanation.contributions[0].name).toBe("rsiBelow(100)");
    expect(explanation.contributions[1].name).toBe("rsiAbove(0)");
  });

  it("should support Japanese narrative", () => {
    const candles = generateTestCandles(100);
    const explanation = explainSignal(candles, 50, rsiBelow(100), rsiAbove(0), { language: "ja" });

    expect(explanation.narrative).toContain("エントリーシグナル");
    expect(explanation.narrative).toContain("発火しました");
  });
});

describe("explainCondition", () => {
  it("should trace a single condition", () => {
    const candles = generateTestCandles(100);
    const trace = explainCondition(candles, 50, rsiBelow(30));

    expect(trace.type).toBe("preset");
    expect(trace.name).toBe("rsiBelow(30)");
    expect(typeof trace.passed).toBe("boolean");
    expect(trace.indicatorValues).toHaveProperty("rsi14");
  });

  it("should trace a combined condition", () => {
    const candles = generateTestCandles(100);
    const trace = explainCondition(candles, 50, and(rsiBelow(80), rsiAbove(20)));

    expect(trace.type).toBe("combined");
    expect(trace.children).toHaveLength(2);
  });
});

describe("generateNarrative", () => {
  const sampleCandle = {
    open: 99.5,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000000,
  };

  it("should generate English narrative for a fired signal", () => {
    const trace: ConditionTrace = {
      name: "rsiBelow(30)",
      passed: true,
      indicatorValues: { rsi14: 28.5 },
      reason: "rsiBelow(30): passed",
      type: "preset",
    };

    const narrative = generateNarrative(trace, "entry", true, sampleCandle, "en");
    expect(narrative).toContain("Entry signal fired");
    expect(narrative).toContain("close=100");
    expect(narrative).toContain("rsiBelow(30): passed");
    expect(narrative).toContain("rsi14 = 28.5");
  });

  it("should generate English narrative for a non-fired signal", () => {
    const trace: ConditionTrace = {
      name: "rsiBelow(30)",
      passed: false,
      indicatorValues: { rsi14: 55.3 },
      reason: "rsiBelow(30): failed",
      type: "preset",
    };

    const narrative = generateNarrative(trace, "entry", false, sampleCandle, "en");
    expect(narrative).toContain("did not fire");
    expect(narrative).toContain("failed");
  });

  it("should generate Japanese narrative", () => {
    const trace: ConditionTrace = {
      name: "rsiBelow(30)",
      passed: true,
      indicatorValues: { rsi14: 28.5 },
      reason: "rsiBelow(30): passed",
      type: "preset",
    };

    const narrative = generateNarrative(trace, "entry", true, sampleCandle, "ja");
    expect(narrative).toContain("エントリーシグナル");
    expect(narrative).toContain("発火しました");
    expect(narrative).toContain("成立");
  });

  it("should handle combined condition narratives", () => {
    const trace: ConditionTrace = {
      name: "and(rsiBelow(30), rsiAbove(10))",
      passed: true,
      indicatorValues: { rsi14: 25 },
      reason: "All conditions passed",
      children: [
        {
          name: "rsiBelow(30)",
          passed: true,
          indicatorValues: { rsi14: 25 },
          reason: "rsiBelow(30): passed",
          type: "preset",
        },
        {
          name: "rsiAbove(10)",
          passed: true,
          indicatorValues: { rsi14: 25 },
          reason: "rsiAbove(10): passed",
          type: "preset",
        },
      ],
      type: "combined",
    };

    const narrative = generateNarrative(trace, "entry", true, sampleCandle, "en");
    expect(narrative).toContain("AND");
    expect(narrative).toContain("rsiBelow(30): passed");
    expect(narrative).toContain("rsiAbove(10): passed");
  });

  it("should handle exit signal narrative", () => {
    const trace: ConditionTrace = {
      name: "rsiAbove(70)",
      passed: true,
      indicatorValues: { rsi14: 75.2 },
      reason: "rsiAbove(70): passed",
      type: "preset",
    };

    const narrative = generateNarrative(trace, "exit", true, sampleCandle, "en");
    expect(narrative).toContain("Exit signal fired");
  });

  it("should handle exit signal narrative in Japanese", () => {
    const trace: ConditionTrace = {
      name: "rsiAbove(70)",
      passed: true,
      indicatorValues: { rsi14: 75.2 },
      reason: "rsiAbove(70): passed",
      type: "preset",
    };

    const narrative = generateNarrative(trace, "exit", true, sampleCandle, "ja");
    expect(narrative).toContain("イグジットシグナル");
    expect(narrative).toContain("発火しました");
  });
});
