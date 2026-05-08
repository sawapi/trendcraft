import { describe, expect, it } from "vitest";
import type { ConditionSpec, StrategyJSON } from "../types";
import { applyParamOverrides, flattenStrategyLeaves } from "../walker";

function makeStrategy(entry: ConditionSpec, exit: ConditionSpec): StrategyJSON {
  return {
    $schema: "trendcraft/strategy",
    version: 1,
    id: "test",
    name: "Test",
    entry,
    exit,
  };
}

describe("flattenStrategyLeaves", () => {
  it("returns a single leaf for a leaf-only strategy", () => {
    const strategy = makeStrategy(
      { name: "goldenCross", params: { shortPeriod: 5 } },
      { name: "deadCross" },
    );
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves).toEqual([
      { bucket: "entry", leafIndex: 0, name: "goldenCross", params: { shortPeriod: 5 } },
      { bucket: "exit", leafIndex: 0, name: "deadCross", params: undefined },
    ]);
  });

  it("flattens AND-of-leaves in declaration order", () => {
    const strategy = makeStrategy(
      {
        op: "and",
        conditions: [{ name: "a" }, { name: "b" }, { name: "c" }],
      },
      { name: "x" },
    );
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves.map((l) => `${l.bucket}.${l.leafIndex}.${l.name}`)).toEqual([
      "entry.0.a",
      "entry.1.b",
      "entry.2.c",
      "exit.0.x",
    ]);
  });

  it("flattens nested combinators in depth-first order", () => {
    // and(or(a, b), c) -> [a, b, c]
    const strategy = makeStrategy(
      {
        op: "and",
        conditions: [{ op: "or", conditions: [{ name: "a" }, { name: "b" }] }, { name: "c" }],
      },
      { op: "not", conditions: [{ name: "z" }] },
    );
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves.map((l) => `${l.bucket}.${l.leafIndex}.${l.name}`)).toEqual([
      "entry.0.a",
      "entry.1.b",
      "entry.2.c",
      "exit.0.z",
    ]);
  });

  it("returns shallow-cloned params so caller mutation doesn't reach the input", () => {
    // The walker is documented as a read-only inspection primitive.
    // Returning the live `params` reference would let UIs / deep-link
    // routers silently mutate the source StrategyJSON.
    const strategy = makeStrategy(
      { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
      { name: "x" },
    );
    const leaves = flattenStrategyLeaves(strategy);
    if (!leaves[0].params) throw new Error("expected params on first leaf");
    leaves[0].params.shortPeriod = 999;
    // Original strategy's params object is untouched.
    if (!("name" in strategy.entry)) throw new Error("expected leaf entry spec");
    expect(strategy.entry.params).toEqual({ shortPeriod: 5, longPeriod: 25 });
  });

  it("returns no leaves for an empty `not` (defense in depth)", () => {
    // Malformed `{ op: "not", conditions: [] }` would otherwise blow up
    // with a low-level isLeafSpec(undefined) crash inside collectLeaves.
    // The walker must surface zero leaves so downstream validation can
    // produce a structured error.
    const strategy = makeStrategy({ op: "not", conditions: [] }, { name: "x" });
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves.map((l) => l.name)).toEqual(["x"]);
  });

  it("treats `not` as unary — only walks conditions[0] (mirrors hydration)", () => {
    // Hydration only evaluates `conditions[0]` for `not`. If a malformed
    // strategy passes more children, walking them would expose paths
    // to leaves that never affect the backtest. Walker mirrors hydration
    // so paths are always observable.
    const strategy = makeStrategy(
      {
        op: "not",
        conditions: [{ name: "a" }, { name: "b" }],
      },
      { name: "x" },
    );
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves.map((l) => l.name)).toEqual(["a", "x"]);
  });

  it("handles same-name leaves at different indices", () => {
    // duplicate-name case: rsiBelow appears twice with different params
    const strategy = makeStrategy(
      {
        op: "and",
        conditions: [
          { name: "rsiBelow", params: { threshold: 30 } },
          { name: "rsiBelow", params: { threshold: 25 } },
        ],
      },
      { name: "x" },
    );
    const leaves = flattenStrategyLeaves(strategy);
    expect(leaves[0]).toEqual({
      bucket: "entry",
      leafIndex: 0,
      name: "rsiBelow",
      params: { threshold: 30 },
    });
    expect(leaves[1]).toEqual({
      bucket: "entry",
      leafIndex: 1,
      name: "rsiBelow",
      params: { threshold: 25 },
    });
  });
});

describe("applyParamOverrides", () => {
  const baseStrategy = makeStrategy(
    {
      op: "and",
      conditions: [
        { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
        { name: "rsiBelow", params: { threshold: 30 } },
      ],
    },
    { name: "rsiAbove", params: { threshold: 70 } },
  );

  it("injects values at the addressed leaf", () => {
    const result = applyParamOverrides(baseStrategy, {
      "entry.0.shortPeriod": 10,
      "entry.0.longPeriod": 50,
      "exit.0.threshold": 75,
    });
    const leaves = flattenStrategyLeaves(result);
    expect(leaves[0].params).toEqual({ shortPeriod: 10, longPeriod: 50 });
    expect(leaves[2].params).toEqual({ threshold: 75 });
  });

  it("preserves non-targeted leaves and params", () => {
    const result = applyParamOverrides(baseStrategy, {
      "entry.0.shortPeriod": 10,
    });
    const leaves = flattenStrategyLeaves(result);
    // longPeriod untouched, rsiBelow.threshold untouched, exit untouched
    expect(leaves[0].params).toEqual({ shortPeriod: 10, longPeriod: 25 });
    expect(leaves[1].params).toEqual({ threshold: 30 });
    expect(leaves[2].params).toEqual({ threshold: 70 });
  });

  it("does not mutate the input strategy (purity)", () => {
    const before = JSON.parse(JSON.stringify(baseStrategy));
    applyParamOverrides(baseStrategy, { "entry.0.shortPeriod": 999 });
    expect(baseStrategy).toEqual(before);
  });

  it("throws on a path with an out-of-range leafIndex", () => {
    expect(() => applyParamOverrides(baseStrategy, { "entry.99.shortPeriod": 10 })).toThrow(
      /leaf|index|range/i,
    );
  });

  it("throws on a malformed path", () => {
    expect(() => applyParamOverrides(baseStrategy, { "entry-0.shortPeriod": 10 })).toThrow(
      /path|format/i,
    );
    expect(() => applyParamOverrides(baseStrategy, { "entry.foo.shortPeriod": 10 })).toThrow(
      /path|index/i,
    );
    expect(() => applyParamOverrides(baseStrategy, { "middle.0.shortPeriod": 10 })).toThrow(
      /path|bucket|entry|exit/i,
    );
  });

  it("rejects zero-padded leaf indices (alias canonicalization)", () => {
    // Without this guard, `entry.1.x` and `entry.01.x` would parse
    // to the same canonical leaf but bypass duplicate-path dedup,
    // letting the same leaf get two overrides where the later one
    // silently wins.
    expect(() => applyParamOverrides(baseStrategy, { "entry.01.shortPeriod": 10 })).toThrow(
      /leading zeros/i,
    );
  });

  it("throws on a trailing-dot path (empty paramName)", () => {
    // `"entry.0."` would split into ["entry","0",""] — without an
    // explicit empty-string check the empty paramName would silently
    // inject `{ "": value }` into the leaf.
    expect(() => applyParamOverrides(baseStrategy, { "entry.0.": 10 })).toThrow(
      /paramName.*non-empty/i,
    );
  });

  it("treats `not` as unary in applyParamOverrides too — extra children get no index", () => {
    // Mirror flattenStrategyLeaves: `entry.1.*` paths under a malformed
    // `not([a, b])` must be rejected, not silently rewrite the
    // unreachable `b`.
    const strategy = makeStrategy(
      {
        op: "not",
        conditions: [
          { name: "a", params: { x: 1 } },
          { name: "b", params: { x: 2 } },
        ],
      },
      { name: "x" },
    );
    // Override on `entry.0.x` (the unary head) succeeds.
    const ok = applyParamOverrides(strategy, { "entry.0.x": 99 });
    if (!("op" in ok.entry)) throw new Error("expected combinator");
    const head = ok.entry.conditions[0];
    if (!("name" in head)) throw new Error("expected leaf");
    expect(head.params).toEqual({ x: 99 });
    // Override on `entry.1.x` is rejected — leaf index 1 is out of range
    // because flattenStrategyLeaves only sees one leaf under the not.
    expect(() => applyParamOverrides(strategy, { "entry.1.x": 99 })).toThrow(/leaf|index|range/i);
  });

  it("creates params object when the original leaf had none", () => {
    const strategy = makeStrategy({ name: "leafWithoutParams" }, { name: "x" });
    const result = applyParamOverrides(strategy, {
      "entry.0.injected": 42,
    });
    const leaves = flattenStrategyLeaves(result);
    expect(leaves[0].params).toEqual({ injected: 42 });
  });
});
