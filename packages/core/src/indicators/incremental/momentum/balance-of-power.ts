/**
 * Incremental Balance of Power (BOP)
 *
 * BOP = SMA((close - open) / (high - low), smoothPeriod)
 * Measures the strength of buyers vs sellers by relating the price change to the range.
 *
 * State category: **Cascaded** (composes an inner incremental SMA over
 * the per-candle raw BOP series). Resume with a different
 * `smoothPeriod` is refused.
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
 * Bare state shape for Balance of Power. Params (`smoothPeriod`) live
 * in `meta.params` on the wire.
 */
export type BalanceOfPowerState = {
  smaState: IndicatorSnapshot<SmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const BALANCE_OF_POWER_VERSION = 1;

type BalanceOfPowerParams = {
  smoothPeriod: number;
};

/**
 * Create an incremental Balance of Power indicator
 *
 * @example
 * ```ts
 * const bop = createBalanceOfPower({ smoothPeriod: 14 });
 * for (const candle of stream) {
 *   const { value } = bop.next(candle);
 *   if (bop.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createBalanceOfPower(
  options: { smoothPeriod?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<BalanceOfPowerState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<BalanceOfPowerState>> {
  const { params, state } = resolveResume<BalanceOfPowerParams, BalanceOfPowerState>({
    indicator: "balanceOfPower",
    version: BALANCE_OF_POWER_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { smoothPeriod: 14 },
  });

  const smoothPeriod = requireParam(
    "balanceOfPower",
    params,
    "smoothPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let sma: ReturnType<typeof createSma>;
  let count: number;

  if (state !== null) {
    sma = createSma({ period: smoothPeriod }, { fromState: state.smaState });
    count = state.count;
  } else {
    sma = createSma({ period: smoothPeriod });
    count = 0;
  }

  function rawBop(candle: NormalizedCandle): number {
    const range = candle.high - candle.low;
    if (range === 0) return 0;
    return (candle.close - candle.open) / range;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<BalanceOfPowerState>> = {
    next(candle: NormalizedCandle) {
      count++;
      const bop = rawBop(candle);
      return sma.next(makeCandle(candle.time, bop));
    },

    peek(candle: NormalizedCandle) {
      const bop = rawBop(candle);
      return sma.peek(makeCandle(candle.time, bop));
    },

    getState(): IndicatorSnapshot<BalanceOfPowerState> {
      return makeSnapshot(
        "balanceOfPower",
        BALANCE_OF_POWER_VERSION,
        { smoothPeriod },
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
