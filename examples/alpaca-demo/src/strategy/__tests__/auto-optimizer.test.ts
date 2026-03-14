import type { NormalizedCandle } from "trendcraft";
import { describe, expect, it, vi } from "vitest";
import { optimizeStrategy } from "../auto-optimizer.js";
import type { StrategyTemplate } from "../template.js";

function makeCandles(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.now() - (count - i) * 60000,
    open: 100 + Math.sin(i * 0.1) * 5,
    high: 105 + Math.sin(i * 0.1) * 5,
    low: 95 + Math.sin(i * 0.1) * 5,
    close: 100 + Math.sin(i * 0.1) * 5,
    volume: 1000,
  }));
}

function makeTemplate(overrides: Partial<StrategyTemplate> = {}): StrategyTemplate {
  return {
    id: "test-opt",
    name: "Test Opt",
    description: "test",
    intervalMs: 60000,
    symbols: ["TEST"],
    indicators: [{ type: "rsi", name: "rsi", params: { period: 14 } }],
    entry: { type: "rsiBelow", params: { threshold: 30 } },
    exit: { type: "rsiAbove", params: { threshold: 70 } },
    guards: { maxDailyLoss: -5000, maxDailyTrades: 10 },
    position: {
      capital: 100000,
      sizingMethod: "risk-based",
      riskPercent: 1,
      stopLoss: 3,
      slippage: 0.05,
    },
    source: "preset",
    ...overrides,
  };
}

describe("optimizeStrategy", () => {
  it("returns null when candles < 100", () => {
    const result = optimizeStrategy(makeTemplate(), makeCandles(50));
    expect(result).toBeNull();
  });

  it("returns null when no optimizable parameters", () => {
    const template = makeTemplate({
      indicators: [{ type: "vwap", name: "vwap", params: {} }],
    });
    const result = optimizeStrategy(template, makeCandles(200));
    expect(result).toBeNull();
  });

  it("does not crash with valid inputs (returns null or override)", () => {
    // With random data, WFA likely won't improve enough to override
    const result = optimizeStrategy(makeTemplate(), makeCandles(200));
    // Result should be null (no improvement) or a valid override
    if (result !== null) {
      expect(result.strategyId).toBe("test-opt");
      expect(result.overrides).toBeDefined();
      expect(result.reasoning).toContain("Walk-forward");
    }
  });
});
