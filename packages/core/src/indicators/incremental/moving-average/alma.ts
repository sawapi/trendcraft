/**
 * Incremental ALMA (Arnaud Legoux Moving Average)
 *
 * Uses a Gaussian distribution to weight prices in a sliding window.
 *
 * State category: **Windowed** (raw price buffer, no recursion).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<AlmaState>` and `fromState` accepts the same.
 *
 * Defaults: full canonical defaults are available
 * (`period: 9, offset: 0.85, sigma: 6, source: "close"`), so callers
 * can omit any param. On resume, omitted params inherit from the
 * snapshot; explicit options override.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for ALMA. Params (`period`, `offset`, `sigma`,
 * `source`) live in `meta.params` on the wire — they are not part of
 * the bare state. `weights` is recomputed at construction from
 * params, so it's intentionally not persisted (cleaner state,
 * deterministic regeneration).
 */
export type AlmaState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bump on any breaking state change. */
export const ALMA_VERSION = 1;

type AlmaParams = {
  period: number;
  offset: number;
  sigma: number;
  source: PriceSource;
};

const ALMA_DEFAULTS: AlmaParams = {
  period: 9,
  offset: 0.85,
  sigma: 6,
  source: "close",
};

/**
 * Create an incremental ALMA indicator.
 *
 * @example
 * ```ts
 * const ind = createAlma({ period: 9, offset: 0.85, sigma: 6 });
 * for (const candle of stream) {
 *   const { value } = ind.next(candle);
 *   if (ind.isWarmedUp) console.log(value);
 * }
 *
 * // Resume from a snapshot. Params inherit from the snapshot when
 * // options are omitted; explicit options trigger reconfig.
 * const resumed = createAlma({}, { fromState: snapshot });
 * ```
 */
export function createAlma(
  options: {
    period?: number;
    offset?: number;
    sigma?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AlmaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<AlmaState>> {
  const { params, state, reconfigured } = resolveResume<AlmaParams, AlmaState>({
    indicator: "alma",
    version: ALMA_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: ALMA_DEFAULTS,
  });

  // ALMA has full canonical defaults, so `requireParam` is used here
  // for runtime range validation rather than missing-param detection.
  const period = requireParam(
    "alma",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const offset = requireParam(
    "alma",
    params,
    "offset",
    (v): v is number => typeof v === "number" && v >= 0 && v <= 1,
    "must be in [0, 1]",
  );
  const sigma = requireParam(
    "alma",
    params,
    "sigma",
    (v): v is number => typeof v === "number" && v > 0,
    "must be positive",
  );
  const source = params.source;

  // Pre-compute normalized Gaussian weights (Pine Script convention:
  // `m = offset * (period - 1)`, matching TradingView's `ta.alma()`).
  // Recomputed on every construction — `weights` is a deterministic
  // function of (period, offset, sigma) and not part of canonical state.
  const m = offset * (period - 1);
  const sd = period / sigma;
  const weights: number[] = new Array(period);
  let weightSum = 0;
  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * sd * sd));
    weights[i] = w;
    weightSum += w;
  }
  for (let i = 0; i < period; i++) {
    weights[i] /= weightSum;
  }

  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Shape change (period / offset / sigma). The snapshot stores
      // raw source prices — they remain valid input for new weights.
      // Carry forward the latest `min(snapshot.length, new period)`
      // prices into a buffer of the new capacity. `count` preserves
      // the public "candles processed so far" counter; warm-up
      // gating uses `buffer.length` separately.
      //
      // (Source changes are refused by resolveResume before reaching
      // here — buffer values are not transferrable across sources.)
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        buffer.push(oldBuffer.get(i));
      }
      count = state.count;
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function computeAlma(): number {
    let value = 0;
    for (let i = 0; i < period; i++) {
      value += weights[i] * buffer.get(i);
    }
    return value;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<AlmaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      // Warm-up gated on the buffer being full, not on `count`. A
      // shape-only resume can carry forward historical prices (so
      // buffer is full and we emit immediately even though count is
      // the old run's total), and a grown-period resume needs more
      // bars even when count is already large.
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }
      return { time: candle.time, value: computeAlma() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      const peekLength = Math.min(buffer.length + 1, period);
      if (peekLength < period) {
        return { time: candle.time, value: null };
      }

      // Simulate buffer with new price appended.
      let value = 0;
      const len = buffer.length;
      if (len < period) {
        for (let i = 0; i < len; i++) {
          value += weights[i] * buffer.get(i);
        }
        value += weights[len] * price;
      } else {
        for (let i = 0; i < period - 1; i++) {
          value += weights[i] * buffer.get(i + 1);
        }
        value += weights[period - 1] * price;
      }

      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<AlmaState> {
      return makeSnapshot(
        "alma",
        ALMA_VERSION,
        { period, offset, sigma, source },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.length >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
