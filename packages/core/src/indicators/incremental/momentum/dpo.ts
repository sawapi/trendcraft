/**
 * Incremental Detrended Price Oscillator (DPO)
 *
 * DPO removes the trend from price data to identify cycles.
 * Batch formula: DPO[i] = Price[i] - SMA[i + shift], where shift = floor(period/2) + 1
 *
 * For incremental mode, we queue pending prices and resolve them when the
 * required SMA (shift bars later) becomes available. Output is emitted in
 * order with the correct timestamps, but with a delay of `shift` bars.
 * Bars near the end of a finite series will be null (no future SMA).
 *
 * State category: **Cascaded** (composes an inner incremental SMA plus
 * a pending-entry queue keyed on `shift`, which is derived from
 * `period`). Resume with a different `period` / `source` is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { createSma, type SmaState } from "../moving-average/sma";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Pending DPO result waiting for its paired SMA
 */
type PendingEntry = { time: number; price: number };

/**
 * Bare state shape for DPO. Params (`period`, `source`) live in
 * `meta.params` on the wire; `shift` is derived from `period`.
 */
export type DpoState = {
  smaState: IndicatorSnapshot<SmaState>;
  pending: PendingEntry[];
  /** Number of entries already resolved and removed from pending head */
  resolvedOffset: number;
  count: number;
  outputCount: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const DPO_VERSION = 1;

type DpoParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Detrended Price Oscillator indicator
 *
 * DPO[i] = Price[i] - SMA[i + shift]. The output for each bar is only
 * available `shift` bars later when the SMA is computed. The `next()` method
 * returns the DPO for the bar that can now be resolved (shift bars ago), with
 * that bar's timestamp. If no bar can be resolved yet, it returns the current
 * bar's time with null.
 *
 * @example
 * ```ts
 * const dpoInd = createDpo({ period: 20 });
 * for (const candle of stream) {
 *   const { time, value } = dpoInd.next(candle);
 *   if (dpoInd.isWarmedUp) console.log(time, value);
 * }
 * ```
 */
export function createDpo(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<DpoState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<DpoState>> {
  const { params, state } = resolveResume<DpoParams, DpoState>({
    indicator: "dpo",
    version: DPO_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, source: "close" },
  });

  const period = requireParam(
    "dpo",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;
  const shift = Math.floor(period / 2) + 1;

  let sma: ReturnType<typeof createSma>;
  let pending: PendingEntry[];
  let resolvedOffset: number;
  let count: number;
  let outputCount: number;

  if (state !== null) {
    sma = createSma({ period, source }, { fromState: state.smaState });
    pending = [...state.pending];
    resolvedOffset = state.resolvedOffset;
    count = state.count;
    outputCount = state.outputCount;
  } else {
    sma = createSma({ period, source });
    pending = [];
    resolvedOffset = 0;
    count = 0;
    outputCount = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<DpoState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const price = getSourcePrice(candle, source);
      pending.push({ time: candle.time, price });

      const smaVal = sma.next(candle).value;

      // DPO[i] = Price[i] - SMA[i + shift]
      // When SMA at bar j is ready, resolve bar (j - shift).
      // targetIdx in the global bar space = count - 1 - shift
      // pendingIdx = targetIdx - resolvedOffset (adjusted for trimmed head)
      const globalTarget = count - 1 - shift;
      const pendingIdx = globalTarget - resolvedOffset;
      if (smaVal !== null && pendingIdx >= 0 && pendingIdx < pending.length) {
        const entry = pending[pendingIdx];
        const dpoVal = entry.price - smaVal;
        outputCount++;
        // Free resolved entries to prevent unbounded memory growth
        if (pendingIdx > 0) {
          pending.splice(0, pendingIdx);
          resolvedOffset += pendingIdx;
        }
        return { time: entry.time, value: dpoVal };
      }

      return { time: candle.time, value: null };
    },

    peek(candle: NormalizedCandle) {
      const smaVal = sma.peek(candle).value;
      const peekCount = count + 1;
      const price = getSourcePrice(candle, source);
      const globalTarget = peekCount - 1 - shift;
      const pendingIdx = globalTarget - resolvedOffset;

      if (smaVal !== null && pendingIdx >= 0) {
        let entryPrice: number;
        let entryTime: number;
        if (pendingIdx < pending.length) {
          entryPrice = pending[pendingIdx].price;
          entryTime = pending[pendingIdx].time;
        } else {
          // pendingIdx == pending.length means the new candle itself
          entryPrice = price;
          entryTime = candle.time;
        }
        return { time: entryTime, value: entryPrice - smaVal };
      }

      return { time: candle.time, value: null };
    },

    getState(): IndicatorSnapshot<DpoState> {
      return makeSnapshot(
        "dpo",
        DPO_VERSION,
        { period, source },
        {
          smaState: sma.getState(),
          pending: [...pending],
          resolvedOffset,
          count,
          outputCount,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return outputCount > 0;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
