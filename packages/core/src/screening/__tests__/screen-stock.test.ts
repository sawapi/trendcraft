import { afterEach, describe, expect, it, vi } from "vitest";
import { deadCross, goldenCross, mtfPriceAboveSma } from "../../backtest/conditions";
import type { Condition, NormalizedCandle } from "../../types";
import {
  CONDITION_PRESETS,
  createCriteriaFromNames,
  getAvailableConditions,
  screenStock,
  screenStockSeries,
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
    expect(() => screenStock("TEST", [], { entry: alwaysTrue })).toThrow("No candle data");
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
// screenStockSeries
// =============================================================================

describe("screenStockSeries", () => {
  it("returns one point per candle, echoing the ticker and bar metadata", () => {
    const candles = createTestCandles(30);
    const { ticker, points } = screenStockSeries("TEST", candles, { entry: alwaysTrue });
    expect(ticker).toBe("TEST");
    expect(points).toHaveLength(candles.length);
    points.forEach((p, i) => {
      expect(p.index).toBe(i);
      expect(p.time).toBe(candles[i].time);
      expect(p.close).toBe(candles[i].close);
    });
  });

  it("evaluates the entry condition at every bar", () => {
    const candles = createTestCandles(30);
    expect(
      screenStockSeries("TEST", candles, { entry: alwaysTrue }).points.every((p) => p.entrySignal),
    ).toBe(true);
    expect(
      screenStockSeries("TEST", candles, { entry: alwaysFalse }).points.some((p) => p.entrySignal),
    ).toBe(false);
  });

  it("reflects per-bar data, not just the latest bar", () => {
    const candles = createTestCandles(30); // close oscillates around 100
    const aboveHundred: Condition = (_ind, candle) => candle.close > 100;
    const { points } = screenStockSeries("TEST", candles, { entry: aboveHundred });
    // Each bar's signal matches that bar's own close, and both states occur.
    points.forEach((p, i) => {
      expect(p.entrySignal).toBe(candles[i].close > 100);
    });
    expect(points.some((p) => p.entrySignal)).toBe(true);
    expect(points.some((p) => !p.entrySignal)).toBe(true);
  });

  it("reports exitSignal=false at every bar when no exit criteria", () => {
    const candles = createTestCandles(30);
    const { points } = screenStockSeries("TEST", candles, { entry: alwaysTrue });
    expect(points.every((p) => p.exitSignal === false)).toBe(true);
  });

  it("agrees with screenStock on the latest bar (faithful generalization)", () => {
    const candles = createTestCandles(60);
    const criteria = { entry: goldenCross(5, 25), exit: deadCross(5, 25) };
    const series = screenStockSeries("TEST", candles, criteria);
    const latest = screenStock("TEST", candles, criteria);
    const last = series.points[series.points.length - 1];
    expect(last.index).toBe(candles.length - 1);
    expect(last.entrySignal).toBe(latest.entrySignal);
    expect(last.exitSignal).toBe(latest.exitSignal);
  });

  it("returns an empty point list for empty candles", () => {
    expect(screenStockSeries("TEST", [], { entry: alwaysTrue })).toEqual({
      ticker: "TEST",
      points: [],
    });
  });
});

// =============================================================================
// MTF screening
// =============================================================================

describe("MTF screening", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Six Mon-Fri trading weeks (2024-01-01 is a Monday), steady uptrend so the
  // weekly close climbs above its 2-week SMA once enough weeks have closed.
  function weeklyUptrendCandles(): NormalizedCandle[] {
    const MS_PER_DAY = 86400000;
    const candles: NormalizedCandle[] = [];
    let mondayStart = Date.parse("2024-01-01T00:00:00Z");
    let price = 100;
    for (let week = 0; week < 6; week++) {
      for (let day = 0; day < 5; day++) {
        price += 2;
        candles.push({
          time: mondayStart + day * MS_PER_DAY,
          open: price,
          high: price + 1,
          low: price - 1,
          close: price,
          volume: 1000,
        });
      }
      mondayStart += 7 * MS_PER_DAY;
    }
    return candles;
  }

  const weeklyCriteria = { entry: mtfPriceAboveSma("1w", 2) };

  it("evaluates MTF conditions when mtfTimeframes is provided (screenStockSeries)", () => {
    const candles = weeklyUptrendCandles();
    const { points } = screenStockSeries("TEST", candles, weeklyCriteria, {
      mtfTimeframes: ["1w"],
    });
    // In a sustained weekly uptrend, the condition fires on at least some bars.
    expect(points.some((p) => p.entrySignal)).toBe(true);
  });

  it("cannot evaluate MTF conditions without mtfTimeframes (resolves to false)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const candles = weeklyUptrendCandles();
    const { points } = screenStockSeries("TEST", candles, weeklyCriteria);
    expect(points.every((p) => p.entrySignal === false)).toBe(true);
    expect(warn).toHaveBeenCalled();
  });

  it("evaluates MTF conditions on the latest bar (screenStock)", () => {
    const candles = weeklyUptrendCandles();
    const withMtf = screenStock("TEST", candles, weeklyCriteria, { mtfTimeframes: ["1w"] });
    expect(withMtf.entrySignal).toBe(true);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const withoutMtf = screenStock("TEST", candles, weeklyCriteria);
    expect(withoutMtf.entrySignal).toBe(false);
    expect(warn).toHaveBeenCalled();
  });

  it("latest-bar screenStock agrees with the last series point under MTF", () => {
    const candles = weeklyUptrendCandles();
    const latest = screenStock("TEST", candles, weeklyCriteria, { mtfTimeframes: ["1w"] });
    const series = screenStockSeries("TEST", candles, weeklyCriteria, { mtfTimeframes: ["1w"] });
    expect(series.points[series.points.length - 1].entrySignal).toBe(latest.entrySignal);
  });

  it("resolves a condition's alias timeframe against a canonical mtfTimeframes value", () => {
    const candles = weeklyUptrendCandles();
    // Condition asks for "weekly"; context is requested as the canonical "1w".
    const aliasCriteria = { entry: mtfPriceAboveSma("weekly", 2) };
    const { points } = screenStockSeries("TEST", candles, aliasCriteria, {
      mtfTimeframes: ["1w"],
    });
    expect(points.some((p) => p.entrySignal)).toBe(true);
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
      expect(typeof condition === "object" && "type" in condition && condition.type).toBeDefined();
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
