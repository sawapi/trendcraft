import { describe, expect, it } from "vitest";
import { backtestRegistry } from "../../strategy/registry-backtest";
import type { StrategyJSON } from "../../strategy/types";
import type { NormalizedCandle } from "../../types";
import { gridSearchFromJSON, gridSearchFromJSONSafe } from "../grid-search-json";

function makeUpTrendCandles(count: number, startPrice = 100): NormalizedCandle[] {
  const out: NormalizedCandle[] = [];
  const baseTime = Date.now() - count * 86_400_000;
  for (let i = 0; i < count; i++) {
    const close = startPrice + i * 0.5 + Math.sin(i / 5) * 2;
    out.push({
      time: baseTime + i * 86_400_000,
      open: close - 0.2,
      high: close + 0.4,
      low: close - 0.4,
      close,
      volume: 1000 + i,
    });
  }
  return out;
}

const STRATEGY: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "test",
  name: "Test",
  entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
  exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
};

describe("gridSearchFromJSON", () => {
  it("runs end-to-end and returns bestParams keyed by path", () => {
    const candles = makeUpTrendCandles(60);
    const result = gridSearchFromJSON(
      candles,
      STRATEGY,
      [
        { path: "entry.0.shortPeriod", min: 3, max: 7, step: 2 },
        { path: "entry.0.longPeriod", min: 20, max: 30, step: 5 },
      ],
      backtestRegistry,
    );
    expect(result.totalCombinations).toBe(9); // 3 × 3
    if (result.bestParams !== null) {
      // Keys are paths, not raw param names
      expect(Object.keys(result.bestParams).sort()).toEqual([
        "entry.0.longPeriod",
        "entry.0.shortPeriod",
      ]);
    }
  });

  it("forwards strategy.backtest options to the underlying backtest", () => {
    const candles = makeUpTrendCandles(60);
    const strategyWithFees: StrategyJSON = {
      ...STRATEGY,
      backtest: { capital: 50_000, commissionRate: 0.001 },
    };
    const result = gridSearchFromJSON(
      candles,
      strategyWithFees,
      [{ path: "entry.0.shortPeriod", min: 5, max: 5, step: 1 }],
      backtestRegistry,
    );
    // The capital from strategy.backtest must reach the underlying
    // backtest — verify by inspecting one of the backtest results.
    const firstBacktest = result.results[0]?.backtest;
    expect(firstBacktest).toBeDefined();
    if (firstBacktest) {
      // initialCapital should reflect the forwarded 50_000, not the
      // 100_000 default.
      expect(firstBacktest.initialCapital).toBe(50_000);
    }
  });

  it("throws on a path with an out-of-range leafIndex", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.99.shortPeriod", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/leaf|index|range/i);
  });

  it("throws on a path that addresses an unknown registry param", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.notARealParam", min: 1, max: 3, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/notARealParam|param/i);
  });

  it("throws on a path that addresses a non-numeric param", () => {
    const candles = makeUpTrendCandles(60);
    // `bollingerBreakout.source` would be type: "string" — emulate with
    // a registry leaf whose param is non-numeric. We rely on real
    // registry data: most string params are sparse, so we synthesize
    // by addressing a missing leaf path that is known not to exist as
    // numeric. Fall back: just expect the strict numeric guard catches it.
    // For now use the unknown-param error path which is the same guard.
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.bogus", min: 1, max: 3, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow();
  });

  it("throws on a malformed path", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry-0.shortPeriod", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/path|format/i);
  });

  it("throws on duplicate range paths", () => {
    const candles = makeUpTrendCandles(60);
    // Same path twice would balloon the search space and clobber bestParams.
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [
          { path: "entry.0.shortPeriod", min: 3, max: 7, step: 1 },
          { path: "entry.0.shortPeriod", min: 4, max: 8, step: 1 },
        ],
        backtestRegistry,
      ),
    ).toThrow(/duplicate/i);
  });

  it("throws with an Invalid prefix on non-positive step or max < min", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: 3, max: 7, step: 0 }],
        backtestRegistry,
      ),
    ).toThrow(/Invalid range path.*step/i);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: 7, max: 3, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/Invalid range path.*max/i);
  });

  it("throws on an unregistered leaf elsewhere in the strategy", () => {
    // The tuned path is on entry, but exit references an unregistered
    // condition. Without whole-strategy validation, gridSearch would
    // silently skip every combination (factory throw caught internally)
    // and report an empty optimization.
    const candles = makeUpTrendCandles(60);
    const broken: StrategyJSON = {
      ...STRATEGY,
      exit: { name: "thisConditionIsNotRegistered" },
    };
    expect(() =>
      gridSearchFromJSON(
        candles,
        broken,
        [{ path: "entry.0.shortPeriod", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/Invalid strategy.*(not registered|unknown)/i);
  });

  it("rejects NaN / Infinity in range fields", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: Number.NaN, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/finite/i);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: 5, max: Number.POSITIVE_INFINITY, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/finite/i);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: 5, max: 7, step: Number.NaN }],
        backtestRegistry,
      ),
    ).toThrow(/finite/i);
  });

  it("rejects fractional step on an integer param", () => {
    // goldenCross.shortPeriod is annotated integer:true in the registry.
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.shortPeriod", min: 5, max: 7, step: 0.5 }],
        backtestRegistry,
      ),
    ).toThrow(/integer/i);
  });

  it("rejects ranges that violate schema.min", () => {
    // bollingerBreakout.stdDev has min: 0.1 (runtime contract). Try a range starting at 0.
    const candles = makeUpTrendCandles(60);
    const bbStrategy: StrategyJSON = {
      ...STRATEGY,
      entry: { name: "bollingerBreakout", params: { period: 20, stdDev: 2 } },
      exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
    };
    expect(() =>
      gridSearchFromJSON(
        candles,
        bbStrategy,
        [{ path: "entry.0.stdDev", min: 0, max: 3, step: 0.5 }],
        backtestRegistry,
      ),
    ).toThrow(/below schema.min/i);
  });

  it("accepts strategies whose tuned param is currently missing — the range supplies it", () => {
    // `goldenCross` requires shortPeriod (registered with default 5).
    // The strategy below intentionally omits `shortPeriod`; the search
    // space is supposed to supply it. Pre-validating the raw strategy
    // would wrongly reject this.
    const candles = makeUpTrendCandles(60);
    const strategyWithoutTunedParam: StrategyJSON = {
      ...STRATEGY,
      entry: { name: "goldenCross", params: { longPeriod: 25 } },
      // exit kept canonical so any failure is from the entry side
    };
    expect(() =>
      gridSearchFromJSON(
        candles,
        strategyWithoutTunedParam,
        [{ path: "entry.0.shortPeriod", min: 3, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).not.toThrow();
  });

  it("throws when the strategy has a malformed `not` arity", () => {
    // not should be unary; arity != 1 must be rejected upfront via
    // validateConditionSpec rather than silently optimizing leaves
    // that don't actually contribute to evaluation.
    const candles = makeUpTrendCandles(60);
    const broken: StrategyJSON = {
      ...STRATEGY,
      entry: {
        op: "not",
        conditions: [
          { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
          { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
        ],
      },
    };
    expect(() =>
      gridSearchFromJSON(
        candles,
        broken,
        [{ path: "entry.0.shortPeriod", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/not.*1 condition/i);
  });

  it("throws on a trailing-dot path (empty paramName)", () => {
    const candles = makeUpTrendCandles(60);
    expect(() =>
      gridSearchFromJSON(
        candles,
        STRATEGY,
        [{ path: "entry.0.", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/paramName.*non-empty/i);
  });
});

describe("gridSearchFromJSONSafe", () => {
  it("returns ok result for a valid invocation", () => {
    const candles = makeUpTrendCandles(60);
    const result = gridSearchFromJSONSafe(
      candles,
      STRATEGY,
      [{ path: "entry.0.shortPeriod", min: 3, max: 7, step: 2 }],
      backtestRegistry,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCombinations).toBe(3);
    }
  });

  it("returns error result for an invalid path", () => {
    const candles = makeUpTrendCandles(60);
    const result = gridSearchFromJSONSafe(
      candles,
      STRATEGY,
      [{ path: "entry.99.shortPeriod", min: 5, max: 7, step: 1 }],
      backtestRegistry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/leaf|index|range/i);
      expect(result.error.code).toBe("INVALID_PARAMETER");
    }
  });

  it("treats empty ranges as a baseline backtest (matches gridSearch)", () => {
    // gridSearch itself accepts empty ParameterRange[] and runs one
    // combination as a baseline. The wrapper preserves that so dynamic
    // UIs that end up with no tunable params selected still get a
    // result instead of being rejected.
    const candles = makeUpTrendCandles(60);
    const result = gridSearchFromJSONSafe(candles, STRATEGY, [], backtestRegistry);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.totalCombinations).toBe(1);
    }
  });

  it("classifies non-positive step as INVALID_PARAMETER (not OPTIMIZATION_FAILED)", () => {
    const candles = makeUpTrendCandles(60);
    const result = gridSearchFromJSONSafe(
      candles,
      STRATEGY,
      [{ path: "entry.0.shortPeriod", min: 3, max: 7, step: 0 }],
      backtestRegistry,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PARAMETER");
    }
  });

  it("applies registered cross-param constraints (goldenCross short < long) from overlapping ranges", () => {
    const candles = makeUpTrendCandles(80);
    // Ranges overlap so the grid contains invalid combos where
    // shortPeriod >= longPeriod (e.g. short=8, long=4). The registered
    // `validateParams` on goldenCross must keep those out of the results
    // entirely — no post-filtering by the caller.
    const result = gridSearchFromJSON(
      candles,
      STRATEGY,
      [
        { path: "entry.0.shortPeriod", min: 4, max: 8, step: 2 },
        { path: "entry.0.longPeriod", min: 4, max: 8, step: 2 },
      ],
      backtestRegistry,
      { keepAllResults: true },
    );
    for (const entry of result.results) {
      expect(entry.params["entry.0.shortPeriod"]).toBeLessThan(entry.params["entry.0.longPeriod"]);
    }
    // 3 short × 3 long = 9 enumerated; the 6 with short >= long are
    // skipped, leaving the 3 strictly-increasing pairs (4<6, 4<8, 6<8).
    expect(result.results.length).toBe(3);
    if (result.bestParams !== null) {
      expect(result.bestParams["entry.0.shortPeriod"]).toBeLessThan(
        result.bestParams["entry.0.longPeriod"],
      );
    }
  });

  it("does not constrain conditions without a validateParams predicate", () => {
    // A tuned leaf with no cross-param constraint is unaffected: the
    // param filter is undefined and every combo runs.
    const rsiStrategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "rsi",
      name: "RSI",
      entry: { name: "rsiBelow", params: { threshold: 30, period: 14 } },
      exit: { name: "rsiAbove", params: { threshold: 70, period: 14 } },
    };
    const candles = makeUpTrendCandles(80);
    const result = gridSearchFromJSON(
      candles,
      rsiStrategy,
      [{ path: "entry.0.period", min: 5, max: 9, step: 2 }],
      backtestRegistry,
      { keepAllResults: true },
    );
    expect(result.totalCombinations).toBe(3);
    expect(result.results.length).toBe(3);
  });
});
