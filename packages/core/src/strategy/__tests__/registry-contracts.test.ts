/**
 * What the registry declares must be what hydration needs.
 *
 * Each case below is a spec whose declared schema and its factory disagreed:
 * an enum listing values the factory cannot consume, a scalar type for a param
 * that is really an array, a validator that threw instead of reporting, and a
 * param silently discarded on the way in. The shared failure is that the
 * declaration was not a description of the thing.
 */

import { describe, expect, it } from "vitest";
import {
  BEARISH_HARMONIC_TYPES,
  BULLISH_HARMONIC_TYPES,
  CHANNEL_TYPES,
  FLAG_TYPES,
  HARMONIC_TYPES,
  PATTERN_TYPES,
  TRIANGLE_TYPES,
  WEDGE_TYPES,
} from "../../backtest/conditions/patterns";
import { validateRangePaths } from "../../optimization/strategy-json-factory";
import type { NormalizedCandle } from "../../types";
import { backtestRegistry } from "../registry-backtest";
import { streamingRegistry } from "../registry-streaming";
import { parseStrategySafe } from "../serialize";
import { validateConditionSpec } from "../validate";

/** Combinators are irrelevant to these tests; only the leaf path matters. */
const AND = {
  and: (...c: unknown[]) => ({ type: "and", conditions: c }),
  or: (...c: unknown[]) => ({ type: "or", conditions: c }),
  not: (c: unknown) => ({ type: "not", condition: c }),
};
const btCombinators = AND as unknown as Parameters<typeof backtestRegistry.hydrate>[1];
const stCombinators = AND as unknown as Parameters<typeof streamingRegistry.hydrate>[1];

function candles(count: number): NormalizedCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: Date.UTC(2024, 0, 1 + i),
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    volume: 1000,
  }));
}

describe("pattern params advertise identifiers the detectors know", () => {
  const known = new Set<string>(PATTERN_TYPES);

  it("every pattern-type enum is a subset of the resolvable pattern types", () => {
    // A value outside PATTERN_TYPES finds no detector, so the condition is
    // silently false on every bar — the registry must never advertise one.
    const offenders: string[] = [];
    for (const name of backtestRegistry.names()) {
      const entry = backtestRegistry.get(name);
      if (entry?.category !== "pattern") continue;
      for (const [param, def] of Object.entries(entry.params)) {
        if (def.type !== "string" || !def.enum) continue;
        const bad = def.enum.filter((v) => typeof v !== "string" || !known.has(v));
        if (bad.length > 0) offenders.push(`${name}.${param}: ${JSON.stringify(bad)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the family constants partition the pattern types", () => {
    // Membership alone is not enough: an enum that is merely a SUBSET of the
    // real pattern types passes every check while silently omitting one. A
    // new PatternType must land in exactly one family (or be one of the
    // standalone shapes), or this fails.
    const STANDALONE: string[] = [
      "double_top",
      "double_bottom",
      "head_shoulders",
      "inverse_head_shoulders",
      "cup_handle",
    ];
    const families = [
      TRIANGLE_TYPES,
      WEDGE_TYPES,
      CHANNEL_TYPES,
      FLAG_TYPES,
      HARMONIC_TYPES,
    ] as readonly (readonly string[])[];

    const covered = [...families.flat(), ...STANDALONE];
    expect(covered.length, "a pattern type appears in two families").toBe(new Set(covered).size);
    expect([...covered].sort()).toEqual([...PATTERN_TYPES].sort());
  });

  it("the harmonic halves partition the harmonic family", () => {
    const halves = [...BULLISH_HARMONIC_TYPES, ...BEARISH_HARMONIC_TYPES];
    expect(halves.length).toBe(new Set(halves).size);
    expect([...halves].sort()).toEqual([...HARMONIC_TYPES].sort());
  });

  it("every family's registry enum is the whole family, not a subset of it", () => {
    for (const [entryName, family] of [
      ["triangleDetected", TRIANGLE_TYPES],
      ["wedgeDetected", WEDGE_TYPES],
      ["channelDetected", CHANNEL_TYPES],
      ["flagDetected", FLAG_TYPES],
      ["harmonicPatternDetected", HARMONIC_TYPES],
    ] as const) {
      const declared = backtestRegistry.get(entryName)?.params.subtype.enum;
      expect([...(declared ?? [])].sort()).toEqual([...family].sort());
    }
  });

  it("every pattern-type param is constrained by an enum at all", () => {
    // Without one, any free-form string validates and then finds no detector.
    const freeform: string[] = [];
    for (const name of backtestRegistry.names()) {
      const entry = backtestRegistry.get(name);
      if (entry?.category !== "pattern") continue;
      for (const [param, def] of Object.entries(entry.params)) {
        if (def.type === "string" && !def.enum) freeform.push(`${name}.${param}`);
      }
    }
    expect(freeform).toEqual([]);
  });

  it("accepts the subtype the factory needs and rejects the label it does not", () => {
    // Previously exactly inverted: "symmetrical" validated and was inert,
    // while "triangle_symmetrical" was rejected as not in allowed values.
    const good = validateConditionSpec(
      { name: "triangleDetected", params: { subtype: "triangle_symmetrical" } },
      backtestRegistry,
    );
    expect(good.valid).toBe(true);

    const bad = validateConditionSpec(
      { name: "triangleDetected", params: { subtype: "symmetrical" } },
      backtestRegistry,
    );
    expect(bad.valid).toBe(false);
    expect(bad.errors[0]).toMatch(/not in allowed values/);
  });

  it("hydrates a subtype into a condition named after a real pattern type", () => {
    const condition = backtestRegistry.hydrate(
      { name: "flagDetected", params: { subtype: "bull_flag" } },
      btCombinators,
    ) as { name: string };
    expect(condition.name).toBe("patternDetected(bull_flag)");
  });

  it("no longer offers a harmonic subtype the codebase has no detector for", () => {
    const entry = backtestRegistry.get("harmonicPatternDetected");
    expect(entry?.params.subtype.enum).not.toContain("abcd");
    expect(entry?.params.subtype.enum).toContain("shark_bullish");
  });
});

describe("array-valued params", () => {
  it("validates the array form the factory actually takes", () => {
    const result = validateConditionSpec(
      { name: "perfectOrderBullish", params: { periods: [5, 25, 75] } },
      backtestRegistry,
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects the scalar form that used to validate and then throw at hydrate", () => {
    const result = validateConditionSpec(
      { name: "perfectOrderBullish", params: { periods: 25 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("perfectOrderBullish.periods: expected number[], got number");
  });

  it("reports a wrong element type at its index", () => {
    const result = validateConditionSpec(
      { name: "perfectOrderBullish", params: { periods: [5, "25", 75] } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("perfectOrderBullish.periods[1]: expected number, got string");
  });

  it("enforces the distinct-value minimum the factory actually needs", () => {
    // `[5, 5]` is two items but one period: perfectOrder de-duplicates before
    // it counts, so a length check alone let it through to an evaluate-time
    // throw. `[5]` fails the same rule.
    for (const [periods, distinct] of [
      [[5], 1],
      [[5, 5], 1],
      [[5, 5, 5], 1],
    ] as const) {
      const result = validateConditionSpec(
        { name: "perfectOrderBullish", params: { periods: [...periods] } },
        backtestRegistry,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toBe(
        `perfectOrderBullish.periods: expected at least 2 distinct values, got ${distinct}`,
      );
    }

    // Repeats are fine as long as two distinct lengths survive de-duplication.
    expect(
      validateConditionSpec(
        { name: "perfectOrderBullish", params: { periods: [5, 5, 25] } },
        backtestRegistry,
      ).valid,
    ).toBe(true);
  });

  it("enforces a declared integer element type", () => {
    // `integer` was documented as a UI hint and enforced nowhere, so `5.5`
    // validated and then threw inside the moving average.
    const result = validateConditionSpec(
      { name: "perfectOrderBullish", params: { periods: [5.5, 25] } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("perfectOrderBullish.periods[0]: expected an integer, got 5.5");
  });

  it("enforces a declared integer on a scalar param too", () => {
    const result = validateConditionSpec(
      { name: "goldenCross", params: { shortPeriod: 5.5 } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/expected an integer, got 5.5/);
  });

  it("applies element bounds per element", () => {
    const result = validateConditionSpec(
      { name: "perfectOrderBullish", params: { periods: [5, 0, 75] } },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toBe("perfectOrderBullish.periods[1]: value 0 is below minimum 1");
  });

  it("is rejected as an optimization target with an actionable message", () => {
    // The range gate read `type === "number"` as "scalar number", so an array
    // param passed it and failed much later inside strategy validation.
    expect(() =>
      validateRangePaths(
        {
          $schema: "trendcraft/strategy",
          version: 1,
          id: "s",
          name: "s",
          entry: { name: "perfectOrderBullish" },
          exit: { name: "deadCross" },
        },
        [{ path: "entry.0.periods", min: 5, max: 7, step: 1 }],
        backtestRegistry,
      ),
    ).toThrow(/is type "number\[\]", optimization only supports scalar "number"/);
  });

  it("agrees with hydrate, which is the other half of the contract", () => {
    const spec = { name: "perfectOrderBullish", params: { periods: [5, 25, 75] } };
    expect(validateConditionSpec(spec, backtestRegistry).valid).toBe(true);
    expect(() => backtestRegistry.hydrate(spec, btCombinators)).not.toThrow();
  });

  it("names arrays and null distinctly in scalar type errors", () => {
    // `typeof` calls both "object", which made the message unactionable.
    const arrayForScalar = validateConditionSpec(
      { name: "rsiBelow", params: { threshold: [30] } },
      backtestRegistry,
    );
    expect(arrayForScalar.errors[0]).toMatch(/got array$/);
  });
});

describe("the params container itself", () => {
  it.each([
    ["a number", 42],
    ["null", null],
    ["an array", []],
    ["a string", "x"],
    ["a boolean", true],
  ])("is rejected when it is %s", (_label, params) => {
    // `Object.entries(42)` is `[]`, so an ill-shaped container silently became
    // "no params" and the entry hydrated with its defaults; a string yielded
    // index keys and an error about param "0".
    const result = validateConditionSpec(
      { name: "goldenCross", params: params as never },
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/^goldenCross\.params: expected an object, got /);

    expect(() =>
      backtestRegistry.hydrate({ name: "goldenCross", params: params as never }, btCombinators),
    ).toThrow(/expected an object, got /);
  });

  it("still accepts an omitted params object", () => {
    expect(validateConditionSpec({ name: "goldenCross" }, backtestRegistry).valid).toBe(true);
    expect(() => backtestRegistry.hydrate({ name: "goldenCross" }, btCombinators)).not.toThrow();
  });

  it("still accepts an empty params object", () => {
    const spec = { name: "goldenCross", params: {} };
    expect(validateConditionSpec(spec, backtestRegistry).valid).toBe(true);
    expect(() => backtestRegistry.hydrate(spec, btCombinators)).not.toThrow();
  });
});

describe("a malformed combinator child is reported, not thrown", () => {
  const json = (child: string) =>
    `{"$schema":"trendcraft/strategy","version":1,"id":"s","name":"s",` +
    `"entry":{"op":"and","conditions":[${child},{"name":"rsiBelow"}]},` +
    `"exit":{"name":"deadCross"}}`;

  it.each([
    ["a bare condition name", '"goldenCross"'],
    ["null", "null"],
    ["a number", "42"],
    ["a boolean", "true"],
  ])("returns a Result for %s", (_label, child) => {
    const result = parseStrategySafe(json(child), backtestRegistry);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_CONDITION");
      expect(result.error.message).toMatch(/expected condition object/);
      // The whole path, not just the tail: the recursion hands children a
      // path ending in a separator for the next token to consume, and this
      // branch has no token, so a naive message reads `entry.and[0].:`.
      expect(result.error.message).not.toMatch(/\.:/);
    }
  });

  it("names the offending child by its exact path", () => {
    const result = validateConditionSpec(
      { op: "and", conditions: ["goldenCross", { name: "rsiBelow" }] } as never,
      backtestRegistry,
    );
    expect(result.errors).toEqual(["and[0]: expected condition object, got string"]);
  });

  it("names a top-level non-object without an empty path prefix", () => {
    const result = validateConditionSpec("goldenCross" as never, backtestRegistry);
    expect(result.errors).toEqual(["condition: expected condition object, got string"]);
  });

  it("validateConditionSpec reports rather than throwing", () => {
    const result = validateConditionSpec(
      { op: "or", conditions: [null] } as never,
      backtestRegistry,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/expected condition object, got null/);
  });

  it("hydrate refuses a non-object spec with a readable message", () => {
    expect(() => backtestRegistry.hydrate("goldenCross" as never, btCombinators)).toThrow(
      /expected an object, got string/,
    );
    expect(() => backtestRegistry.hydrate(null as never, btCombinators)).toThrow(
      /expected an object, got null/,
    );
  });

  it("still accepts a well-formed nested combinator", () => {
    const result = parseStrategySafe(json('{"name":"goldenCross"}'), backtestRegistry);
    expect(result.ok).toBe(true);
  });
});

describe("a param the entry does not declare", () => {
  it("is rejected rather than silently discarded", () => {
    // Tuning written for one registry used to stream against another with the
    // tuning quietly dropped.
    expect(() =>
      streamingRegistry.hydrate(
        { name: "volatilityExpanding", params: { threshold: 30, lookback: 10 } },
        stCombinators,
      ),
    ).toThrow(/Unknown parameter\(s\) for "volatilityExpanding": threshold, lookback/);
  });

  it("is rejected even when it is named after an Object.prototype member", () => {
    // `key in entry.params` walks the prototype, so these counted as declared
    // and were dropped, while the validator reported them as
    // "expected undefined, got number".
    for (const key of ["toString", "constructor", "valueOf", "hasOwnProperty"]) {
      expect(() =>
        backtestRegistry.hydrate({ name: "goldenCross", params: { [key]: 1 } }, btCombinators),
      ).toThrow(new RegExp(`Unknown parameter\\(s\\) for "goldenCross": ${key}`));

      const validated = validateConditionSpec(
        { name: "goldenCross", params: { [key]: 1 } },
        backtestRegistry,
      );
      expect(validated.errors).toEqual([`goldenCross.${key}: unknown parameter`]);
    }
  });

  it("names what the entry does accept", () => {
    expect(() =>
      backtestRegistry.hydrate({ name: "rsiBelow", params: { thresold: 30 } }, btCombinators),
    ).toThrow(/Accepted: threshold/);
  });

  it("still hydrates a spec whose params are all declared", () => {
    expect(() =>
      streamingRegistry.hydrate(
        { name: "volatilityExpanding", params: { key: "atr" } },
        stCombinators,
      ),
    ).not.toThrow();
  });

  it("still hydrates a spec with no params at all", () => {
    expect(() => backtestRegistry.hydrate({ name: "goldenCross" }, btCombinators)).not.toThrow();
    expect(candles(3).length).toBe(3);
  });
});
