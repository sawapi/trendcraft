/**
 * Tests for the central `resolveResume` helper and supporting
 * snapshot utilities. These pin the resume contract semantics that
 * every indicator will rely on once migrated in Phase 2.
 */

import { describe, expect, it } from "vitest";
import { buildMeta, type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";

type AlmaParams = {
  period: number;
  offset: number;
  sigma: number;
  source: "close" | "high" | "low" | "hl2";
};

const ALMA_DEFAULTS: AlmaParams = {
  period: 9,
  offset: 0.85,
  sigma: 6,
  source: "close",
};

type AlmaState = { buffer: number[]; count: number };

function snapshot(
  indicator: string,
  version: number,
  params: Record<string, unknown>,
  state: AlmaState,
): IndicatorSnapshot<AlmaState> {
  return { meta: { indicator, version, params: { ...params } }, state };
}

describe("resolveResume", () => {
  describe("fresh start (no fromState)", () => {
    it("returns merged defaults + options with null state", () => {
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: { period: 14 },
        fromState: null,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.state).toBeNull();
      expect(result.reconfigured).toBe(false);
      expect(result.params).toEqual({ ...ALMA_DEFAULTS, period: 14 });
    });

    it("treats undefined fromState identically to null", () => {
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: {},
        fromState: undefined,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.state).toBeNull();
      expect(result.params).toEqual(ALMA_DEFAULTS);
    });
  });

  describe("indicator name guard", () => {
    it("throws when the snapshot was created for a different indicator", () => {
      const fromState = snapshot("frama", 1, ALMA_DEFAULTS, { buffer: [], count: 0 });
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "windowed",
          options: {},
          fromState,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/indicator mismatch/);
    });
  });

  describe("version guard", () => {
    it("throws when the snapshot's version differs from the current version", () => {
      const fromState = snapshot("alma", 0, ALMA_DEFAULTS, { buffer: [], count: 0 });
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "windowed",
          options: {},
          fromState,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/version mismatch/);
    });

    it("treats missing meta as a pre-0.4.0 snapshot and throws", () => {
      const legacyShape = {
        state: { buffer: [], count: 0 },
      } as unknown as IndicatorSnapshot<AlmaState>;
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "windowed",
          options: {},
          fromState: legacyShape,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/pre-0\.4\.0|missing meta/);
    });

    it("throws when meta is present but meta.params is missing (corrupted snapshot)", () => {
      // Defensive case: malformed snapshot loses `meta.params`.
      // Without params we cannot verify resume compatibility — force
      // a re-warm rather than silently continuing with `defaults`,
      // which would let recursive indicators silently resume from
      // state computed under unknown parameters.
      const corrupted = {
        meta: { indicator: "alma", version: 1 },
        state: { buffer: [], count: 0 },
      } as unknown as IndicatorSnapshot<AlmaState>;
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "recursive",
          options: {},
          fromState: corrupted,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/missing meta\.params|cannot verify/);
    });

    it("throws when meta.params is not an object", () => {
      const corrupted = {
        meta: { indicator: "alma", version: 1, params: "not-an-object" },
        state: { buffer: [], count: 0 },
      } as unknown as IndicatorSnapshot<AlmaState>;
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "windowed",
          options: {},
          fromState: corrupted,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/missing|cannot verify|malformed/);
    });

    it("throws when meta.params is an array (typeof []==='object' loophole)", () => {
      // Arrays satisfy `typeof === "object"` but are not param maps;
      // accepting them silently would let recursive indicators resume
      // with `defaults`-derived params and corrupt accumulator state.
      const corrupted = {
        meta: { indicator: "alma", version: 1, params: [] },
        state: { buffer: [], count: 0 },
      } as unknown as IndicatorSnapshot<AlmaState>;
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "recursive",
          options: {},
          fromState: corrupted,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/malformed|missing|cannot verify/);
    });
  });

  describe("matching snapshot — no reconfig", () => {
    it("returns state verbatim when options match snapshot params exactly", () => {
      const state: AlmaState = { buffer: [1, 2, 3], count: 3 };
      const fromState = snapshot("alma", 1, ALMA_DEFAULTS, state);
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: {},
        fromState,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.state).toBe(state);
      expect(result.reconfigured).toBe(false);
      expect(result.params).toEqual(ALMA_DEFAULTS);
    });

    it("uses snapshot params when options omit them", () => {
      const fromState = snapshot(
        "alma",
        1,
        { ...ALMA_DEFAULTS, period: 14 },
        { buffer: [], count: 0 },
      );
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: {},
        fromState,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.params.period).toBe(14);
      expect(result.reconfigured).toBe(false);
    });
  });

  describe("source change — always refuse", () => {
    it("throws for Windowed when source changes", () => {
      const fromState = snapshot("alma", 1, ALMA_DEFAULTS, { buffer: [], count: 0 });
      expect(() =>
        resolveResume({
          indicator: "alma",
          version: 1,
          category: "windowed",
          options: { source: "high" },
          fromState,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/source mismatch/);
    });

    it("throws for Recursive when source changes", () => {
      const fromState = snapshot(
        "ema",
        1,
        { period: 14, source: "close" },
        { buffer: [], count: 0 },
      );
      expect(() =>
        resolveResume({
          indicator: "ema",
          version: 1,
          category: "recursive",
          options: { source: "high" },
          fromState,
          defaults: { period: 14, source: "close" },
        }),
      ).toThrow(/source mismatch/);
    });
  });

  describe("category: windowed", () => {
    it("returns reconfigured=true when a non-source param changes", () => {
      const state: AlmaState = { buffer: [1, 2, 3], count: 3 };
      const fromState = snapshot("alma", 1, ALMA_DEFAULTS, state);
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: { period: 14 },
        fromState,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.state).toBe(state);
      expect(result.reconfigured).toBe(true);
      expect(result.params.period).toBe(14);
    });
  });

  describe("category: event", () => {
    it("returns reconfigured=true when a non-source param changes (events stand regardless)", () => {
      type EventParams = { lookback: number };
      const fromState: IndicatorSnapshot<{ events: number[] }> = {
        meta: { indicator: "bos", version: 1, params: { lookback: 10 } },
        state: { events: [1, 2, 3] },
      };
      const result = resolveResume<EventParams, { events: number[] }>({
        indicator: "bos",
        version: 1,
        category: "event",
        options: { lookback: 20 },
        fromState,
        defaults: { lookback: 10 },
      });

      expect(result.state).toEqual({ events: [1, 2, 3] });
      expect(result.reconfigured).toBe(true);
    });
  });

  describe.each(["recursive", "mixed", "cascaded"] as const)("category: %s", (category) => {
    it(`throws when any non-source param changes`, () => {
      const fromState = snapshot("frama", 1, ALMA_DEFAULTS, { buffer: [], count: 0 });
      expect(() =>
        resolveResume({
          indicator: "frama",
          version: 1,
          category,
          options: { period: 14 },
          fromState,
          defaults: ALMA_DEFAULTS,
        }),
      ).toThrow(/incompatible snapshot/);
    });

    it(`includes "${category}" and the changed key name in the error message`, () => {
      const fromState = snapshot("frama", 1, ALMA_DEFAULTS, { buffer: [], count: 0 });
      let thrown: Error | null = null;
      try {
        resolveResume({
          indicator: "frama",
          version: 1,
          category,
          options: { period: 14 },
          fromState,
          defaults: ALMA_DEFAULTS,
        });
      } catch (err) {
        thrown = err as Error;
      }
      expect(thrown).not.toBeNull();
      expect(thrown!.message).toMatch(new RegExp(category));
      expect(thrown!.message).toMatch(/period/);
    });
  });

  describe("params merge priority", () => {
    it("explicit options override snapshot params; snapshot overrides defaults", () => {
      const fromState = snapshot(
        "alma",
        1,
        { period: 14, offset: 0.5, sigma: 6, source: "close" },
        { buffer: [], count: 0 },
      );
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: { offset: 0.7 },
        fromState,
        defaults: ALMA_DEFAULTS,
      });

      // period 14 comes from snapshot (not defaults' 9)
      expect(result.params.period).toBe(14);
      // offset 0.7 comes from explicit options (not snapshot's 0.5)
      expect(result.params.offset).toBe(0.7);
      // sigma 6 comes from snapshot which matches defaults
      expect(result.params.sigma).toBe(6);
    });

    it("ignores undefined option values (falls back to snapshot)", () => {
      const fromState = snapshot(
        "alma",
        1,
        { period: 14, offset: 0.85, sigma: 6, source: "close" },
        { buffer: [], count: 0 },
      );
      const result = resolveResume({
        indicator: "alma",
        version: 1,
        category: "windowed",
        options: { period: undefined },
        fromState,
        defaults: ALMA_DEFAULTS,
      });

      expect(result.params.period).toBe(14);
      expect(result.reconfigured).toBe(false);
    });
  });
});

describe("buildMeta / makeSnapshot", () => {
  it("buildMeta clones the params object (caller-owned mutations don't leak)", () => {
    const params = { period: 14 };
    const meta = buildMeta("alma", 1, params);
    params.period = 99;
    expect(meta.params).toEqual({ period: 14 });
  });

  it("buildMeta deep-clones nested arrays (composite params stay isolated)", () => {
    // Indicators like Fibonacci pass `levels: number[]`. Mutating the
    // caller's array must not leak into the snapshot.
    const levels = [0.236, 0.382, 0.5, 0.618];
    const params: Record<string, unknown> = { levels };
    const meta = buildMeta("fibRetracement", 1, params);
    levels.push(0.786);
    expect(meta.params).toEqual({ levels: [0.236, 0.382, 0.5, 0.618] });
  });

  it("buildMeta deep-clones nested objects", () => {
    const nested = { foo: 1, bar: { baz: 2 } };
    const params: Record<string, unknown> = { config: nested };
    const meta = buildMeta("custom", 1, params);
    (nested.bar as { baz: number }).baz = 999;
    expect(meta.params).toEqual({ config: { foo: 1, bar: { baz: 2 } } });
  });

  it("makeSnapshot composes the metadata + state envelope", () => {
    const state = { foo: 1 };
    const snap = makeSnapshot("test", 1, { period: 5 }, state);
    expect(snap).toEqual({
      meta: { indicator: "test", version: 1, params: { period: 5 } },
      state: { foo: 1 },
    });
    expect(snap.state).toBe(state);
  });
});

describe("composite param comparison (arrays / objects)", () => {
  it("matching arrays don't trigger reconfig (structural equality)", () => {
    type FibParams = { levels: number[]; source: "close" };
    const defaults: FibParams = { levels: [0.236, 0.382, 0.5, 0.618], source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "fibRetracement",
        version: 1,
        params: { levels: [0.236, 0.382, 0.5, 0.618], source: "close" },
      },
      state: { count: 10 },
    };

    // Caller passes a new array with identical contents.
    const result = resolveResume<FibParams, { count: number }>({
      indicator: "fibRetracement",
      version: 1,
      category: "windowed",
      options: { levels: [0.236, 0.382, 0.5, 0.618] },
      fromState,
      defaults,
    });

    expect(result.reconfigured).toBe(false);
    expect(result.state).toEqual({ count: 10 });
  });

  it("differing array contents trigger reconfig signal", () => {
    type FibParams = { levels: number[]; source: "close" };
    const defaults: FibParams = { levels: [0.236, 0.382, 0.5, 0.618], source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "fibRetracement",
        version: 1,
        params: { levels: [0.236, 0.382, 0.5, 0.618], source: "close" },
      },
      state: { count: 10 },
    };

    const result = resolveResume<FibParams, { count: number }>({
      indicator: "fibRetracement",
      version: 1,
      category: "windowed",
      options: { levels: [0.5, 0.618, 0.786] }, // different
      fromState,
      defaults,
    });

    expect(result.reconfigured).toBe(true);
  });

  it("differing array lengths trigger reconfig signal", () => {
    type FibParams = { levels: number[]; source: "close" };
    const defaults: FibParams = { levels: [0.236, 0.382, 0.5, 0.618], source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "fibRetracement",
        version: 1,
        params: { levels: [0.236, 0.382, 0.5, 0.618], source: "close" },
      },
      state: { count: 10 },
    };

    const result = resolveResume<FibParams, { count: number }>({
      indicator: "fibRetracement",
      version: 1,
      category: "windowed",
      options: { levels: [0.236, 0.382, 0.5] }, // 3 vs 4 elements
      fromState,
      defaults,
    });

    expect(result.reconfigured).toBe(true);
  });

  it("matching arrays in recursive indicators do not throw", () => {
    type Params = { lookback: number[]; period: number; source: "close" };
    const defaults: Params = { lookback: [1, 2, 3], period: 5, source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "mock",
        version: 1,
        params: { lookback: [1, 2, 3], period: 5, source: "close" },
      },
      state: { count: 10 },
    };

    const result = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "recursive",
      options: { lookback: [1, 2, 3] }, // same contents, new array
      fromState,
      defaults,
    });

    expect(result.reconfigured).toBe(false);
  });

  it("nested object params compare structurally", () => {
    type Params = { config: { a: number; b: number }; source: "close" };
    const defaults: Params = { config: { a: 1, b: 2 }, source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "mock",
        version: 1,
        params: { config: { a: 1, b: 2 }, source: "close" },
      },
      state: { count: 10 },
    };

    // Same shape, different reference → no reconfig.
    const same = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "windowed",
      options: { config: { a: 1, b: 2 } },
      fromState,
      defaults,
    });
    expect(same.reconfigured).toBe(false);

    // Changed value → reconfig.
    const diff = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "windowed",
      options: { config: { a: 1, b: 99 } },
      fromState,
      defaults,
    });
    expect(diff.reconfigured).toBe(true);
  });

  it("sparse nested options deep-merge with snapshot params (config.b survives)", () => {
    // Passing `{ config: { a: 99 } }` must not blank out `config.b`
    // from the snapshot. This is the contract for indicators with
    // nested-object params.
    type Params = { config: { a: number; b: number }; source: "close" };
    const defaults: Params = { config: { a: 1, b: 2 }, source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "mock",
        version: 1,
        params: { config: { a: 10, b: 20 }, source: "close" },
      },
      state: { count: 10 },
    };

    const result = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "windowed",
      options: { config: { a: 99 } }, // sparse — only `a` (DeepPartial allows)
      fromState,
      defaults,
    });

    expect(result.params.config).toEqual({ a: 99, b: 20 });
    // The effective `config` differs from the snapshot's by `a`, so
    // the diff detects reconfig and signals carry-forward.
    expect(result.reconfigured).toBe(true);
  });

  it("nested undefined options are skipped (don't blank snapshot values)", () => {
    type Params = { config: { a: number; b: number }; source: "close" };
    const defaults: Params = { config: { a: 1, b: 2 }, source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "mock",
        version: 1,
        params: { config: { a: 10, b: 20 }, source: "close" },
      },
      state: { count: 10 },
    };

    // Caller passes `{ config: { a: undefined } }` — must NOT blank
    // `config.a` to undefined. Must fall back to snapshot's a=10.
    const result = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "windowed",
      options: { config: { a: undefined } },
      fromState,
      defaults,
    });

    expect(result.params.config).toEqual({ a: 10, b: 20 });
    expect(result.reconfigured).toBe(false);
  });

  it("Date params are treated as atomic (not deep-merged into {})", () => {
    type Params = { anchor: Date; source: "close" };
    const oldDate = new Date("2025-01-01T00:00:00Z");
    const newDate = new Date("2025-06-01T00:00:00Z");
    const defaults: Params = { anchor: oldDate, source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "anchoredVwap",
        version: 1,
        params: { anchor: oldDate, source: "close" },
      },
      state: { count: 10 },
    };

    const result = resolveResume<Params, { count: number }>({
      indicator: "anchoredVwap",
      version: 1,
      category: "windowed",
      options: { anchor: newDate },
      fromState,
      defaults,
    });

    // Date must be replaced wholesale, not collapsed to `{}` by the
    // deep-merge recursion.
    expect(result.params.anchor).toBe(newDate);
    expect(result.params.anchor).toBeInstanceOf(Date);
    expect(result.reconfigured).toBe(true);
  });

  it("RegExp params are treated as atomic", () => {
    type Params = { match: RegExp };
    const defaults: Params = { match: /a/ };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: { indicator: "mock", version: 1, params: { match: /a/ } },
      state: { count: 1 },
    };

    const newPattern = /b/;
    const result = resolveResume<Params, { count: number }>({
      indicator: "mock",
      version: 1,
      category: "windowed",
      options: { match: newPattern },
      fromState,
      defaults,
    });

    expect(result.params.match).toBe(newPattern);
    expect(result.params.match).toBeInstanceOf(RegExp);
  });

  it("arrays are replaced wholesale, not deep-merged", () => {
    type Params = { levels: number[]; source: "close" };
    const defaults: Params = { levels: [0.236, 0.382, 0.5], source: "close" };
    const fromState: IndicatorSnapshot<{ count: number }> = {
      meta: {
        indicator: "fib",
        version: 1,
        params: { levels: [0.236, 0.382, 0.5], source: "close" },
      },
      state: { count: 10 },
    };

    // Passing a new array must replace the snapshot's array entirely,
    // not merge element-wise. (Deep-merge into arrays is rarely what
    // the caller wants — they'd just pass the whole array.)
    const result = resolveResume<Params, { count: number }>({
      indicator: "fib",
      version: 1,
      category: "windowed",
      options: { levels: [0.5, 0.618] },
      fromState,
      defaults,
    });
    expect(result.params.levels).toEqual([0.5, 0.618]);
  });
});
