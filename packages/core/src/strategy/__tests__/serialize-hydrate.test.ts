import { describe, expect, it } from "vitest";
import type { NormalizedCandle, PresetCondition } from "../../types";
import { hydrateCondition, loadStrategy } from "../hydrate";
import { backtestRegistry } from "../registry-backtest";
import { parseStrategy, parseStrategySafe, serializeStrategy } from "../serialize";
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

  it("parseStrategy rejects non-object JSON (null / array / primitive)", () => {
    expect(() => parseStrategy("null")).toThrow(/expected JSON object.*null/);
    expect(() => parseStrategy("[1,2,3]")).toThrow(/expected JSON object.*array/);
    expect(() => parseStrategy('"just a string"')).toThrow(/expected JSON object.*string/);
  });

  it("serialize produces formatted JSON", () => {
    const json = serializeStrategy(strategy);
    expect(json).toContain("\n"); // multi-line
    expect(json).toContain("  "); // indented
  });

  it("registry-less parse keeps current behavior — only schema/version checked", () => {
    // Unknown condition slips through without registry. Verifies the
    // back-compat path: existing callers that don't pass a registry
    // see no behavior change.
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "x",
      name: "x",
      entry: { name: "thisDoesNotExist" },
      exit: { name: "alsoMissing" },
    });
    expect(() => parseStrategy(json)).not.toThrow();
  });

  it("with registry, parseStrategy throws on unknown condition (regression — was deferred to hydration)", () => {
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "x",
      name: "x",
      entry: { name: "totallyMadeUpCondition" },
      exit: { name: "deadCross" },
    });
    expect(() => parseStrategy(json, backtestRegistry)).toThrow(/unknown condition/i);
  });

  it("with registry, parseStrategy throws on out-of-range params", () => {
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "x",
      name: "x",
      // bollingerBreakout.stdDev has min: 0.1
      entry: { name: "bollingerBreakout", params: { period: 20, stdDev: -1 } },
      exit: { name: "deadCross" },
    });
    expect(() => parseStrategy(json, backtestRegistry)).toThrow(/below minimum/i);
  });

  it("with registry, parseStrategy throws on missing required fields", () => {
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      // id and name missing
      entry: { name: "deadCross" },
      exit: { name: "deadCross" },
    });
    expect(() => parseStrategy(json, backtestRegistry)).toThrow(/id|name/i);
  });

  it("with registry, parseStrategy aggregates multiple errors in one throw", () => {
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "x",
      name: "x",
      entry: { name: "thisDoesNotExist" },
      exit: { name: "alsoMissing" },
    });
    let caught: Error | null = null;
    try {
      parseStrategy(json, backtestRegistry);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    // One bullet per error.
    const message = caught?.message ?? "";
    expect(message.match(/^\s*-\s/gm)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("parseStrategySafe", () => {
  const goodJson = JSON.stringify({
    $schema: "trendcraft/strategy",
    version: 1,
    id: "test",
    name: "Test",
    entry: { name: "goldenCross" },
    exit: { name: "deadCross" },
  });

  it("returns ok for a valid strategy with registry", () => {
    const result = parseStrategySafe(goodJson, backtestRegistry);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("test");
  });

  it("returns INVALID_JSON for malformed JSON", () => {
    const result = parseStrategySafe("{not valid json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_JSON");
  });

  it("returns INVALID_SCHEMA for wrong $schema", () => {
    const json = JSON.stringify({ $schema: "other", version: 1 });
    const result = parseStrategySafe(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_SCHEMA");
  });

  it("returns UNSUPPORTED_VERSION for non-1 version", () => {
    const json = JSON.stringify({ $schema: "trendcraft/strategy", version: 99 });
    const result = parseStrategySafe(json);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_VERSION");
  });

  it("returns INVALID_STRUCTURE when registry is given and required fields missing", () => {
    const json = JSON.stringify({ $schema: "trendcraft/strategy", version: 1 });
    const result = parseStrategySafe(json, backtestRegistry);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("INVALID_STRUCTURE");
  });

  it("returns INVALID_CONDITION when registry catches unknown condition", () => {
    const json = JSON.stringify({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "x",
      name: "x",
      entry: { name: "unknownXyz" },
      exit: { name: "deadCross" },
    });
    const result = parseStrategySafe(json, backtestRegistry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CONDITION");
      expect(result.error.message).toMatch(/unknown condition/i);
    }
  });

  it("returns INVALID_SCHEMA for JSON null (must not throw)", () => {
    const result = parseStrategySafe("null");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SCHEMA");
      expect(result.error.message).toMatch(/null/);
    }
  });

  it("returns INVALID_SCHEMA for JSON array", () => {
    const result = parseStrategySafe("[1,2,3]");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SCHEMA");
      expect(result.error.message).toMatch(/array/);
    }
  });

  it("returns INVALID_SCHEMA for JSON primitive", () => {
    const result = parseStrategySafe('"just a string"');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_SCHEMA");
      expect(result.error.message).toMatch(/string/);
    }
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
        sizing: { method: "risk-based", riskPercent: 1 },
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
    expect(result.backtestOptions.sizing).toEqual({ method: "risk-based", riskPercent: 1 });
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
