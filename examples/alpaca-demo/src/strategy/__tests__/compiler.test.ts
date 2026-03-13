import { describe, expect, it } from "vitest";
import { compileTemplate } from "../compiler.js";
import type { StrategyTemplate } from "../template.js";
import { PRESET_TEMPLATES } from "../template.js";

function makeTemplate(overrides: Partial<StrategyTemplate> = {}): StrategyTemplate {
  return {
    id: "test",
    name: "Test",
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

describe("compileTemplate", () => {
  it("returns ok for valid RSI template", () => {
    const template = makeTemplate();
    const result = compileTemplate(template);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy.id).toBe("test");
    expect(result.strategy.name).toBe("Test");
    expect(result.strategy.symbols).toEqual(["TEST"]);
    expect(result.strategy.intervalMs).toBe(60000);
    expect(result.strategy.pipeline).toBeDefined();
    expect(result.strategy.backtestEntry).toBeDefined();
    expect(result.strategy.backtestExit).toBeDefined();
  });

  it("returns ok for combined conditions (and/or)", () => {
    const template = makeTemplate({
      indicators: [
        { type: "bollinger", name: "bb", params: { period: 20, stdDev: 2 } },
        { type: "rsi", name: "rsi", params: { period: 14 } },
      ],
      entry: {
        operator: "and",
        conditions: [
          { type: "priceBelow", params: { indicatorKey: "bb.lower" } },
          { type: "rsiBelow", params: { threshold: 40 } },
        ],
      },
      exit: {
        operator: "or",
        conditions: [
          { type: "priceAbove", params: { indicatorKey: "bb.upper" } },
          { type: "rsiAbove", params: { threshold: 70 } },
        ],
      },
    });

    const result = compileTemplate(template);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy.pipeline).toBeDefined();
    expect(result.strategy.backtestEntry).toBeDefined();
    expect(result.strategy.backtestExit).toBeDefined();
  });

  it("returns error for unknown indicator type", () => {
    const template = makeTemplate({
      indicators: [{ type: "nonexistent", name: "bad", params: {} }],
    });

    const result = compileTemplate(template);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Unknown indicator type");
    expect(result.error).toContain("nonexistent");
  });

  it("returns error for unknown condition type", () => {
    const template = makeTemplate({
      entry: { type: "nonexistent", params: {} },
    });

    const result = compileTemplate(template);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("Unknown condition type");
    expect(result.error).toContain("nonexistent");
  });

  it("default params are applied when omitted", () => {
    const template = makeTemplate({
      indicators: [{ type: "rsi", name: "rsi", params: {} }],
      entry: { type: "rsiBelow", params: {} },
      exit: { type: "rsiAbove", params: {} },
    });

    const result = compileTemplate(template);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy.pipeline).toBeDefined();
  });

  it("all preset templates compile successfully", () => {
    expect(PRESET_TEMPLATES.length).toBeGreaterThan(0);

    for (const preset of PRESET_TEMPLATES) {
      const result = compileTemplate(preset);
      expect(result.ok, `Preset "${preset.id}" failed: ${result.ok ? "" : result.error}`).toBe(
        true,
      );
    }
  });
});
