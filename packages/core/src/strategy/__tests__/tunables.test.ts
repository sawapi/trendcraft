import { describe, expect, it } from "vitest";
import { gridSearchFromJSON } from "../../optimization/grid-search-json";
import type { NormalizedCandle } from "../../types";
import { backtestRegistry } from "../registry-backtest";
import { streamingRegistry } from "../registry-streaming";
import { listTunables } from "../tunables";
import type { StrategyJSON } from "../types";

function makeCandles(count: number, startPrice = 100): NormalizedCandle[] {
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

const GOLDEN_CROSS: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "gc",
  name: "Golden Cross",
  entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
  exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
};

const BUY_AND_HOLD: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "bh",
  name: "Buy and Hold",
  entry: { name: "alwaysTrue" },
  exit: { name: "alwaysFalse" },
};

describe("listTunables", () => {
  it("emits one Tunable per numeric registry-declared param", () => {
    const tunables = listTunables(GOLDEN_CROSS);
    const keys = tunables.map((t) => t.key).sort();
    expect(keys).toEqual([
      "entry.0.longPeriod",
      "entry.0.shortPeriod",
      "exit.0.longPeriod",
      "exit.0.shortPeriod",
    ]);
  });

  it("attaches the full registry ParamDef as `schema`", () => {
    const tunables = listTunables(GOLDEN_CROSS);
    const short = tunables.find((t) => t.key === "entry.0.shortPeriod");
    expect(short).toBeDefined();
    if (!short) return;
    // Caller reads typing / bounds / hints directly via schema — no
    // heuristic wrapper.
    expect(short.schema.type).toBe("number");
    expect(short.schema.integer).toBe(true);
    expect(typeof short.schema.default).toBe("number");
    expect(typeof short.schema.min).toBe("number");
  });

  it("identifies each Tunable with bucket, leafIndex, conditionName, paramName", () => {
    const tunables = listTunables(GOLDEN_CROSS);
    const short = tunables.find((t) => t.key === "entry.0.shortPeriod");
    expect(short).toBeDefined();
    if (!short) return;
    expect(short.bucket).toBe("entry");
    expect(short.leafIndex).toBe(0);
    expect(short.conditionName).toBe("goldenCross");
    expect(short.paramName).toBe("shortPeriod");
  });

  it("returns [] for strategies whose conditions take no numeric params", () => {
    expect(listTunables(BUY_AND_HOLD)).toEqual([]);
  });

  it("walks nested AND / OR combinators in depth-first order", () => {
    const strategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "nested",
      name: "Nested",
      entry: {
        op: "and",
        conditions: [
          { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
          {
            op: "or",
            conditions: [
              { name: "rsiBelow", params: { threshold: 30, period: 14 } },
              { name: "rsiAbove", params: { threshold: 70, period: 14 } },
            ],
          },
        ],
      },
      exit: { name: "alwaysFalse" },
    };
    const buckets = listTunables(strategy).map(
      (t) => `${t.bucket}.${t.leafIndex}.${t.conditionName}`,
    );
    expect(buckets).toContain("entry.0.goldenCross");
    expect(buckets).toContain("entry.1.rsiBelow");
    expect(buckets).toContain("entry.2.rsiAbove");
  });

  it("skips registry params marked `tunable: false`", () => {
    // perfectOrder* declares `periods` with `type: "number"` for schema
    // compactness, but the runtime value is `number[]` (the factory
    // calls `periods.join(...)`). listTunables must honor the
    // `tunable: false` opt-out so a UI doesn't seed a scalar grid range
    // for a vector-typed param.
    const strategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "po",
      name: "Perfect Order",
      entry: { name: "perfectOrderBullish" },
      exit: { name: "alwaysFalse" },
    };
    const tunables = listTunables(strategy);
    expect(tunables.find((t) => t.paramName === "periods")).toBeUndefined();
  });

  it("skips leaves whose condition is not in the registry", () => {
    const strategy: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "partial",
      name: "Partial",
      entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
      exit: { name: "neverRegistered" as string },
    };
    const tunables = listTunables(strategy);
    expect(tunables.every((t) => t.bucket === "entry")).toBe(true);
  });

  it("accepts a ConditionRegistry parametrised over any condition type", () => {
    // Compile-time check: listTunables only reads `entry.params` and
    // must accept any registry, not just ConditionRegistry<Condition>.
    // The function call below would not type-check if the registry
    // parameter were pinned to the backtest condition type.
    expect(() => listTunables(BUY_AND_HOLD, streamingRegistry)).not.toThrow();
  });

  it("defaults to `backtestRegistry` when no registry is provided", () => {
    // Both call shapes must produce the same result for the common
    // case — the default exists so non-MTF callers don't have to import
    // and pass the registry every time.
    const withDefault = listTunables(GOLDEN_CROSS);
    const withExplicit = listTunables(GOLDEN_CROSS, backtestRegistry);
    expect(withDefault).toEqual(withExplicit);
  });

  it("PROPERTY: every emitted Tunable.key is accepted as a path by gridSearchFromJSON", () => {
    // Drift gate: the keys listTunables emits must round-trip through
    // gridSearchFromJSON's path validator. If the format ever changes
    // on either side without the other updating, this catches it
    // structurally for every demo + a synthetic nested strategy.
    const syntheticNested: StrategyJSON = {
      $schema: "trendcraft/strategy",
      version: 1,
      id: "synth",
      name: "Synth",
      entry: {
        op: "and",
        conditions: [
          { name: "rsiBelow", params: { threshold: 30, period: 14 } },
          { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
        ],
      },
      exit: { name: "alwaysFalse" },
    };
    const candles = makeCandles(60);
    for (const strategy of [GOLDEN_CROSS, syntheticNested]) {
      for (const tunable of listTunables(strategy)) {
        const minVal = typeof tunable.schema.min === "number" ? tunable.schema.min : 0;
        const range = { path: tunable.key, min: minVal, max: minVal + 1, step: 1 };
        try {
          gridSearchFromJSON(candles, strategy, [range], backtestRegistry, { metric: "returns" });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          expect(
            msg,
            `tunable ${tunable.key}: gridSearchFromJSON rejected path with "${msg}"`,
          ).not.toMatch(/^Invalid range path/);
        }
      }
    }
  });
});
