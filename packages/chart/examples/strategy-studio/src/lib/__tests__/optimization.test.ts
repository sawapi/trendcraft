import type { ParamDef, StrategyJSON } from "trendcraft";
import { describe, expect, it } from "vitest";
import {
  autoDeriveRange,
  combinationCount,
  findIntegerRangeViolation,
  listTunables,
  runGridSearch,
} from "../optimization";
import type { StudioCandle } from "../sample-data";

function makeCandles(n: number): StudioCandle[] {
  return Array.from({ length: n }, (_, i) => {
    const t = 1700000000000 + i * 86400000;
    const wave = Math.sin(i / 8) * 5;
    const drift = i * 0.3;
    const close = 100 + drift + wave;
    return {
      time: t,
      open: close - 0.3,
      high: close + 1.2,
      low: close - 1.2,
      close,
      volume: 1000 + (i % 5) * 60,
    };
  });
}

const GOLDEN_CROSS_DEAD_CROSS: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "test-gc-dc",
  name: "Test GC/DC",
  entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
  exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
};

const ALWAYS_HOLD: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "test-always",
  name: "Always Hold",
  entry: { name: "alwaysTrue" },
  exit: { name: "alwaysFalse" },
};

describe("listTunables", () => {
  it("uses core path syntax (`bucket.leafIndex.paramName`) so keys round-trip through gridSearchFromJSON", () => {
    const tunables = listTunables(GOLDEN_CROSS_DEAD_CROSS);
    const keys = tunables.map((t) => t.key).sort();
    expect(keys).toEqual([
      "entry.0.longPeriod",
      "entry.0.shortPeriod",
      "exit.0.longPeriod",
      "exit.0.shortPeriod",
    ]);
  });

  it("treats omitted registry min as no-lower-bound (regression — CMF threshold default 0)", () => {
    // cmfAbove/cmfBelow declare `threshold: { default: 0 }` with no `min`.
    // Falling back to `min = 1` would auto-derive a 1..2 range and never
    // search around the actual threshold of 0.
    const cmf: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "test-cmf",
      name: "CMF",
      entry: { name: "cmfAbove", params: { threshold: 0 } },
      exit: { name: "cmfBelow", params: { threshold: 0 } },
    };
    const tunables = listTunables(cmf);
    const t = tunables.find((x) => x.paramName === "threshold");
    expect(t?.registryMin).toBe(Number.NEGATIVE_INFINITY);
    expect(t?.currentValue).toBe(0);
  });

  it("flags fractional registry params as non-integer (regression — Bollinger etc.)", () => {
    const bollinger: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "test-bb",
      name: "BB Breakout",
      entry: { name: "bollingerBreakout", params: { period: 20, stdDev: 2 } },
      exit: { name: "bollingerTouch", params: { period: 20, stdDev: 2 } },
    };
    const tunables = listTunables(bollinger);
    const stdDev = tunables.find((t) => t.paramName === "stdDev");
    expect(stdDev?.isInteger).toBe(false);
  });

  it("uses registry default when JSON omits the param", () => {
    const partial: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "partial",
      name: "partial",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    };
    const tunables = listTunables(partial);
    const short = tunables.find((t) => t.key === "entry.0.shortPeriod");
    expect(short?.currentValue).toBe(5); // registry default
  });

  it("returns [] for strategies whose conditions take no params", () => {
    expect(listTunables(ALWAYS_HOLD)).toEqual([]);
  });
});

describe("autoDeriveRange", () => {
  it("respects registry min", () => {
    const range = autoDeriveRange(2, 1);
    expect(range.min).toBeGreaterThanOrEqual(1);
  });

  it("centres around currentValue with reasonable step", () => {
    const range = autoDeriveRange(20, 1);
    expect(range.min).toBeLessThan(20);
    expect(range.max).toBeGreaterThan(20);
    expect(range.step).toBeGreaterThanOrEqual(1);
  });

  it("never produces an empty range (max > min)", () => {
    for (const v of [1, 2, 5, 14, 50, 200]) {
      const r = autoDeriveRange(v, 1);
      expect(r.max).toBeGreaterThan(r.min);
    }
  });

  it("preserves fractional resolution for float params (regression — Bollinger stdDev etc.)", () => {
    const r = autoDeriveRange(2.0, 0.1, false);
    expect(r.step).toBeLessThan(1);
    expect(r.min).toBeGreaterThanOrEqual(0.1);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it("expands range around zero-valued params (regression — CMF threshold = 0)", () => {
    const r = autoDeriveRange(0, Number.NEGATIVE_INFINITY, false);
    expect(r.min).toBeLessThanOrEqual(0);
    expect(r.max).toBeGreaterThan(r.min);
    expect(r.step).toBeGreaterThan(0);
  });

  it("respects negative-allowed registryMin (registryMin = NEGATIVE_INFINITY)", () => {
    const r = autoDeriveRange(-2, Number.NEGATIVE_INFINITY, false);
    expect(r.min).toBeLessThanOrEqual(-2);
    expect(r.max).toBeGreaterThanOrEqual(-2);
  });

  it("scales step with value magnitude — sub-0.1 params reach below 0.1 step (regression)", () => {
    const r = autoDeriveRange(0.02, 0.001, false);
    expect(r.step).toBeLessThan(0.01);
    expect(r.min).toBeGreaterThanOrEqual(0.001);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it("uses ParamDef.precision when annotated (PR-A1 hybrid path)", () => {
    // schema.precision: 1 → step exactly 0.1 regardless of magnitude.
    const schema: ParamDef = { type: "number", default: 2, min: 0.1, precision: 1 };
    const r = autoDeriveRange(2.0, 0.1, false, schema);
    expect(r.step).toBeCloseTo(0.1, 10);
  });

  it("clamps range to ParamDef.suggestedMax when annotated (PR-A1 hybrid path)", () => {
    // currentValue=180, suggestedMax=200 → upper bound shouldn't exceed 200
    // even though magnitude-based heuristic would push to 270.
    const schema: ParamDef = {
      type: "number",
      default: 14,
      min: 1,
      integer: true,
      suggestedMax: 200,
    };
    const r = autoDeriveRange(180, 1, true, schema);
    expect(r.max).toBeLessThanOrEqual(200);
  });

  it("ignores suggestedMax when current value exceeds it (regression — period=500 saved against suggestedMax=200)", () => {
    // suggestedMax is a UI hint, not validation, so persisted strategies
    // can legitimately carry a `period: 500` even when the registry
    // declares `suggestedMax: 200`. The auto-derived range must center
    // around 500 and ignore the hint, otherwise the optimization panel
    // can't search around the user's actual saved value.
    const schema: ParamDef = {
      type: "number",
      default: 14,
      min: 1,
      integer: true,
      suggestedMax: 200,
    };
    const r = autoDeriveRange(500, 1, true, schema);
    expect(r.min).toBeLessThan(500);
    expect(r.max).toBeGreaterThanOrEqual(500);
    expect(r.min).toBeLessThan(r.max);
    expect(r.min).toBeGreaterThanOrEqual(1); // registryMin (hard contract) honoured
    expect(r.step).toBeGreaterThan(0);
  });

  it("ignores suggestedMax for floats too when current exceeds it (regression)", () => {
    const schema: ParamDef = {
      type: "number",
      default: 2,
      min: 0.1,
      precision: 1,
      suggestedMax: 5,
    };
    const r = autoDeriveRange(8, 0.1, false, schema);
    expect(r.min).toBeLessThan(8);
    expect(r.max).toBeGreaterThanOrEqual(8);
    expect(r.min).toBeLessThan(r.max);
    expect(r.min).toBeGreaterThanOrEqual(0.1);
  });

  it("ignores suggestedMin when current value is below it (regression — saved CMF threshold=-5 against suggestedMin=-1)", () => {
    // suggestedMin is a UI hint, not validation. Persisted strategies
    // with threshold=-5 are legal even when the registry annotates
    // suggestedMin=-1, and the auto-derived range must still center
    // around -5 instead of clipping to [-1, -0.99].
    const schema: ParamDef = {
      type: "number",
      default: 0,
      precision: 2,
      suggestedMin: -1,
      suggestedMax: 1,
    };
    const r = autoDeriveRange(-5, Number.NEGATIVE_INFINITY, false, schema);
    expect(r.min).toBeLessThan(-1);
    expect(r.max).toBeGreaterThanOrEqual(-5);
    expect(r.min).toBeLessThan(r.max);
  });

  it("clamps range to ParamDef.suggestedMin when annotated (PR-A1 hybrid path)", () => {
    const schema: ParamDef = {
      type: "number",
      default: 0,
      precision: 2,
      suggestedMin: -1,
      suggestedMax: 1,
    };
    const r = autoDeriveRange(0, Number.NEGATIVE_INFINITY, false, schema);
    expect(r.min).toBeGreaterThanOrEqual(-1);
    expect(r.max).toBeLessThanOrEqual(1);
  });

  it("falls back to heuristic when schema is omitted (backwards compatibility)", () => {
    // Same call shape as the existing 8 heuristic tests above — ensure
    // the new `schema?` arg defaulting to undefined doesn't change behavior.
    const r = autoDeriveRange(20, 1, true);
    expect(r.min).toBeLessThan(20);
    expect(r.max).toBeGreaterThan(20);
    expect(r.step).toBeGreaterThanOrEqual(1);
  });
});

describe("combinationCount", () => {
  it("matches gridSearch's internal counter", () => {
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: 1 }])).toBe(5);
    expect(
      combinationCount([
        { name: "a", min: 1, max: 5, step: 1 },
        { name: "b", min: 10, max: 30, step: 5 },
      ]),
    ).toBe(5 * 5);
  });

  it("returns -1 for invalid ranges instead of throwing (regression)", () => {
    expect(combinationCount([{ name: "a", min: 50, max: 10, step: 1 }])).toBe(-1);
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: 0 }])).toBe(-1);
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: -1 }])).toBe(-1);
  });

  it("agrees with gridSearch's inclusive decimal stepping (regression — float off-by-one)", () => {
    expect(combinationCount([{ name: "a", min: 0, max: 0.3, step: 0.1 }])).toBe(4);
    expect(combinationCount([{ name: "a", min: 1, max: 1.5, step: 0.1 }])).toBe(6);
    expect(combinationCount([{ name: "a", min: 0.1, max: 1.0, step: 0.1 }])).toBe(10);
  });

  it("doesn't enumerate the grid (regression — perf trap on small step)", () => {
    const start = performance.now();
    const result = combinationCount([{ name: "a", min: 0, max: 100, step: 0.000_001 }]);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50);
    expect(result).toBeGreaterThan(10_000);
  });
});

describe("findIntegerRangeViolation", () => {
  it("returns null when ranges are valid", () => {
    const tunables = listTunables(GOLDEN_CROSS_DEAD_CROSS);
    const ranges = [{ name: "entry.0.shortPeriod", min: 5, max: 10, step: 1 }];
    expect(findIntegerRangeViolation(tunables, ranges)).toBeNull();
  });

  it("returns null when integer schema is annotated and range is integer-clean", () => {
    const tunables = listTunables(GOLDEN_CROSS_DEAD_CROSS);
    const ranges = [{ name: "entry.0.shortPeriod", min: 5, max: 7, step: 2 }];
    expect(findIntegerRangeViolation(tunables, ranges)).toBeNull();
  });

  it("flags fractional values when schema.integer is true (annotated)", () => {
    const tunables = listTunables(GOLDEN_CROSS_DEAD_CROSS);
    // goldenCross.shortPeriod is annotated integer:true in core.
    const ranges = [{ name: "entry.0.shortPeriod", min: 5, max: 10, step: 0.5 }];
    const v = findIntegerRangeViolation(tunables, ranges);
    expect(v).not.toBeNull();
    expect(v?.field).toBe("step");
    expect(v?.value).toBe(0.5);
  });

  it("ignores ranges that do not address a known tunable", () => {
    const tunables = listTunables(GOLDEN_CROSS_DEAD_CROSS);
    const ranges = [{ name: "entry.99.bogus", min: 1.5, max: 2.5, step: 0.5 }];
    expect(findIntegerRangeViolation(tunables, ranges)).toBeNull();
  });
});

describe("runGridSearch", () => {
  it("is deterministic — identical inputs produce identical outputs", () => {
    const candles = makeCandles(100);
    const ranges = [
      { name: "entry.0.shortPeriod", min: 3, max: 7, step: 2 },
      { name: "entry.0.longPeriod", min: 20, max: 30, step: 5 },
      { name: "exit.0.shortPeriod", min: 3, max: 7, step: 2 },
      { name: "exit.0.longPeriod", min: 20, max: 30, step: 5 },
    ];
    const a = runGridSearch(candles, GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    const b = runGridSearch(candles, GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.result.bestParams).toEqual(b.result.bestParams);
    expect(a.result.bestScore).toBe(b.result.bestScore);
  });

  it("returns kind:'empty' when 0 tunables (alwaysTrue strategy)", () => {
    const out = runGridSearch(makeCandles(100), ALWAYS_HOLD, [], "returns");
    expect(out.kind).toBe("empty");
  });

  it("returns kind:'empty' when no parameter combinations produce trades", () => {
    const out = runGridSearch(
      makeCandles(40),
      GOLDEN_CROSS_DEAD_CROSS,
      [{ name: "entry.0.shortPeriod", min: 30, max: 35, step: 5 }],
      "returns",
    );
    if (out.kind === "ok") {
      expect(out.result.validCombinations).toBeGreaterThan(0);
    } else {
      expect(out.kind).toBe("empty");
    }
  });

  it("rebuilds bestParams/bestScore/validCombinations after filtering zero-trade rows (regression)", () => {
    const ranges = [
      { name: "entry.0.shortPeriod", min: 5, max: 7, step: 1 },
      { name: "entry.0.longPeriod", min: 6, max: 8, step: 1 },
      { name: "exit.0.shortPeriod", min: 5, max: 5, step: 1 },
      { name: "exit.0.longPeriod", min: 25, max: 25, step: 1 },
    ];
    const out = runGridSearch(makeCandles(120), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (out.kind !== "ok") return;
    const { result } = out;
    expect(result.bestScore).toBe(result.results[0].score);
    expect(result.bestParams).toEqual(result.results[0].params);
    expect(result.validCombinations).toBe(result.results.length);
  });

  it("excludes zero-trade entries from ranked results (regression)", () => {
    const ranges = [
      { name: "entry.0.shortPeriod", min: 5, max: 7, step: 1 },
      { name: "entry.0.longPeriod", min: 6, max: 8, step: 1 },
      { name: "exit.0.shortPeriod", min: 5, max: 5, step: 1 },
      { name: "exit.0.longPeriod", min: 25, max: 25, step: 1 },
    ];
    const out = runGridSearch(makeCandles(120), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (out.kind !== "ok") {
      expect(out.kind).toBe("empty");
      return;
    }
    for (const entry of out.result.results) {
      expect(entry.backtest.trades.length).toBeGreaterThan(0);
    }
  });

  it("returns kind:'empty' when no combination produces any trades (regression)", () => {
    const out = runGridSearch(
      makeCandles(30),
      GOLDEN_CROSS_DEAD_CROSS,
      [
        { name: "entry.0.shortPeriod", min: 50, max: 55, step: 5 },
        { name: "entry.0.longPeriod", min: 56, max: 60, step: 4 },
        { name: "exit.0.shortPeriod", min: 50, max: 55, step: 5 },
        { name: "exit.0.longPeriod", min: 56, max: 60, step: 4 },
      ],
      "returns",
    );
    expect(out.kind).toBe("empty");
  });

  it("forwards strategy.backtest settings to every grid run (regression)", () => {
    const strategyWithSettings: StrategyJSON = {
      ...GOLDEN_CROSS_DEAD_CROSS,
      backtest: { capital: 50_000, stopLoss: 5, takeProfit: 10 },
    };
    const ranges = [
      { name: "entry.0.shortPeriod", min: 5, max: 7, step: 2 },
      { name: "entry.0.longPeriod", min: 25, max: 27, step: 2 },
      { name: "exit.0.shortPeriod", min: 5, max: 7, step: 2 },
      { name: "exit.0.longPeriod", min: 25, max: 27, step: 2 },
    ];
    const out = runGridSearch(makeCandles(120), strategyWithSettings, ranges, "returns");
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}`);
    for (const entry of out.result.results) {
      expect(entry.backtest.initialCapital).toBe(50_000);
      expect(entry.backtest.settings.stopLoss).toBe(5);
      expect(entry.backtest.settings.takeProfit).toBe(10);
    }
  });

  it("returns kind:'error' when combinations exceed core's maxCombinations", () => {
    const ranges = [
      { name: "entry.0.shortPeriod", min: 1, max: 20, step: 1 },
      { name: "entry.0.longPeriod", min: 21, max: 40, step: 1 },
      { name: "exit.0.shortPeriod", min: 1, max: 20, step: 1 },
      { name: "exit.0.longPeriod", min: 21, max: 40, step: 1 },
    ];
    const out = runGridSearch(makeCandles(100), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    expect(out.kind).toBe("error");
  });
});
