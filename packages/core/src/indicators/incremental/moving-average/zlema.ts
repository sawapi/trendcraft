/**
 * Incremental ZLEMA (Zero-Lag Exponential Moving Average)
 *
 * ZLEMA = EMA(adjusted_price, period)
 * where adjusted_price = price + (price - price[lag])
 * and lag = floor((period - 1) / 2)
 *
 * State category: **Recursive** (`prevZlema` is the recursive
 * accumulator; the fixed-size lag lookback buffer and `seedSum` /
 * `seedCount` form the warmup tally that is consumed once the SMA
 * seed completes). Resume with different `period` / `source` is
 * mathematically undefined — both the recursive accumulator and the
 * lag-window contents are permanently conditioned on construction-time
 * params — and is refused.
 *
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<ZlemaState>` and `fromState` accepts the same.
 * Params (`period`, `source`) now live in `meta.params`; the
 * derived `lag` (= `floor((period - 1) / 2)`) and `multiplier`
 * (= `2 / (period + 1)`) are computed in the factory closure rather
 * than persisted, since both are uniquely determined by `period`.
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
 * Bare state shape for ZLEMA. Params (`period`, `source`) live in
 * `meta.params` on the wire — they are not part of the bare state.
 * `lag` and `multiplier` are derived from `period` in the factory
 * closure and intentionally absent from the persisted state.
 */
export type ZlemaState = {
  prevZlema: number | null;
  /** Sum of adjusted prices during SMA seed phase */
  seedSum: number;
  /** Count of adjusted prices accumulated in seed phase */
  seedCount: number;
  buffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const ZLEMA_VERSION = 1;

type ZlemaParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental ZLEMA indicator
 *
 * @example
 * ```ts
 * const zlema = createZlema({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = zlema.next(candle);
 *   if (zlema.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createZlema(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<ZlemaState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<ZlemaState>> {
  const { params, state } = resolveResume<ZlemaParams, ZlemaState>({
    indicator: "zlema",
    version: ZLEMA_VERSION,
    category: "recursive",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, source: "close" },
  });

  const period = requireParam(
    "zlema",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const lag = Math.floor((period - 1) / 2);
  const multiplier = 2 / (period + 1);

  // Buffer to hold prices for lag lookback (need lag+1 to access price[i-lag])
  let buffer: CircularBuffer<number>;
  let prevZlema: number | null;
  let seedSum: number;
  let seedCount: number;
  let count: number;

  if (state !== null) {
    buffer = CircularBuffer.fromSnapshot(state.buffer);
    prevZlema = state.prevZlema;
    seedSum = state.seedSum;
    seedCount = state.seedCount;
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(lag + 1);
    prevZlema = null;
    seedSum = 0;
    seedCount = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<ZlemaState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      if (count <= lag) {
        return { time: candle.time, value: null };
      }

      // Accumulate adjusted prices for SMA seed
      const lagPrice = buffer.get(buffer.length - 1 - lag);
      const adjustedPrice = price + (price - lagPrice);
      seedCount++;

      const seedTarget = period - lag;

      if (seedCount < seedTarget) {
        seedSum += adjustedPrice;
        return { time: candle.time, value: null };
      }

      if (seedCount === seedTarget) {
        seedSum += adjustedPrice;
        prevZlema = seedSum / seedTarget;
        return { time: candle.time, value: prevZlema };
      }

      // Standard EMA
      prevZlema = adjustedPrice * multiplier + (prevZlema ?? 0) * (1 - multiplier);
      return { time: candle.time, value: prevZlema };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const nextCount = count + 1;

      // Not enough data yet for lag lookback
      if (nextCount <= lag) {
        return { time: candle.time, value: null };
      }

      // Compute lag price from simulated buffer state after push
      let lagPrice: number;
      if (lag === 0) {
        // No lag: adjusted price = 2*price - price = price
        lagPrice = price;
      } else if (buffer.length < lag) {
        // Buffer doesn't have enough items even after push
        return { time: candle.time, value: null };
      } else if (buffer.length < buffer.capacity) {
        // Buffer not yet full: after push, lag price is at index (length - lag)
        lagPrice = buffer.get(buffer.length - lag);
      } else {
        // Buffer full: push evicts oldest, lag price shifts by 1
        lagPrice = buffer.get(buffer.length - lag);
      }

      const adjustedPrice = price + (price - lagPrice);
      const nextSeedCount = seedCount + 1;
      const seedTarget = period - lag;

      if (nextSeedCount < seedTarget) {
        return { time: candle.time, value: null };
      }

      if (nextSeedCount === seedTarget) {
        return { time: candle.time, value: (seedSum + adjustedPrice) / seedTarget };
      }

      // Standard EMA
      const value = adjustedPrice * multiplier + (prevZlema ?? 0) * (1 - multiplier);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<ZlemaState> {
      return makeSnapshot(
        "zlema",
        ZLEMA_VERSION,
        { period, source },
        {
          prevZlema,
          seedSum,
          seedCount,
          buffer: buffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return prevZlema !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
