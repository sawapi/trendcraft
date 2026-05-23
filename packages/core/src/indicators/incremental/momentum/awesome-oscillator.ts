/**
 * Incremental Awesome Oscillator (AO)
 *
 * AO = SMA(median, fastPeriod) - SMA(median, slowPeriod)
 * where median = (high + low) / 2
 *
 * State category: **Cascaded** (composes two inner incremental SMAs).
 * Resume with a different `fastPeriod` / `slowPeriod` is refused.
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
 * Bare state shape for Awesome Oscillator. Params (`fastPeriod`,
 * `slowPeriod`) live in `meta.params` on the wire.
 */
export type AwesomeOscillatorState = {
  fastSmaState: IndicatorSnapshot<SmaState>;
  slowSmaState: IndicatorSnapshot<SmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const AWESOME_OSCILLATOR_VERSION = 1;

type AwesomeOscillatorParams = {
  fastPeriod: number;
  slowPeriod: number;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<AwesomeOscillatorState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<AwesomeOscillatorState>> {
  const { params, state } = resolveResume<AwesomeOscillatorParams, AwesomeOscillatorState>({
    indicator: "awesomeOscillator",
    version: AWESOME_OSCILLATOR_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { fastPeriod: 5, slowPeriod: 34 },
  });

  const isPositiveInt = (v: number): v is number => Number.isInteger(v) && v >= 1;
  const fastPeriod = requireParam(
    "awesomeOscillator",
    params,
    "fastPeriod",
    isPositiveInt,
    "must be a positive integer",
  );
  const slowPeriod = requireParam(
    "awesomeOscillator",
    params,
    "slowPeriod",
    isPositiveInt,
    "must be a positive integer",
  );

  let fastSma: ReturnType<typeof createSma>;
  let slowSma: ReturnType<typeof createSma>;
  let count: number;

  if (state !== null) {
    fastSma = createSma({ period: fastPeriod }, { fromState: state.fastSmaState });
    slowSma = createSma({ period: slowPeriod }, { fromState: state.slowSmaState });
    count = state.count;
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

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<AwesomeOscillatorState>
  > = {
    next(candle: NormalizedCandle) {
      count++;
      return computeAo(candle, false);
    },

    peek(candle: NormalizedCandle) {
      return computeAo(candle, true);
    },

    getState(): IndicatorSnapshot<AwesomeOscillatorState> {
      return makeSnapshot(
        "awesomeOscillator",
        AWESOME_OSCILLATOR_VERSION,
        { fastPeriod, slowPeriod },
        {
          fastSmaState: fastSma.getState(),
          slowSmaState: slowSma.getState(),
          count,
        },
      );
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
