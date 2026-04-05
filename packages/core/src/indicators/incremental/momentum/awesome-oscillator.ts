/**
 * Incremental Awesome Oscillator (AO)
 *
 * AO = SMA(median, fastPeriod) - SMA(median, slowPeriod)
 * where median = (high + low) / 2
 *
 * Measures market momentum by comparing recent momentum to a larger timeframe.
 */

import type { NormalizedCandle } from "../../../types";
import { createSma } from "../moving-average/sma";
import type { SmaState } from "../moving-average/sma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";

export type AwesomeOscillatorState = {
  fastSmaState: SmaState;
  slowSmaState: SmaState;
  fastPeriod: number;
  slowPeriod: number;
  count: number;
};

/**
 * Create an incremental Awesome Oscillator indicator
 *
 * @example
 * ```ts
 * const ao = createAwesomeOscillator({ fastPeriod: 5, slowPeriod: 34 });
 * for (const candle of stream) {
 *   const { value } = ao.next(candle);
 *   if (ao.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAwesomeOscillator(
  options: { fastPeriod?: number; slowPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<AwesomeOscillatorState>,
): IncrementalIndicator<number | null, AwesomeOscillatorState> {
  const fastPeriod = options.fastPeriod ?? 5;
  const slowPeriod = options.slowPeriod ?? 34;

  let fastSma: ReturnType<typeof createSma>;
  let slowSma: ReturnType<typeof createSma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    fastSma = createSma({ period: fastPeriod }, { fromState: s.fastSmaState });
    slowSma = createSma({ period: slowPeriod }, { fromState: s.slowSmaState });
    count = s.count;
  } else {
    fastSma = createSma({ period: fastPeriod });
    slowSma = createSma({ period: slowPeriod });
    count = 0;
  }

  function computeAo(
    candle: NormalizedCandle,
    peek: boolean,
  ): { time: number; value: number | null } {
    const median = (candle.high + candle.low) / 2;
    const synth = makeCandle(candle.time, median);
    const fn = peek ? "peek" : "next";

    const fastVal = fastSma[fn](synth).value;
    const slowVal = slowSma[fn](synth).value;

    if (fastVal === null || slowVal === null) {
      return { time: candle.time, value: null };
    }

    return { time: candle.time, value: fastVal - slowVal };
  }

  const indicator: IncrementalIndicator<number | null, AwesomeOscillatorState> = {
    next(candle: NormalizedCandle) {
      count++;
      return computeAo(candle, false);
    },

    peek(candle: NormalizedCandle) {
      return computeAo(candle, true);
    },

    getState(): AwesomeOscillatorState {
      return {
        fastSmaState: fastSma.getState(),
        slowSmaState: slowSma.getState(),
        fastPeriod,
        slowPeriod,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return slowSma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
