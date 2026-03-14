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

  it("compiles gapDown condition", () => {
    const template = makeTemplate({
      indicators: [],
      entry: { type: "gapDown", params: { minGapPercent: 2 } },
      exit: { type: "rsiAbove", params: { threshold: 70 } },
    });
    // gapDown entry needs rsi indicator for exit
    template.indicators = [{ type: "rsi", name: "rsi", params: { period: 14 } }];
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
  });

  it("compiles gapUp condition", () => {
    const template = makeTemplate({
      indicators: [{ type: "rsi", name: "rsi", params: { period: 14 } }],
      entry: { type: "gapUp", params: { minGapPercent: 1 } },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
  });

  it("compiles vwap conditions", () => {
    const template = makeTemplate({
      indicators: [
        { type: "vwap", name: "vwap", params: {} },
        { type: "rsi", name: "rsi", params: { period: 14 } },
      ],
      entry: { type: "priceBelowVwap", params: {} },
      exit: { type: "priceAboveVwap", params: {} },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
  });

  it("compiles SMC conditions", () => {
    const template = makeTemplate({
      indicators: [{ type: "rsi", name: "rsi", params: { period: 14 } }],
      entry: { type: "priceAtBullishOB", params: {} },
      exit: { type: "rsiAbove", params: { threshold: 70 } },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
  });

  it("compiles MTF conditions (streaming-only, backtest passes)", () => {
    const template = makeTemplate({
      indicators: [
        { type: "ema", name: "ema9", params: { period: 9 } },
        { type: "rsi", name: "rsi", params: { period: 14 } },
      ],
      entry: { type: "mtfPriceAbove", params: { indicatorKey: "ema50", timeframe: "15m" } },
      exit: { type: "rsiAbove", params: { threshold: 70 } },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
  });

  it("compiles short direction strategy", () => {
    const template = makeTemplate({ direction: "short" });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy.position.direction).toBe("short");
  });

  it("defaults direction to long", () => {
    const template = makeTemplate();
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.strategy.position.direction).toBe("long");
  });

  it("compiles regimeGate and auto-injects regime indicator", () => {
    const template = makeTemplate({
      regimeGate: {
        allowedTrends: ["bullish"],
        minTrendStrength: 25,
      },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Pipeline should have regime indicator injected
    const indicatorNames = result.strategy.pipeline.indicators.map((i) => i.name);
    expect(indicatorNames).toContain("regime");
  });

  it("stores orderType and limitOffsetPercent in metadata", () => {
    const template = makeTemplate({
      position: {
        capital: 100000,
        sizingMethod: "risk-based",
        riskPercent: 1,
        stopLoss: 3,
        slippage: 0.05,
        orderType: "limit",
        limitOffsetPercent: 0.1,
      },
    });
    const result = compileTemplate(template);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = result.strategy.metadata as Record<string, unknown>;
    expect(meta.orderType).toBe("limit");
    expect(meta.limitOffsetPercent).toBe(0.1);
  });
});
