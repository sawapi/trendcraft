/**
 * Round-trip depth tests for the strategy JSON layer.
 *
 * Pins the contract that `serialize(parse(serialize(s)))` is
 * idempotent across:
 * - all condition shapes (preset leaf, `and`, `or`, `not`)
 * - deep nesting (3-4 levels)
 * - presence and absence of optional fields (`tags`, `metadata`,
 *   `description`, `backtest.*`, `params`)
 * - special characters in `id` / `name` / preset names
 * - empty arrays / empty objects
 *
 * Plus a registry-driven test: every entry in `backtestRegistry`
 * round-trips through default-param hydration → serialize → parse →
 * value equality.
 */

import { describe, expect, it } from "vitest";
import { loadStrategy } from "../hydrate";
import { backtestRegistry } from "../registry-backtest";
import { parseStrategy, serializeStrategy } from "../serialize";
import type { ConditionSpec, StrategyJSON } from "../types";
import { validateConditionSpec, validateStrategyJSON } from "../validate";

function assertIdempotent(strategy: StrategyJSON): void {
  // Top-level structural shape (id / name / entry / exit / backtest …).
  const topLevel = validateStrategyJSON(strategy);
  expect(topLevel).toEqual({ valid: true, errors: [] });

  // Recursive condition-tree validation against the registry. This is
  // the bit that catches malformed combinators like `not` with the
  // wrong arity, unknown preset names, or out-of-range params.
  // `validateStrategyJSON` does NOT recurse into the condition tree,
  // so without this step a fixture like `{ op: "not", conditions: [] }`
  // would silently pass.
  for (const bucket of ["entry", "exit"] as const) {
    const result = validateConditionSpec(strategy[bucket], backtestRegistry);
    expect({
      bucket,
      result,
    }).toEqual({ bucket, result: { valid: true, errors: [] } });
  }

  // The fixture must also hydrate cleanly under the backtest
  // registry — otherwise we are testing the JSON layer in isolation
  // from the consumers that actually run the strategy.
  expect(() => loadStrategy(strategy, backtestRegistry)).not.toThrow();

  const first = serializeStrategy(strategy);
  const reparsed = parseStrategy(first);
  const second = serializeStrategy(reparsed);
  expect(second).toBe(first);
  expect(reparsed).toEqual(strategy);
}

const baseStrategy = (entry: ConditionSpec, exit: ConditionSpec): StrategyJSON => ({
  $schema: "trendcraft/strategy",
  version: 1,
  id: "round-trip-test",
  name: "Round Trip Test",
  entry,
  exit,
});

describe("serialize / parse round-trip — condition shapes", () => {
  it("preset leaf with no params", () => {
    assertIdempotent(baseStrategy({ name: "goldenCross" }, { name: "deadCross" }));
  });

  it("preset leaf with full params", () => {
    assertIdempotent(
      baseStrategy(
        { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
        { name: "rsiAbove", params: { threshold: 70 } },
      ),
    );
  });

  it("and() of two leaves", () => {
    assertIdempotent(
      baseStrategy(
        {
          op: "and",
          conditions: [
            { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
            { name: "rsiBelow", params: { threshold: 30 } },
          ],
        },
        { name: "deadCross" },
      ),
    );
  });

  it("or() of three leaves", () => {
    assertIdempotent(
      baseStrategy(
        {
          op: "or",
          conditions: [
            { name: "goldenCross" },
            { name: "rsiBelow", params: { threshold: 30 } },
            { name: "rsiAbove", params: { threshold: 50 } },
          ],
        },
        { name: "deadCross" },
      ),
    );
  });

  it("not() of a leaf", () => {
    assertIdempotent(
      baseStrategy(
        {
          op: "not",
          conditions: [{ name: "rsiAbove", params: { threshold: 70 } }],
        },
        { name: "deadCross" },
      ),
    );
  });

  it("nested and(or(not(leaf)))", () => {
    assertIdempotent(
      baseStrategy(
        {
          op: "and",
          conditions: [
            { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
            {
              op: "or",
              conditions: [
                { name: "rsiBelow", params: { threshold: 30 } },
                {
                  op: "not",
                  conditions: [{ name: "rsiAbove", params: { threshold: 80 } }],
                },
              ],
            },
          ],
        },
        { name: "deadCross" },
      ),
    );
  });

  it("4-level deep nesting (and(or(and(not(leaf)))))", () => {
    assertIdempotent(
      baseStrategy(
        {
          op: "and",
          conditions: [
            { name: "goldenCross" },
            {
              op: "or",
              conditions: [
                {
                  op: "and",
                  conditions: [
                    { name: "rsiBelow", params: { threshold: 30 } },
                    {
                      op: "not",
                      conditions: [{ name: "rsiAbove", params: { threshold: 70 } }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { name: "deadCross" },
      ),
    );
  });
});

describe("serialize / parse round-trip — optional fields", () => {
  it("strategy without description / tags / metadata", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "minimal",
      name: "Minimal",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });

  it("strategy with empty tags array", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "empty-tags",
      name: "Empty Tags",
      tags: [],
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });

  it("strategy with empty metadata object", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "empty-meta",
      name: "Empty Metadata",
      metadata: {},
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });

  it("strategy with full backtest options", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "full-bt",
      name: "Full BT",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
      backtest: {
        capital: 1_000_000,
        stopLoss: 5,
        takeProfit: 10,
        fillMode: "next-bar-open",
      },
    });
  });

  it("strategy with empty backtest object", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "empty-bt",
      name: "Empty BT",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
      backtest: {},
    });
  });
});

describe("serialize / parse round-trip — special characters", () => {
  it("preserves unicode in id / name / description", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "戦略-α-2026",
      name: "ゴールデンクロス × RSI",
      description: "日本語の説明 — 全角ハイフン / 半角 / emoji 🎯",
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });

  it("preserves quotes / backslashes in description", () => {
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "esc",
      name: "Escapes",
      description: 'Line 1 with "double quotes" and \\backslash\\ — newline\nhere.',
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });

  it("preserves long descriptions and tag arrays", () => {
    const longText = "lorem ipsum ".repeat(50).trim();
    const manyTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    assertIdempotent({
      $schema: "trendcraft/strategy",
      version: 1,
      id: "long",
      name: "Long",
      description: longText,
      tags: manyTags,
      entry: { name: "goldenCross" },
      exit: { name: "deadCross" },
    });
  });
});

describe("serialize / parse round-trip — all backtestRegistry conditions", () => {
  // Build a strategy whose entry/exit each cycle through every
  // registry entry's name with its declared default params. If
  // serialize → parse drops a default param or a nested structure
  // for any specific preset, this loop catches it.
  it("every registered preset round-trips with its default params", () => {
    const entries = backtestRegistry.list();
    expect(entries.length).toBeGreaterThan(20);

    for (const entry of entries) {
      const key = entry.name;
      const params: Record<string, unknown> = {};
      for (const [paramName, schema] of Object.entries(entry.params)) {
        if (schema.default !== undefined) params[paramName] = schema.default;
      }

      const strategy: StrategyJSON = {
        $schema: "trendcraft/strategy",
        version: 1,
        id: `roundtrip-${key}`,
        name: `Round-trip ${key}`,
        entry: Object.keys(params).length > 0 ? { name: key, params } : { name: key },
        exit: { name: "deadCross" },
      };

      const serialized = serializeStrategy(strategy);
      const reparsed = parseStrategy(serialized);
      expect(reparsed).toEqual(strategy);
      expect(serializeStrategy(reparsed)).toBe(serialized);
    }
  });
});
