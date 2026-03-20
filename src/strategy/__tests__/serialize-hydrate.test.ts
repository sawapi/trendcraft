import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import { hydrateCondition, loadStrategy } from "../hydrate";
import { backtestRegistry } from "../registry-backtest";
import { parseStrategy, serializeStrategy } from "../serialize";
import type { ConditionSpec, StrategyJSON } from "../types";

// Helper: create minimal candle data for evaluation
function makeCandles(count: number): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  for (let i = 0; i < count; i++) {
    candles.push({
      time: 1000 + i * 86400000,
      open: 100 + i,
      high: 105 + i,
      low: 95 + i,
      close: 102 + i,
      volume: 10000 + i * 100,
    });
  }
  return candles;
}

describe("serializeStrategy / parseStrategy", () => {
  const strategy: StrategyJSON = {
    $schema: "trendcraft/strategy",
    version: 1,
    id: "test-strategy",
    name: "Test Strategy",
    description: "A test",
    tags: ["test"],
    entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
    exit: { name: "rsiAbove", params: { threshold: 70 } },
    backtest: {
      capital: 1_000_000,
      stopLoss: 5,
      fillMode: "next-bar-open",
    },
    metadata: { author: "test" },
  };

  it("round-trip: serialize → parse", () => {
    const json = serializeStrategy(strategy);
    const parsed = parseStrategy(json);

    expect(parsed.$schema).toBe("trendcraft/strategy");
    expect(parsed.version).toBe(1);
    expect(parsed.id).toBe("test-strategy");
    expect(parsed.name).toBe("Test Strategy");
    expect(parsed.entry).toEqual({
      name: "goldenCross",
      params: { shortPeriod: 5, longPeriod: 25 },
    });
    expect(parsed.exit).toEqual({ name: "rsiAbove", params: { threshold: 70 } });
    expect(parsed.backtest?.capital).toBe(1_000_000);
    expect(parsed.backtest?.stopLoss).toBe(5);
    expect(parsed.metadata?.author).toBe("test");
  });

  it("parseStrategy rejects invalid schema", () => {
    expect(() => parseStrategy('{"$schema":"wrong","version":1}')).toThrow(
      "Invalid strategy schema",
    );
  });

  it("parseStrategy rejects unsupported version", () => {
    expect(() => parseStrategy('{"$schema":"trendcraft/strategy","version":99}')).toThrow(
      "Unsupported strategy version",
    );
  });

  it("serialize produces formatted JSON", () => {
    const json = serializeStrategy(strategy);
    expect(json).toContain("\n"); // multi-line
    expect(json).toContain("  "); // indented
  });
});

describe("hydrateCondition", () => {
  it("hydrates a leaf condition", () => {
    const condition = hydrateCondition(
      { name: "rsiBelow", params: { threshold: 30 } },
      backtestRegistry,
    );
    expect(condition).toBeDefined();
    expect((condition as PresetCondition).type).toBe("preset");
    expect((condition as PresetCondition).name).toContain("rsiBelow");
  });

  it("hydrates with default params when none provided", () => {
    const condition = hydrateCondition({ name: "goldenCross" }, backtestRegistry);
    expect(condition).toBeDefined();
    expect((condition as PresetCondition).type).toBe("preset");
  });

  it("hydrates and()", () => {
    const spec: ConditionSpec = {
      op: "and",
      conditions: [
        { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
        { name: "rsiBelow", params: { threshold: 30 } },
      ],
    };

    const condition = hydrateCondition(spec, backtestRegistry);
    expect((condition as { type: string }).type).toBe("and");
  });

  it("hydrates nested combinators", () => {
    const spec: ConditionSpec = {
      op: "or",
      conditions: [
        {
          op: "and",
          conditions: [{ name: "goldenCross" }, { name: "volumeAboveAvg" }],
        },
        { name: "macdCrossUp" },
      ],
    };

    const condition = hydrateCondition(spec, backtestRegistry);
    expect((condition as { type: string }).type).toBe("or");
  });

  it("hydrates not()", () => {
    const spec: ConditionSpec = {
      op: "not",
      conditions: [{ name: "rsiAbove", params: { threshold: 70 } }],
    };

    const condition = hydrateCondition(spec, backtestRegistry);
    expect((condition as { type: string }).type).toBe("not");
  });

  it("throws on unknown condition", () => {
    expect(() => hydrateCondition({ name: "doesNotExist" }, backtestRegistry)).toThrow(
      'Unknown condition: "doesNotExist"',
    );
  });
});

describe("loadStrategy", () => {
  it("loads strategy with entry, exit, and backtest options", () => {
    const strategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "test",
      name: "Test",
      entry: {
        op: "and",
        conditions: [
          { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
          { name: "rsiBelow", params: { threshold: 30 } },
        ],
      },
      exit: { name: "rsiAbove", params: { threshold: 70 } },
      backtest: {
        capital: 1_000_000,
        stopLoss: 5,
        takeProfit: 10,
        direction: "long",
        fillMode: "next-bar-open",
      },
      metadata: { author: "test" },
    };

    const result = loadStrategy(strategy, backtestRegistry);

    expect(result.entry).toBeDefined();
    expect(result.exit).toBeDefined();
    expect(result.backtestOptions.capital).toBe(1_000_000);
    expect(result.backtestOptions.stopLoss).toBe(5);
    expect(result.backtestOptions.takeProfit).toBe(10);
    expect(result.backtestOptions.direction).toBe("long");
    expect(result.backtestOptions.fillMode).toBe("next-bar-open");
    expect(result.metadata?.author).toBe("test");
  });

  it("loads strategy with empty backtest options", () => {
    const strategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "minimal",
      name: "Minimal",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    };

    const result = loadStrategy(strategy, backtestRegistry);
    expect(result.entry).toBeDefined();
    expect(result.exit).toBeDefined();
    expect(result.backtestOptions).toEqual({});
  });

  it("full round-trip: JSON string → parse → load → evaluate", () => {
    const jsonStr = serializeStrategy({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "round-trip",
      name: "Round Trip",
      entry: { name: "rsiBelow", params: { threshold: 30, period: 14 } },
      exit: { name: "rsiAbove", params: { threshold: 70, period: 14 } },
    });

    const parsed = parseStrategy(jsonStr);
    const { entry, exit } = loadStrategy(parsed, backtestRegistry);

    // Both should be valid PresetConditions that can be evaluated
    const candles = makeCandles(50);
    const indicators: Record<string, unknown> = {};

    // Just verify they don't throw (actual signal depends on data)
    const entryResult = (entry as PresetCondition).evaluate(indicators, candles[49], 49, candles);
    const exitResult = (exit as PresetCondition).evaluate(indicators, candles[49], 49, candles);

    expect(typeof entryResult).toBe("boolean");
    expect(typeof exitResult).toBe("boolean");
  });
});
