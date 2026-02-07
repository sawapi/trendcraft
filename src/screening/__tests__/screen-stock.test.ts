import { describe, expect, it } from "vitest";
import type { Condition, NormalizedCandle } from "../../types";
import {
  CONDITION_PRESETS,
  createCriteriaFromNames,
  getAvailableConditions,
  screenStock,
} from "../screen-stock";

// =============================================================================
// Test Helper
// =============================================================================

function createTestCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const candles: NormalizedCandle[] = [];
  const startTime = Date.now() - count * 86400000;
  let price = startPrice;

  for (let i = 0; i < count; i++) {
    const delta = Math.sin(i * 0.3) * 2;
    price = startPrice + delta;
    candles.push({
      time: startTime + i * 86400000,
      open: price - 0.5,
      high: price + 1,
      low: price - 1,
      close: price,
      volume: 1000000 + i * 10000,
    });
  }
  return candles;
}

const alwaysTrue: Condition = () => true;
const alwaysFalse: Condition = () => false;

// =============================================================================
// screenStock
// =============================================================================

describe("screenStock", () => {
  it("should throw when candles array is empty", () => {
    expect(() =>
      screenStock("TEST", [], { entry: alwaysTrue }),
    ).toThrow("No candle data");
  });

  it("should return entrySignal=true for always-true condition", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.entrySignal).toBe(true);
    expect(result.ticker).toBe("TEST");
    expect(result.currentPrice).toBe(candles[candles.length - 1].close);
  });

  it("should return entrySignal=false for always-false condition", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysFalse });
    expect(result.entrySignal).toBe(false);
  });

  it("should return exitSignal=false when no exit criteria", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.exitSignal).toBe(false);
  });

  it("should evaluate exit criteria when provided", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, {
      entry: alwaysTrue,
      exit: alwaysTrue,
    });
    expect(result.exitSignal).toBe(true);
  });

  it("should include candles when includeCandles=true", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue }, { includeCandles: true });
    expect(result.candles).toBeDefined();
    expect(result.candles).toHaveLength(30);
  });

  it("should not include candles by default", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.candles).toBeUndefined();
  });

  it("should compute atrPercent", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(typeof result.atrPercent).toBe("number");
    expect(result.atrPercent).toBeGreaterThanOrEqual(0);
  });

  it("should compute rsi14 metric with enough candles", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.metrics.rsi14).toBeDefined();
    expect(result.metrics.rsi14).toBeGreaterThanOrEqual(0);
    expect(result.metrics.rsi14!).toBeLessThanOrEqual(100);
  });

  it("should have undefined rsi14 with fewer than 14 candles", () => {
    const candles = createTestCandles(10);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    // With only 10 candles, RSI(14) has no valid value at last index
    expect(result.metrics.rsi14).toBeUndefined();
  });

  it("should compute volumeRatio", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.metrics.volumeRatio).toBeDefined();
    expect(result.metrics.volumeRatio).toBeGreaterThan(0);
  });

  it("should set timestamp to latest candle time", () => {
    const candles = createTestCandles(30);
    const result = screenStock("TEST", candles, { entry: alwaysTrue });
    expect(result.timestamp).toBe(candles[candles.length - 1].time);
  });
});

// =============================================================================
// createCriteriaFromNames
// =============================================================================

describe("createCriteriaFromNames", () => {
  it("should create criteria from a single entry name", () => {
    const criteria = createCriteriaFromNames(["goldenCross"]);
    expect(criteria.entry).toBeDefined();
    expect(criteria.name).toBe("goldenCross");
    expect(criteria.exit).toBeUndefined();
  });

  it("should combine multiple entry names with AND", () => {
    const criteria = createCriteriaFromNames(["goldenCross", "volumeAnomaly"]);
    expect(criteria.entry).toBeDefined();
    expect(criteria.name).toBe("goldenCross + volumeAnomaly");
  });

  it("should create exit criteria when exitNames provided", () => {
    const criteria = createCriteriaFromNames(["goldenCross"], ["deadCross"]);
    expect(criteria.exit).toBeDefined();
  });

  it("should throw for unknown condition name", () => {
    expect(() => createCriteriaFromNames(["unknownCondition"])).toThrow(
      'Unknown condition: "unknownCondition"',
    );
  });

  it("should throw for unknown exit condition name", () => {
    expect(() => createCriteriaFromNames(["goldenCross"], ["unknownExit"])).toThrow(
      'Unknown condition: "unknownExit"',
    );
  });
});

// =============================================================================
// CONDITION_PRESETS
// =============================================================================

describe("CONDITION_PRESETS", () => {
  it("should have presets that return valid condition objects", () => {
    const names = Object.keys(CONDITION_PRESETS);
    expect(names.length).toBeGreaterThan(0);

    // Test a few representative presets
    for (const name of names.slice(0, 5)) {
      const factory = CONDITION_PRESETS[name];
      const condition = factory();
      expect(condition).toBeDefined();
      expect(condition.type).toBeDefined();
    }
  });
});

// =============================================================================
// getAvailableConditions
// =============================================================================

describe("getAvailableConditions", () => {
  it("should return list of condition names", () => {
    const names = getAvailableConditions();
    expect(names.length).toBeGreaterThan(0);
    expect(names).toContain("goldenCross");
    expect(names).toContain("rsiBelow30");
    expect(names).toContain("volumeAnomaly");
  });
});
