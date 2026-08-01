/**
 * Incremental McGinley Dynamic
 *
 * MD[i] = MD[i-1] + (Price - MD[i-1]) / (k × period × (Price / MD[i-1])^4)
 *
 * State category: **Recursive** (single-pole). `prevMd` carries
 * permanent dependence on past parameters, so resume-time reconfig
 * (different period, k, or source) is mathematically undefined and
 * refused. Pass identical options on resume, or omit them and let the
 * snapshot's params win.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<McGinleyDynamicState>` and `fromState` accepts
 * the same. Params (`period`, `k`, `source`) now live in `meta.params`
 * — the hand-rolled resume guard from 0.3.x is replaced by the
 * library-wide `resolveResume` recursive policy.
 *
 * Extreme-gap behavior: the `(price / MD)^4` ratio is uncapped, which
 * matches the canonical McGinley (1990) formulation as used by
 * TradingView and StockCharts. On upward gaps the denominator grows
 * fast, so the indicator simply lags more — graceful. On *downward*
 * gaps the denominator shrinks to ~0 and the next MD can swing to a
 * large negative value (e.g. `price = 0.1 × MD` → denom ≈ 8.4e-4,
 * adjustment ≈ -1071 × MD). In practice price = 0 / extreme-down
 * gaps mostly indicate dirty input rather than real moves; reject
 * those upstream. Some third-party implementations clamp the ratio
 * to `[0.5, 2.0]`; trendcraft does not, to remain bar-for-bar
 * faithful to the published formula.
 *
 * A run that has been pushed to a non-finite `prevMd` that way keeps
 * emitting non-finite values, which is at least visible. Its snapshot
 * is not: JSON writes the non-finite value as `null`, and the resumed
 * run would coerce that to 0 and emit a plausible constant forever. So
 * resuming a warmed-up snapshot whose `prevMd` is not a finite number
 * is refused (`requireFiniteState`).
 *
 * Seeding asymmetry note (intentional): the batch sibling produces
 * its first non-null value at index `period - 1` (`if i === period - 1`),
 * while this incremental factory uses a post-incremented `count` so
 * the first non-null is produced when `count === period`. Both refer
 * to the same candle (the `period`-th one, 0-indexed `period - 1`);
 * the formulations differ only because batch indexes the array
 * directly while incremental counts calls. Invariant [8] enforces
 * bar-for-bar parity.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireFiniteState,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for McGinley Dynamic. Params (`period`, `k`,
 * `source`) live in `meta.params` on the wire — they are not part
 * of the bare state.
 */
export type McGinleyDynamicState = {
  prevMd: number | null;
  sum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const MCGINLEY_DYNAMIC_VERSION = 1;

type McGinleyDynamicParams = {
  period: number;
  k: number;
  source: PriceSource;
};

/**
 * Create an incremental McGinley Dynamic indicator
 *
 * @example
 * ```ts
 * const md = createMcGinleyDynamic({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = md.next(candle);
 *   if (md.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createMcGinleyDynamic(
  options: { period?: number; k?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<McGinleyDynamicState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<McGinleyDynamicState>> {
  const { params, state } = resolveResume<McGinleyDynamicParams, McGinleyDynamicState>({
    indicator: "mcginleyDynamic",
    version: MCGINLEY_DYNAMIC_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, k: 0.6, source: "close" },
  });

  const period = params.period;
  const k = params.k;
  const source = params.source;

  let prevMd: number | null;
  let sum: number;
  let count: number;

  if (state !== null) {
    // Every number this state carries, with the point in the indicator's life
    // from which it must hold one. JSON writes a non-finite value as `null`,
    // and both fields have a coercion waiting for them: `null + price` is a
    // number, so a poisoned warm-up total would seed the average from a sum
    // that lost its history, and the update below would turn a `null` prevMd
    // into a constant 0 — either way a visibly broken series comes back
    // looking like data.
    requireFiniteState("mcginleyDynamic", { sum: state.sum, count: state.count });
    if (state.count >= period) {
      requireFiniteState("mcginleyDynamic", { prevMd: state.prevMd });
    }
    prevMd = state.prevMd;
    sum = state.sum;
    count = state.count;
  } else {
    prevMd = null;
    sum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<McGinleyDynamicState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      if (count < period) {
        sum += price;
        return { time: candle.time, value: null };
      }

      if (count === period) {
        sum += price;
        prevMd = sum / period;
        return { time: candle.time, value: prevMd };
      }

      // McGinley Dynamic formula
      const prev = prevMd as number;
      const ratio = price / prev;
      const denominator = k * period * ratio ** 4;
      prevMd = prev + (price - prev) / denominator;
      return { time: candle.time, value: prevMd };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount < period) {
        return { time: candle.time, value: null };
      }

      if (peekCount === period) {
        return { time: candle.time, value: (sum + price) / period };
      }

      const prev = prevMd as number;
      const ratio = price / prev;
      const denominator = k * period * ratio ** 4;
      return { time: candle.time, value: prev + (price - prev) / denominator };
    },

    getState(): IndicatorSnapshot<McGinleyDynamicState> {
      return makeSnapshot(
        "mcginleyDynamic",
        MCGINLEY_DYNAMIC_VERSION,
        { period, k, source },
        { prevMd, sum, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
