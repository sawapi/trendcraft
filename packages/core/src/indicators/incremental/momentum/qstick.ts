/**
 * Incremental QStick
 *
 * QStick = SMA(close - open, period)
 * Measures the dominance of buying or selling pressure via candlestick body.
 *
 * State category: **Cascaded** (composes an inner incremental SMA over
 * the per-candle close-minus-open series). Resume with a different
 * `period` is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { createSma, type SmaState } from "../moving-average/sma";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { makeCandle } from "../utils";

/**
 * Bare state shape for QStick. Params (`period`) live in `meta.params`.
 */
export type QStickState = {
  smaState: IndicatorSnapshot<SmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const QSTICK_VERSION = 1;

type QStickParams = {
  period: number;
};

/**
 * Create an incremental QStick indicator
 *
 * @example
 * ```ts
 * const qstick = createQStick({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = qstick.next(candle);
 *   if (qstick.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createQStick(
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<QStickState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<QStickState>> {
  const { params, state } = resolveResume<QStickParams, QStickState>({
    indicator: "qstick",
    version: QSTICK_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "qstick",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let sma: ReturnType<typeof createSma>;
  let count: number;

  if (state !== null) {
    sma = createSma({ period }, { fromState: state.smaState });
    count = state.count;
  } else {
    sma = createSma({ period });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<QStickState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const diff = candle.close - candle.open;
      return sma.next(makeCandle(candle.time, diff));
    },

    peek(candle: NormalizedCandle) {
      const diff = candle.close - candle.open;
      return sma.peek(makeCandle(candle.time, diff));
    },

    getState(): IndicatorSnapshot<QStickState> {
      return makeSnapshot(
        "qstick",
        QSTICK_VERSION,
        { period },
        {
          smaState: sma.getState(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return sma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
