/**
 * `describeContract` — a test DSL that generates the seven resume /
 * peek / warmup invariants for every indicator that opts into the
 * State Contract.
 *
 * Usage (Phase 2, once an indicator is migrated):
 * ```ts
 * import { describeContract } from "../__tests__/contract-helper";
 *
 * describeContract({
 *   name: "alma",
 *   create: (opts, warmUp) => createAlma(opts, warmUp),
 *   category: "windowed",
 *   version: 1,
 *   defaultParams: { period: 9, offset: 0.85, sigma: 6, source: "close" },
 *   reconfigParams: [{ period: 14 }],
 *   sourceVariants: ["close", "high"],
 *   makeCandles,
 * });
 * ```
 *
 * Generates these tests:
 * 1. Round-trip identity (`getState → fromState` reproduces series)
 * 2. Indicator name guard (foreign snapshot throws)
 * 3. Version mismatch (throw)
 * 4. Reconfig — windowed: new options produce series equivalent to
 *    fresh `create(newOptions)` over the same history (after warmup)
 * 5. Reconfig refuse — recursive/mixed/cascaded: any param change throws
 * 6. peek consistency (`peek` matches `next`, doesn't mutate state)
 * 7. Warmup gate consistency (`next` / `peek` / `isWarmedUp` align)
 * 8. Batch/incremental parity (optional, requires `batchCompute`):
 *    feeding the same candles to the incremental indicator and the
 *    batch counterpart yields the same value series.
 *
 * Phase 1 skeleton: the full implementation is intentionally kept
 * minimal here. Per-indicator nuances (custom equality, post-warmup
 * tolerance, etc.) will be added as Phase 2 surfaces them.
 */

import { describe, expect, it } from "vitest";
import type { NormalizedCandle } from "../../../types";
import type { IndicatorSnapshot, StateCategory } from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Caller-side contract: any indicator under test must accept these
 * shapes for `create`. This intentionally mirrors the new
 * `IndicatorSnapshot<TState>` wire format from `state-contract.ts`.
 */
export type ContractCreate<TValue, TState> = (
  options: Record<string, unknown>,
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<TState>;
    warmUp?: NormalizedCandle[];
  },
) => IncrementalIndicator<TValue, IndicatorSnapshot<TState>>;

export type ContractConfig<TValue, TState> = {
  /** Indicator name (matches `meta.indicator`). */
  name: string;
  /** Factory under test. */
  create: ContractCreate<TValue, TState>;
  /** Resume category. */
  category: StateCategory;
  /** Current schema version. */
  version: number;
  /** Canonical default params. */
  defaultParams: Record<string, unknown>;
  /**
   * Sample reconfig param overrides for category-specific tests.
   * For windowed: tests reconfig-with-carry-forward.
   * For recursive/mixed/cascaded: tests reconfig refuse.
   * Caller can pass empty array to skip these tests.
   */
  reconfigParams: Record<string, unknown>[];
  /**
   * Candle generator used for all tests. The same input feeds every
   * invariant so a single dataset surfaces edge cases consistently.
   */
  makeCandles: (n: number) => NormalizedCandle[];
  /**
   * Number of candles to use for round-trip / peek tests.
   * Default 200. Increase for indicators with long warm-ups
   * (e.g., default rocPeriod=100 for Connors RSI).
   */
  streamLength?: number;
  /**
   * Tolerance for value equality when comparing two series produced
   * by independent runs. Default 1e-10 (essentially exact). Loosen
   * for indicators that have non-deterministic FP ordering.
   */
  tolerance?: number;
  /**
   * How many post-resume bars to skip before comparing the windowed
   * resumed series against a fresh series in invariant [4]. Receives
   * the merged `newOptions` so it can derive the right margin from
   * whatever shape param the indicator uses.
   *
   * Defaults to `newOpts.period` when that is a finite number, falling
   * back to 0 otherwise. Indicators whose warm-up is governed by
   * something other than `period` (e.g., swing points'
   * `leftBars + rightBars`) must override this.
   */
  reconfigMargin?: (newOpts: Record<string, unknown>) => number;
  /**
   * Batch counterpart for invariant [8] (batch/incremental parity).
   *
   * Takes the same `options` and `candles` as the incremental
   * indicator and returns the expected value series, **one entry per
   * candle** in input order. Entries should be `null` for any bar
   * where the incremental indicator emits null (warmup period).
   *
   * Most batch indicators in this package return `Series<T>` with the
   * same length as the candle stream and null values during warmup,
   * so the typical implementation is a one-liner:
   *
   *     batchCompute: (opts, candles) =>
   *       smaBatch(candles, opts as { period?: number }).map(s => s.value)
   *
   * Indicators whose batch sibling uses a different alignment
   * (e.g., `ewmaVolatilityFromCandles` returns one entry per *return*,
   * skipping candle 0, and uses a non-causal lookahead seed) must
   * pad / mask explicitly so the returned series is candle-aligned
   * and null-matched to the incremental output.
   *
   * Migration policy: every `describeContract` entry whose indicator
   * has a batch counterpart MUST supply `batchCompute` so the parity
   * regression net stays in place. Omit only when no batch
   * implementation exists for the indicator.
   */
  batchCompute?: (options: Record<string, unknown>, candles: NormalizedCandle[]) => unknown[];
  /**
   * Tolerance override for invariant [8]. Falls back to `tolerance`
   * (then 1e-10). Loosen only when floating-point summation order
   * produces deterministic-but-tiny drift between batch and
   * incremental — never to paper over algorithmic divergence.
   */
  consistencyTolerance?: number;
  /**
   * Custom "is this value the indicator's warmup gate?" predicate for
   * invariant [7].
   *
   * The default (`isNullishValue`) treats a composite as null only
   * when *every* present field is null/undefined. That's fine for
   * indicators whose components warm up together (Donchian, BB, MACD
   * variants with shared period). It breaks for indicators with
   * *decoupled component warmup* — e.g., a hypothetical MACD where
   * `macd` becomes non-null at `slowPeriod` but `signal` waits an
   * additional `signalPeriod` bars: the default predicate would
   * report "warmed up" the moment `macd` arrives, conflating with
   * the indicator's own `isWarmedUp` getter (which usually waits for
   * all components).
   *
   * Pass a predicate that returns `true` for any bar the indicator
   * considers "still in warmup". The DSL then asserts `next`/`peek`
   * agreement against this predicate instead of the all-null
   * heuristic, and `isWarmedUp` against the first bar where the
   * predicate returns `false`.
   *
   * Only override when the default is wrong; otherwise omit.
   */
  isNullishField?: (value: unknown) => boolean;
};

/**
 * Run the seven State Contract invariants against an indicator.
 *
 * Each generated test is a `it(...)` inside the parent `describe`, so
 * standard vitest filtering (`--run name pattern`) works.
 */
export function describeContract<TValue, TState>(config: ContractConfig<TValue, TState>): void {
  const streamLength = config.streamLength ?? 200;
  const tolerance = config.tolerance ?? 1e-10;
  const candles = config.makeCandles(streamLength);

  describe(`State Contract: ${config.name}`, () => {
    it("[1] round-trip identity: getState → fromState reproduces the series", () => {
      const splitIdx = Math.floor(streamLength / 2);

      const reference = config.create({ ...config.defaultParams });
      const valuesReference: unknown[] = [];
      for (const c of candles) {
        valuesReference.push(reference.next(c).value);
      }

      const stage1 = config.create({ ...config.defaultParams });
      for (let i = 0; i < splitIdx; i++) stage1.next(candles[i]);
      const snapshot = stage1.getState();

      const stage2 = config.create({ ...config.defaultParams }, { fromState: snapshot });
      const valuesResumed = valuesReference.slice(0, splitIdx);
      for (let i = splitIdx; i < streamLength; i++) {
        valuesResumed.push(stage2.next(candles[i]).value);
      }

      expectSeriesEqual(valuesResumed, valuesReference, tolerance);
    });

    it("[2] indicator name guard: foreign snapshot throws", () => {
      const ind = config.create({ ...config.defaultParams });
      for (let i = 0; i < 10; i++) ind.next(candles[i]);
      const snapshot = ind.getState();

      const foreign: IndicatorSnapshot<TState> = {
        meta: { ...snapshot.meta, indicator: "__foreign_indicator__" },
        state: snapshot.state,
      };

      expect(() => config.create({ ...config.defaultParams }, { fromState: foreign })).toThrow(
        /indicator mismatch|incompatible snapshot/,
      );
    });

    it("[3] version guard: stale version throws", () => {
      const ind = config.create({ ...config.defaultParams });
      for (let i = 0; i < 10; i++) ind.next(candles[i]);
      const snapshot = ind.getState();

      // The indicator must emit the version declared in the contract
      // config. Otherwise a forgotten bump (or wrong-place bump) would
      // pass the stale-version test below without ever exercising the
      // real check.
      expect(
        snapshot.meta.version,
        `indicator "${config.name}" emitted version=${snapshot.meta.version} but ContractConfig declares ${config.version}`,
      ).toBe(config.version);

      const stale: IndicatorSnapshot<TState> = {
        meta: { ...snapshot.meta, version: snapshot.meta.version - 1 },
        state: snapshot.state,
      };

      expect(() => config.create({ ...config.defaultParams }, { fromState: stale })).toThrow(
        /version mismatch|incompatible snapshot/,
      );
    });

    if (config.reconfigParams.length > 0) {
      if (config.category === "windowed") {
        it(`[4] reconfig (windowed): post-warmup output equals a fresh run with the new options`, () => {
          // For windowed indicators, resume-with-different-period must
          // produce the same series as a fresh run with the new period
          // once the carry-forward buffer has been fully rotated by new
          // candles. This is the main correctness invariant — a broken
          // carry-forward implementation would diverge here.
          const splitIdx = Math.floor(streamLength / 2);

          for (const reconfig of config.reconfigParams) {
            if ("source" in reconfig) continue;
            const newOpts = { ...config.defaultParams, ...reconfig };

            // Reference: fresh run with new options over the full
            // candle history.
            const refInd = config.create(newOpts);
            const refValues: unknown[] = [];
            for (const c of candles) refValues.push(refInd.next(c).value);

            // Resumed: warm with defaults to splitIdx, then switch to
            // new options.
            const warmInd = config.create({ ...config.defaultParams });
            for (let i = 0; i < splitIdx; i++) warmInd.next(candles[i]);
            const snapshot = warmInd.getState();
            const resumed = config.create(newOpts, { fromState: snapshot });
            const resumedTail: unknown[] = [];
            for (let i = splitIdx; i < streamLength; i++) {
              resumedTail.push(resumed.next(candles[i]).value);
            }

            // First N post-resume bars may diverge while the
            // carry-forward buffer rotates. Tightest safe default for
            // SMA-like windowed indicators is
            // `max(0, newPeriod - oldPeriod)`: that's exactly how many
            // new bars must roll in before the resumed buffer matches
            // a fresh buffer at the same point in history.
            //
            //   period 5 → 8: needs 3 new bars (margin = 3)
            //   period 8 → 5: matches immediately (margin = 0)
            //   non-period reconfig: matches immediately (margin = 0)
            //
            // Caller can override via `config.reconfigMargin` when the
            // indicator's warm-up isn't governed by `period` (e.g.,
            // swing points' `leftBars + rightBars`).
            const margin = config.reconfigMargin
              ? config.reconfigMargin(newOpts)
              : (() => {
                  const newP = newOpts.period;
                  const oldP = snapshot.meta.params.period;
                  if (typeof newP !== "number" || !Number.isFinite(newP)) return 0;
                  if (typeof oldP !== "number" || !Number.isFinite(oldP)) return newP;
                  return Math.max(0, newP - oldP);
                })();

            // Guard: if the post-resume tail is shorter than the
            // carry-forward margin, the comparison loop would never
            // execute and the test would silently pass. Fail
            // explicitly so the caller knows to extend `streamLength`
            // (or shrink the reconfig period).
            const comparableTailLength = resumedTail.length - margin;
            expect(
              comparableTailLength,
              `streamLength=${streamLength} too short for windowed reconfig comparison: need at least ${margin + 1} post-resume bars to clear the carry-forward margin (newOpts=${JSON.stringify(reconfig)}). Increase ContractConfig.streamLength.`,
            ).toBeGreaterThan(0);

            for (let i = margin; i < resumedTail.length; i++) {
              expectValueEqual(
                resumedTail[i],
                refValues[splitIdx + i],
                tolerance,
                `reconfig tail i=${i} (newOpts=${JSON.stringify(reconfig)})`,
              );
            }
          }
        });
      } else if (config.category === "event") {
        it(`[4] reconfig (event): resumed run produces values without throwing`, () => {
          // Event log indicators can have different lookback semantics
          // for past events after reconfig (past events stand; future
          // events use new params). A direct fresh-vs-resumed equality
          // check is not meaningful; we only assert the mechanical
          // contract.
          const ind = config.create({ ...config.defaultParams });
          for (let i = 0; i < Math.floor(streamLength / 2); i++) ind.next(candles[i]);
          const snapshot = ind.getState();

          for (const reconfig of config.reconfigParams) {
            if ("source" in reconfig) continue;
            expect(() => {
              const resumed = config.create(
                { ...config.defaultParams, ...reconfig },
                { fromState: snapshot },
              );
              for (let i = Math.floor(streamLength / 2); i < streamLength; i++) {
                resumed.next(candles[i]);
              }
            }).not.toThrow();
          }
        });
      } else {
        // recursive / mixed / cascaded
        it(`[5] reconfig refuse (${config.category}): any param change throws`, () => {
          const ind = config.create({ ...config.defaultParams });
          for (let i = 0; i < Math.floor(streamLength / 2); i++) ind.next(candles[i]);
          const snapshot = ind.getState();

          for (const reconfig of config.reconfigParams) {
            expect(() =>
              config.create({ ...config.defaultParams, ...reconfig }, { fromState: snapshot }),
            ).toThrow(/incompatible snapshot|cannot be reconfigured/);
          }
        });
      }
    }

    it("[6] peek consistency: peek matches next and does not mutate state", () => {
      const ind = config.create({ ...config.defaultParams });
      for (let i = 0; i < streamLength; i++) {
        const candle = candles[i];

        const stateBeforePeek = JSON.stringify(ind.getState());
        const peeked = ind.peek(candle);
        const stateAfterPeek = JSON.stringify(ind.getState());

        expect(stateAfterPeek).toBe(stateBeforePeek);

        const advanced = ind.next(candle);
        expectValueEqual(peeked.value, advanced.value, tolerance);
      }
    });

    if (config.batchCompute) {
      // Invariant [8] runs `batchCompute` and incremental factory
      // against multiple candle shapes — the standard trend+sine
      // dataset plus a flat-price dataset that surfaces zero-variance
      // / div-by-zero / accumulator-stuck bugs the trending shape
      // hides. Adding new variants here permanently extends the
      // regression net across every indicator with batch parity wired
      // up; this is how we ensure edge-case bugs (e.g., EWMA's
      // missing zero-variance floor) cannot quietly come back.
      const parityCases: Array<{ label: string; candles: NormalizedCandle[] }> = [
        { label: "trending candles", candles },
        { label: "flat-price candles", candles: makeFlatCandles(streamLength) },
        // Gap-candle variant: an isolated 10× upward jump mid-stream
        // surfaces bugs that smooth datasets hide — McGinley's
        // `(price/MD)^4` term divergence, EWMA's variance explosion,
        // PVT/CVD multiplier overflow, etc. Trending + flat together
        // never produce a discontinuity, so gap testing is the third
        // axis of the regression net.
        { label: "gap-candle stream", candles: makeGapCandles(streamLength) },
      ];

      for (const parityCase of parityCases) {
        it(`[8] batch/incremental parity (${parityCase.label}): same candles produce same value series`, () => {
          // Feed the same candles through the batch sibling and the
          // incremental factory using identical default params. Every
          // emitted value (including `null` warmup bars) must agree
          // within `consistencyTolerance`. A failure here means the
          // two computations have diverged — either a latent algorithm
          // mismatch, an off-by-one alignment, or a tolerance issue
          // that warrants explicit acknowledgement rather than silent
          // tolerance growth.
          const opts = { ...config.defaultParams };
          const batchValues = config.batchCompute!(opts, parityCase.candles);

          const incremental = config.create({ ...config.defaultParams });
          const incrementalValues: unknown[] = [];
          for (const c of parityCase.candles) {
            incrementalValues.push(incremental.next(c).value);
          }

          const tol = config.consistencyTolerance ?? config.tolerance ?? 1e-10;
          expectSeriesEqual(incrementalValues, batchValues, tol);
        });
      }
    }

    it("[7] warmup gate consistency: next / peek / isWarmedUp align", () => {
      const ind = config.create({ ...config.defaultParams });
      const isNullish = config.isNullishField ?? isNullishValue;

      let firstWarmupBar = -1;
      for (let i = 0; i < streamLength; i++) {
        const peeked = ind.peek(candles[i]);
        const peekedNullBefore = isNullish(peeked.value);

        const advanced = ind.next(candles[i]);
        const advancedNull = isNullish(advanced.value);

        // peek and next must agree on null-ness at the same bar.
        expect(peekedNullBefore).toBe(advancedNull);

        if (!advancedNull && firstWarmupBar === -1) {
          firstWarmupBar = i;
          // At the very moment of producing the first non-null value,
          // isWarmedUp must be true.
          expect(ind.isWarmedUp).toBe(true);
        }

        // Once any non-null value has been emitted, isWarmedUp stays true.
        if (firstWarmupBar !== -1) {
          expect(ind.isWarmedUp).toBe(true);
        }
      }
    });
  });
}

/**
 * Flat-price candle generator used by invariant [8].
 *
 * All OHLC = 100 with mild volume variation. Surfaces bugs that the
 * trending generator hides: zero-variance seeding (EWMA), div-by-zero
 * on TR/range (Choppiness/ADL/CVD), recursive accumulators stuck at
 * their seed value, and so on. Future variants (NaN-adjacent, single
 * bar, huge values) can extend the parity-case list in `describeContract`
 * with the same pattern.
 */
function makeFlatCandles(n: number): NormalizedCandle[] {
  return Array.from({ length: n }, (_, i) => ({
    time: 1700000000000 + i * 86400000,
    open: 100,
    high: 100,
    low: 100,
    close: 100,
    volume: 1000 + (i % 3),
  }));
}

/**
 * Gap-candle generator: a mostly-flat stream with a single isolated
 * 10× upward jump at the midpoint. Used by invariant [8] to surface
 * discontinuity-sensitive bugs:
 *
 *   - McGinley Dynamic `(price/MD)^4` term divergence on extreme ratios
 *   - EWMA variance explosion from a single large squared return
 *   - PVT / CVD multiplier overflow on large `(close - prev) / prev`
 *   - Donchian channel reset behavior when the gap exits the lookback
 *
 * The gap is placed at index `n/2` so warm-up has completed before it
 * appears, ensuring the gap exercises the steady-state path rather
 * than the seed path. Volume varies mildly so volume-weighted
 * indicators get a non-degenerate signal.
 */
function makeGapCandles(n: number): NormalizedCandle[] {
  const gapIndex = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => {
    const base = i === gapIndex ? 1000 : 100;
    return {
      time: 1700000000000 + i * 86400000,
      open: base,
      high: base * 1.005,
      low: base * 0.995,
      close: base,
      volume: 1000 + (i % 5) * 10,
    };
  });
}

/**
 * "Looks like a null value" predicate that handles both primitive
 * `null` (used by `number | null` outputs like SMA / RSI) and
 * composite-all-null objects (used by multi-field outputs like
 * Donchian's `{ upper, middle, lower }`). During warmup, composite
 * indicators emit an object whose fields are all `null` rather than
 * the bare value `null`; without this normalization the warmup-gate
 * invariant treats those bars as already non-null.
 */
function isNullishValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v !== "object" || Array.isArray(v)) return false;
  const values = Object.values(v as Record<string, unknown>);
  if (values.length === 0) return false;
  // Treat an object as null when every present field is null.
  // Optional fields that are simply absent (undefined) don't count
  // against this — only fields explicitly emitted as null do.
  return values.every((x) => x === null || x === undefined);
}

// ---- Internal helpers ----

function expectSeriesEqual(a: unknown[], b: unknown[], tolerance: number) {
  expect(a.length).toBe(b.length);
  for (let i = 0; i < a.length; i++) {
    expectValueEqual(a[i], b[i], tolerance, `index ${i}`);
  }
}

function expectValueEqual(a: unknown, b: unknown, tolerance: number, context?: string): void {
  const where = context ? ` (${context})` : "";

  if (a === null || b === null) {
    expect(a, `null mismatch${where}`).toBe(b);
    return;
  }

  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return;
    expect(Math.abs(a - b), `numeric mismatch${where}: a=${a}, b=${b}`).toBeLessThanOrEqual(
      tolerance,
    );
    return;
  }

  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    // Recurse into object values (for composite outputs like { kvo, signal, histogram }).
    const aRec = a as Record<string, unknown>;
    const bRec = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aRec), ...Object.keys(bRec)]);
    for (const key of keys) {
      expectValueEqual(aRec[key], bRec[key], tolerance, `${context ?? ""}.${key}`);
    }
    return;
  }

  expect(a).toEqual(b);
}
