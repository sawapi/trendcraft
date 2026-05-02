import type { StrategyJSON } from "trendcraft";
import { describe, expect, it } from "vitest";
import {
  autoDeriveRange,
  combinationCount,
  extractTunableParams,
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

describe("extractTunableParams", () => {
  it("captures every tunable param across entry and exit (PR12 invariant 1)", () => {
    const tunables = extractTunableParams(GOLDEN_CROSS_DEAD_CROSS);
    // entry.shortPeriod, entry.longPeriod, exit.shortPeriod, exit.longPeriod = 4
    expect(tunables).toHaveLength(4);
    const keys = tunables.map((t) => t.key).sort();
    expect(keys).toEqual([
      "entry-0.longPeriod",
      "entry-0.shortPeriod",
      "exit-0.longPeriod",
      "exit-0.shortPeriod",
    ]);
    // Period params are integer-valued — captured by the registry's int default+min.
    for (const t of tunables) expect(t.isInteger).toBe(true);
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
    const tunables = extractTunableParams(cmf);
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
    const tunables = extractTunableParams(bollinger);
    const stdDev = tunables.find((t) => t.paramName === "stdDev");
    expect(stdDev?.isInteger).toBe(false);
  });

  it("returns [] for strategies whose conditions take no params (PR12 invariant 2a)", () => {
    expect(extractTunableParams(ALWAYS_HOLD)).toEqual([]);
  });

  it("safely skips conditions not in the registry (PR12 invariant 2b)", () => {
    const bogus: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "bogus",
      name: "bogus",
      entry: { name: "thisDoesNotExist", params: { p: 1 } },
      exit: { name: "alsoMissing" },
    };
    expect(extractTunableParams(bogus)).toEqual([]);
  });

  it("uses registry default when JSON omits the param", () => {
    const partial: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "partial",
      name: "partial",
      entry: { name: "goldenCross" }, // no params at all
      exit: { name: "deadCross" },
    };
    const tunables = extractTunableParams(partial);
    const short = tunables.find((t) => t.key === "entry-0.shortPeriod");
    expect(short?.currentValue).toBe(5); // registry default
  });
});

describe("autoDeriveRange", () => {
  it("respects registry min (PR12 invariant 3)", () => {
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
    // currentValue=2.0, registryMin=0.1, isInteger=false → step must allow
    // values like 1.5, 2.0, 2.5, not snap everything to integers.
    const r = autoDeriveRange(2.0, 0.1, false);
    expect(r.step).toBeLessThan(1);
    expect(r.min).toBeGreaterThanOrEqual(0.1);
    expect(r.max).toBeGreaterThan(r.min);
  });

  it("expands range around zero-valued params (regression — CMF threshold = 0)", () => {
    // currentValue=0 with no lower bound → range must include 0 and span
    // some non-zero width so optimization actually exercises nearby values.
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
    // For a tolerance default 0.02 with min 0.001, the step must be
    // <= 0.01 so the search space contains values around 0.02 at meaningful
    // resolution. A hard-coded 0.1 floor would coarsen this beyond the
    // useful range.
    const r = autoDeriveRange(0.02, 0.001, false);
    expect(r.step).toBeLessThan(0.01);
    expect(r.min).toBeGreaterThanOrEqual(0.001);
    expect(r.max).toBeGreaterThan(r.min);
  });
});

describe("combinationCount", () => {
  it("matches gridSearch's internal counter (PR12 invariant 4)", () => {
    // For one range [1..5 step 1] = 5 combinations.
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: 1 }])).toBe(5);
    // Two ranges combine multiplicatively.
    expect(
      combinationCount([
        { name: "a", min: 1, max: 5, step: 1 },
        { name: "b", min: 10, max: 30, step: 5 },
      ]),
    ).toBe(5 * 5);
  });

  it("returns -1 for invalid ranges instead of throwing (regression)", () => {
    // The panel calls combinationCount on every keystroke. core's
    // countCombinations throws on max<min or step<=0; we return -1 so the
    // panel can render a validation message rather than unmount.
    expect(combinationCount([{ name: "a", min: 50, max: 10, step: 1 }])).toBe(-1);
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: 0 }])).toBe(-1);
    expect(combinationCount([{ name: "a", min: 1, max: 5, step: -1 }])).toBe(-1);
  });

  it("agrees with gridSearch's inclusive decimal stepping (regression — float off-by-one)", () => {
    // core's getParameterValues walks `min += step while value <= max + ε`,
    // so 0..0.3 step 0.1 yields [0, 0.1, 0.2, 0.3] = 4 values. A naive
    // floor((0.3-0)/0.1)+1 returns 3 because 0.3/0.1 = 2.9999... in fp.
    expect(combinationCount([{ name: "a", min: 0, max: 0.3, step: 0.1 }])).toBe(4);
    expect(combinationCount([{ name: "a", min: 1, max: 1.5, step: 0.1 }])).toBe(6);
    expect(combinationCount([{ name: "a", min: 0.1, max: 1.0, step: 0.1 }])).toBe(10);
  });

  it("doesn't enumerate the grid (regression — perf trap on small step)", () => {
    // core's countCombinations enumerates every value via getParameterValues.
    // For range 0..1 step 0.0001 that's 10,001 entries; on every keystroke
    // before the >10_000 guard fires the panel would lock up. We compute
    // by formula so the call stays O(1) per range.
    const start = performance.now();
    const result = combinationCount([{ name: "a", min: 0, max: 100, step: 0.000_001 }]);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(50); // O(1) per range — should be sub-millisecond
    expect(result).toBeGreaterThan(10_000); // capped by Number.MAX_SAFE_INTEGER fallback
  });
});

describe("runGridSearch", () => {
  it("is deterministic — identical inputs produce identical outputs (PR12 invariant 5)", () => {
    const candles = makeCandles(100);
    const ranges = [
      { name: "entry-0.shortPeriod", min: 3, max: 7, step: 2 },
      { name: "entry-0.longPeriod", min: 20, max: 30, step: 5 },
      { name: "exit-0.shortPeriod", min: 3, max: 7, step: 2 },
      { name: "exit-0.longPeriod", min: 20, max: 30, step: 5 },
    ];
    const a = runGridSearch(candles, GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    const b = runGridSearch(candles, GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (a.kind !== "ok" || b.kind !== "ok") throw new Error("expected ok");
    expect(a.result.bestParams).toEqual(b.result.bestParams);
    expect(a.result.bestScore).toBe(b.result.bestScore);
  });

  it("returns kind:'empty' when 0 tunables (alwaysTrue strategy) (PR12 invariant 8)", () => {
    const out = runGridSearch(makeCandles(100), ALWAYS_HOLD, [], "returns");
    expect(out.kind).toBe("empty");
  });

  it("returns kind:'empty' when no parameter combinations produce trades (PR12 invariant 6)", () => {
    // Tiny slice + tiny ranges → no signals fire → no trades on any combo.
    const out = runGridSearch(
      makeCandles(40),
      GOLDEN_CROSS_DEAD_CROSS,
      [{ name: "entry-0.shortPeriod", min: 30, max: 35, step: 5 }],
      "returns",
    );
    // Either empty (no trades) or ok with valid combinations — both are
    // legitimate; what matters is we don't show bestScore=0 misleadingly.
    if (out.kind === "ok") {
      expect(out.result.validCombinations).toBeGreaterThan(0);
    } else {
      expect(out.kind).toBe("empty");
    }
  });

  it("rebuilds bestParams/bestScore/validCombinations after filtering zero-trade rows (regression)", () => {
    // Same setup as the zero-trade exclusion test — also assert that the
    // summary fields reference a row that's actually still in the table.
    // Otherwise the caption could claim "best 0.00" while the displayed
    // top-N has no such row.
    const ranges = [
      { name: "entry-0.shortPeriod", min: 5, max: 7, step: 1 },
      { name: "entry-0.longPeriod", min: 6, max: 8, step: 1 },
      { name: "exit-0.shortPeriod", min: 5, max: 5, step: 1 },
      { name: "exit-0.longPeriod", min: 25, max: 25, step: 1 },
    ];
    const out = runGridSearch(makeCandles(120), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (out.kind !== "ok") return; // empty case is acceptable
    const { result } = out;
    // bestScore must equal the top row's score; bestParams must match its params.
    expect(result.bestScore).toBe(result.results[0].score);
    expect(result.bestParams).toEqual(result.results[0].params);
    // validCombinations should be the count of rows we actually kept.
    expect(result.validCombinations).toBe(result.results.length);
  });

  it("excludes zero-trade entries from ranked results (regression)", () => {
    // Mix one combo that should produce trades with several that won't,
    // and assert that none of the entries in `result.results` have zero
    // trades — otherwise zero-trade configs would tie with score=0 and
    // pollute the top-N table.
    const ranges = [
      // shortPeriod range overlaps with longPeriod range so some combos are
      // invalid (long <= short → no signals); mixing in a sane combo too.
      { name: "entry-0.shortPeriod", min: 5, max: 7, step: 1 },
      { name: "entry-0.longPeriod", min: 6, max: 8, step: 1 },
      { name: "exit-0.shortPeriod", min: 5, max: 5, step: 1 },
      { name: "exit-0.longPeriod", min: 25, max: 25, step: 1 },
    ];
    const out = runGridSearch(makeCandles(120), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    if (out.kind !== "ok") {
      // Acceptable: if all combos happen to produce zero trades we expect
      // an empty result (also handled by the existing empty-state path).
      expect(out.kind).toBe("empty");
      return;
    }
    for (const entry of out.result.results) {
      expect(entry.backtest.trades.length).toBeGreaterThan(0);
    }
  });

  it("returns kind:'empty' when no combination produces any trades (regression)", () => {
    // 30-bar slice + period range 50..60 → indicators never warm up → 0
    // trades on every combination. Without this guard the panel would show
    // a misleading "best 0.00" ranking instead of an empty state.
    const out = runGridSearch(
      makeCandles(30),
      GOLDEN_CROSS_DEAD_CROSS,
      [
        { name: "entry-0.shortPeriod", min: 50, max: 55, step: 5 },
        { name: "entry-0.longPeriod", min: 56, max: 60, step: 4 },
        { name: "exit-0.shortPeriod", min: 50, max: 55, step: 5 },
        { name: "exit-0.longPeriod", min: 56, max: 60, step: 4 },
      ],
      "returns",
    );
    expect(out.kind).toBe("empty");
  });

  it("forwards strategy.backtest settings to every grid run (regression)", () => {
    // direction, stops, fees etc must reach runBacktest — silently dropping
    // them would optimise against a different ruleset than the user's solo
    // backtest, producing misleading "best" params.
    const strategyWithSettings: StrategyJSON = {
      ...GOLDEN_CROSS_DEAD_CROSS,
      backtest: { capital: 50_000, stopLoss: 5, takeProfit: 10 },
    };
    const ranges = [
      { name: "entry-0.shortPeriod", min: 5, max: 7, step: 2 },
      { name: "entry-0.longPeriod", min: 25, max: 27, step: 2 },
      { name: "exit-0.shortPeriod", min: 5, max: 7, step: 2 },
      { name: "exit-0.longPeriod", min: 25, max: 27, step: 2 },
    ];
    const out = runGridSearch(makeCandles(120), strategyWithSettings, ranges, "returns");
    if (out.kind !== "ok") throw new Error(`expected ok, got ${out.kind}`);
    // Every result's backtest must reflect the strategy's settings.
    for (const entry of out.result.results) {
      expect(entry.backtest.initialCapital).toBe(50_000);
      expect(entry.backtest.settings.stopLoss).toBe(5);
      expect(entry.backtest.settings.takeProfit).toBe(10);
    }
  });

  it("returns kind:'error' when combinations exceed core's maxCombinations (PR12 invariant 7)", () => {
    // Force > 10000 combinations across 4 params.
    const ranges = [
      { name: "entry-0.shortPeriod", min: 1, max: 20, step: 1 }, // 20
      { name: "entry-0.longPeriod", min: 21, max: 40, step: 1 }, // 20
      { name: "exit-0.shortPeriod", min: 1, max: 20, step: 1 }, // 20
      { name: "exit-0.longPeriod", min: 21, max: 40, step: 1 }, // 20
    ];
    // 20^4 = 160,000 — well over the 10k cap.
    const out = runGridSearch(makeCandles(100), GOLDEN_CROSS_DEAD_CROSS, ranges, "returns");
    expect(out.kind).toBe("error");
  });
});
