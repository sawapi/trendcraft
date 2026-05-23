/**
 * Incremental EWMA Volatility
 *
 * Exponentially Weighted Moving Average volatility estimator.
 * Uses log returns and the RiskMetrics EWMA formula:
 *   variance_t = lambda * variance_{t-1} + (1 - lambda) * return_t^2
 *
 * Output is annualized volatility percentage.
 *
 * State category: **Recursive** (`prevVariance` is a recursive
 * accumulator once the seed window completes; the seeding buffer is
 * discarded after seedDone). Any change to `lambda`, `source`, or
 * `seedSize` on resume is refused — the running variance is already
 * conditioned on the original parameters.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<EwmaVolatilityState>` and `fromState` accepts
 * the same. Params (`lambda`, `source`, `seedSize`) now live in
 * `meta.params`. Pre-0.4.0 behavior silently merged mismatched params
 * with the snapshot's recursive state — that latent bug is now a
 * loud throw via the recursive policy.
 *
 * Seeding behavior (0.4.0): values during the seed window
 * (bars 1..seedSize-1) are `null` — the incremental computation
 * cannot causally replicate the batch sibling's lookahead seed
 * (`ewmaVolatilityFromCandles` uses `sampleVariance` of the first
 * `seedSize` returns, which requires knowing them in advance). At
 * candle `seedSize` we (a) compute the same sample-variance seed
 * the batch uses and (b) replay the `seedSize` EWMA updates that
 * batch applied during its seeding period, so the first emitted
 * value matches batch's value at that candle exactly and from then
 * on the two indicators evolve bar-for-bar identically.
 *
 * Pre-0.4.0 emitted a preliminary running EWMA during the seed
 * window that was then overwritten by the sample variance at
 * seedSize — conflating "indicator has any value" with "indicator
 * has a stable estimate" *and* leaving the post-seed series ~10 EWMA
 * updates behind the batch sibling indefinitely. The combined seed
 * suppression + replay fixes both issues.
 */

import { type AnnualizationOptions, annualizationFactor } from "../../../calendar";
import type { NormalizedCandle, PriceSource } from "../../../types";
import { type IndicatorSnapshot, makeSnapshot, resolveResume } from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for EWMA Volatility. Params (`lambda`, `source`,
 * `seedSize`) live in `meta.params` on the wire — they are not part
 * of the bare state.
 */
export type EwmaVolatilityState = {
  prevPrice: number | null;
  prevVariance: number | null;
  seedReturns: number[];
  seedDone: boolean;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const EWMA_VOLATILITY_VERSION = 1;

type EwmaVolatilityParams = {
  lambda: number;
  source: PriceSource;
  seedSize: number;
  /**
   * Annualization scaling, stored only as the resolved numeric
   * `periodsPerYear`. The constructor accepts either `periodsPerYear`
   * (e.g. `365` for crypto) or `calendar: JPX_CALENDAR` (a
   * `TradingCalendar` whose `tradingDaysPerYear` supplies the number);
   * `calendar` is resolved to its numeric factor *before* the options
   * reach `resolveResume`, so this field always holds a plain number.
   *
   * Why not persist the calendar object: `TradingCalendar` can carry an
   * `isTradingDay?(date): boolean` function. `meta.params` is deep-cloned
   * via `structuredClone` (or JSON round-trip), so a function value
   * would either throw `DataCloneError` or silently disappear — both
   * unacceptable for `getState()`. Storing only the resolved number
   * keeps snapshots JSON-clean and round-trip-deterministic, and lets
   * a caller resume with either input form as long as it resolves to
   * the same `periodsPerYear`.
   */
  periodsPerYear?: number;
};

/**
 * Create an incremental EWMA Volatility indicator
 *
 * Computes log returns from candle prices internally and applies the EWMA
 * variance formula. Outputs annualized volatility as a percentage.
 *
 * @example
 * ```ts
 * const ewma = createEwmaVolatility({ lambda: 0.94 });
 * for (const candle of stream) {
 *   const { value } = ewma.next(candle);
 *   if (value !== null) console.log(`Vol: ${value.toFixed(2)}%`);
 * }
 * ```
 */
export function createEwmaVolatility(
  options: {
    lambda?: number;
    source?: PriceSource;
    seedSize?: number;
    periodsPerYear?: number;
    calendar?: AnnualizationOptions["calendar"];
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<EwmaVolatilityState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<EwmaVolatilityState>> {
  // Resolve `calendar` → numeric `periodsPerYear` *before* handing the
  // options bag to `resolveResume`. Reasoning:
  //   1. `TradingCalendar` may include an `isTradingDay?(date)` function
  //      that cannot survive `structuredClone` / JSON serialization;
  //      keeping it out of `meta.params` makes snapshots round-trip-safe.
  //   2. A caller may legitimately use `calendar: JPX_CALENDAR` on the
  //      first run and `periodsPerYear: 245` on resume (or vice-versa).
  //      Pre-resolving means the resume diff compares a single canonical
  //      number, so equivalent inputs are not flagged as a param change.
  //
  // Precedence must match the batch sibling's `annualizationFactor`:
  // `calendar` wins over `periodsPerYear` when both are supplied.
  // Earlier this branch reversed the precedence by only consulting
  // `calendar` when `periodsPerYear` was absent — that silently
  // produced different volatility scales between batch and incremental
  // for the same input. Always honor `calendar` first to stay aligned.
  const { calendar, ...optionsWithoutCalendar } = options;
  const resolvedOptions =
    calendar !== undefined
      ? { ...optionsWithoutCalendar, periodsPerYear: calendar.tradingDaysPerYear }
      : optionsWithoutCalendar;

  // Canonicalize legacy snapshots that pre-date annualization support.
  // The initial Bundle F migration emitted `meta.params = {lambda, source,
  // seedSize}` (no `periodsPerYear`) and hard-coded sqrt(252) at compute
  // time. After this audit, snapshots always persist a numeric
  // `periodsPerYear` — but a caller resuming an *old-shape* snapshot
  // with an explicit `{periodsPerYear: 252}` (or equivalent calendar)
  // would otherwise trip the recursive-refuse policy because the
  // snapshot lacks the key while options has it. Materialize the
  // implicit-252 default into the legacy snapshot *before* resolveResume
  // computes its diff, so equivalent inputs round-trip cleanly across
  // the API change without forcing a re-warm.
  const incomingSnapshot = warmUpOptions?.fromState ?? null;
  const normalizedFromState =
    incomingSnapshot?.meta?.params &&
    typeof incomingSnapshot.meta.params === "object" &&
    !Array.isArray(incomingSnapshot.meta.params) &&
    (incomingSnapshot.meta.params as Record<string, unknown>).periodsPerYear === undefined
      ? {
          meta: {
            ...incomingSnapshot.meta,
            params: { ...incomingSnapshot.meta.params, periodsPerYear: 252 },
          },
          state: incomingSnapshot.state,
        }
      : incomingSnapshot;

  const { params, state } = resolveResume<EwmaVolatilityParams, EwmaVolatilityState>({
    indicator: "ewmaVolatility",
    version: EWMA_VOLATILITY_VERSION,
    category: "recursive",
    options: resolvedOptions,
    fromState: normalizedFromState,
    defaults: { lambda: 0.94, source: "close", seedSize: 10 },
  });

  const lambda = params.lambda;
  const source = params.source;
  const seedSize = params.seedSize;
  // Resolve `periodsPerYear` to its concrete numeric value (calendar
  // already pre-folded into options, snapshot value carried by
  // resolveResume, default 252 if still unset). We persist *this*
  // resolved number in `meta.params` rather than the optional input
  // value — otherwise a snapshot taken with the implicit 252 default
  // would have no `periodsPerYear` key, and resuming with an
  // *equivalent* explicit option (`{ periodsPerYear: 252 }` or a
  // 252-day calendar like `US_EQUITY_CALENDAR`) would be flagged as a
  // param change and refused by the recursive policy even though the
  // effective factor is identical.
  const effectivePeriodsPerYear = annualizationFactor({
    periodsPerYear: params.periodsPerYear,
  });
  const annualFactor = Math.sqrt(effectivePeriodsPerYear) * 100;

  let prevPrice: number | null;
  let prevVariance: number | null;
  let seedReturns: number[];
  let seedDone: boolean;
  let count: number;

  if (state !== null) {
    prevPrice = state.prevPrice;
    prevVariance = state.prevVariance;
    seedReturns = [...state.seedReturns];
    seedDone = state.seedDone;
    count = state.count;
  } else {
    prevPrice = null;
    prevVariance = null;
    seedReturns = [];
    seedDone = false;
    count = 0;
  }

  function sampleVariance(returns: number[]): number {
    // Centered population variance (Σ(r-μ)²/N) with a 1e-10 floor.
    // Identical to the batch sibling's `ewmaVolatility` seed.
    //
    // Variant note: RiskMetrics Technical Document (1996) §5.3.2
    // specifies the *uncentered* form (Σr²/N) with the mean assumed
    // to be zero — for daily log returns this differs from the
    // centered form by μ², a sub-basis-point effect. We pick the
    // centered form because (a) it is what `Math.var`-style sample
    // statistics imply and what pyfolio / quantstats use under the
    // hood, and (b) it does not silently bake in a "returns are
    // mean-zero" assumption that breaks on monthly / weekly bars
    // where the drift is non-trivial. Batch and incremental MUST
    // use the same form; invariant [8] enforces this bar-for-bar.
    //
    // Pre-0.4.0 incremental used Bessel-corrected sample variance
    // (Σ(r-μ)²/(N-1)), which caused a permanent N/(N-1) divergence
    // between batch and incremental output. It also lacked the
    // 1e-10 zero floor, so a flat-price seed window emitted `0`
    // while batch emitted a tiny positive value — and the recursive
    // update then stayed at exact zero forever. Aligning on
    // /N + the floor closes both gaps on every candle shape,
    // including flat-price streams.
    const n = returns.length;
    if (n === 0) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    let sumSq = 0;
    for (const r of returns) {
      const d = r - mean;
      sumSq += d * d;
    }
    const variance = sumSq / n;
    return variance === 0 ? 1e-10 : variance;
  }

  function computeOutput(variance: number): number {
    return Math.sqrt(Math.max(0, variance)) * annualFactor;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<EwmaVolatilityState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        prevPrice = price;
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);
      prevPrice = price;

      if (!seedDone) {
        seedReturns.push(logReturn);
        if (seedReturns.length >= seedSize) {
          // Seed complete: compute the sample-variance seed (matches
          // batch's `sigma2_initial`), then replay the EWMA updates
          // batch applies during the seed window so the first emitted
          // value matches batch's value at this candle exactly.
          let v = sampleVariance(seedReturns);
          for (const r of seedReturns) {
            v = lambda * v + (1 - lambda) * r * r;
          }
          prevVariance = v;
          seedDone = true;
          return { time: candle.time, value: computeOutput(prevVariance) };
        }
        // Mid-seeding: hold output null until the seed window completes.
        // (Pre-0.4.0 emitted a preliminary running EWMA here that was
        // then overwritten at seedSize — see file-level JSDoc.)
        return { time: candle.time, value: null };
      }

      // `seedDone` is true here, so `prevVariance` is necessarily a
      // number set by the seed-replay branch above. The non-null
      // assertion makes that invariant explicit — a defensive
      // `?? 0` would silently bypass the 1e-10 floor installed by
      // `sampleVariance` if the invariant were ever broken.
      prevVariance = lambda * (prevVariance as number) + (1 - lambda) * logReturn * logReturn;
      return { time: candle.time, value: computeOutput(prevVariance) };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      if (prevPrice === null) {
        return { time: candle.time, value: null };
      }

      const logReturn = Math.log(price / prevPrice);

      if (!seedDone) {
        const peekReturns = [...seedReturns, logReturn];
        if (peekReturns.length >= seedSize) {
          // Mirror next()'s seed completion: sample-variance seed
          // followed by EWMA replay over the seed window.
          let v = sampleVariance(peekReturns);
          for (const r of peekReturns) {
            v = lambda * v + (1 - lambda) * r * r;
          }
          return { time: candle.time, value: computeOutput(v) };
        }
        // Mid-seeding peek mirrors next() and stays null.
        return { time: candle.time, value: null };
      }

      // Mirrors `next`: `seedDone` is true here so `prevVariance` is
      // a number. Cast (not `??`) to keep the floor invariant intact.
      const v = lambda * (prevVariance as number) + (1 - lambda) * logReturn * logReturn;
      return { time: candle.time, value: computeOutput(v) };
    },

    getState(): IndicatorSnapshot<EwmaVolatilityState> {
      return makeSnapshot(
        "ewmaVolatility",
        EWMA_VOLATILITY_VERSION,
        // Always persist the *resolved* `periodsPerYear` (incl. the
        // 252 default) so resume-time diffing compares concrete
        // numbers. Omitting it on the implicit-default path used to
        // refuse a resume that re-specified the same factor
        // explicitly — `{}` snapshot vs `{ periodsPerYear: 252 }`
        // (or a 252-day calendar) options registered as a "change"
        // even though the math was identical. `calendar` itself
        // never enters `params`; only its numeric `tradingDaysPerYear`
        // does, keeping the snapshot JSON-safe.
        {
          lambda,
          source,
          seedSize,
          periodsPerYear: effectivePeriodsPerYear,
        },
        {
          prevPrice,
          prevVariance,
          seedReturns: [...seedReturns],
          seedDone,
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return seedDone;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
