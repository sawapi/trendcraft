/**
 * Incremental QStick
 *
 * QStick = SMA(close - open, period)
 * Measures the dominance of buying or selling pressure via candlestick body.
 */

import type { NormalizedCandle } from "../../../types";
import { createSma } from "../moving-average/sma";
import type { SmaState } from "../moving-average/sma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";

export type QStickState = {
  smaState: SmaState;
  period: number;
  count: number;
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
  warmUpOptions?: WarmUpOptions<QStickState>,
): IncrementalIndicator<number | null, QStickState> {
  const period = options.period ?? 14;

  let sma: ReturnType<typeof createSma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    sma = createSma({ period }, { fromState: s.smaState });
    count = s.count;
  } else {
    sma = createSma({ period });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, QStickState> = {
    next(candle: NormalizedCandle) {
      count++;
      const diff = candle.close - candle.open;
      return sma.next(makeCandle(candle.time, diff));
    },

    peek(candle: NormalizedCandle) {
      const diff = candle.close - candle.open;
      return sma.peek(makeCandle(candle.time, diff));
    },

    getState(): QStickState {
      return {
        smaState: sma.getState(),
        period,
        count,
      };
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
