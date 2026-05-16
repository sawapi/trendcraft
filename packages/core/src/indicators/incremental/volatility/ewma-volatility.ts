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
  options: { lambda?: number; source?: PriceSource; seedSize?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<EwmaVolatilityState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<EwmaVolatilityState>> {
  const { params, state } = resolveResume<EwmaVolatilityParams, EwmaVolatilityState>({
    indicator: "ewmaVolatility",
    version: EWMA_VOLATILITY_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { lambda: 0.94, source: "close", seedSize: 10 },
  });

  const lambda = params.lambda;
  const source = params.source;
  const seedSize = params.seedSize;

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

  const annualFactor = Math.sqrt(252) * 100;

  function sampleVariance(returns: number[]): number {
    // Population variance (divide by N) with a 1e-10 floor to match
    // the batch sibling's `ewmaVolatility` seed convention exactly.
    //
    // Pre-0.4.0 incremental used Bessel-corrected sample variance
    // (divide by N-1), which is statistically more rigorous but
    // caused a permanent N/(N-1) divergence between batch and
    // incremental output. It also lacked the zero floor, so a
    // flat-price seed window emitted `0` while batch emitted a tiny
    // positive value — and the recursive update then stayed at
    // exact zero forever. Aligning on N + the floor keeps invariant
    // [8] (batch parity) clean on every candle shape, including
    // flat-price streams.
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

      prevVariance = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
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

      const v = lambda * (prevVariance ?? 0) + (1 - lambda) * logReturn * logReturn;
      return { time: candle.time, value: computeOutput(v) };
    },

    getState(): IndicatorSnapshot<EwmaVolatilityState> {
      return makeSnapshot(
        "ewmaVolatility",
        EWMA_VOLATILITY_VERSION,
        { lambda, source, seedSize },
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
