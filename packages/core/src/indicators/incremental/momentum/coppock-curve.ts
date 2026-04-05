/**
 * Incremental Coppock Curve
 *
 * Coppock Curve = WMA(ROC(longPeriod) + ROC(shortPeriod), wmaPeriod)
 *
 * A momentum indicator originally designed for long-term monthly charts.
 * Buy signals occur when the Coppock Curve turns up from below zero.
 *
 * Composes: 2x ROC (long + short) + 1x WMA
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { createWma } from "../moving-average/wma";
import type { WmaState } from "../moving-average/wma";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice, makeCandle } from "../utils";
import { createRoc } from "./roc";
import type { RocState } from "./roc";

/**
 * State for incremental Coppock Curve
 */
export type CoppockCurveState = {
  wmaPeriod: number;
  longRocPeriod: number;
  shortRocPeriod: number;
  source: PriceSource;
  longRocState: RocState;
  shortRocState: RocState;
  wmaState: WmaState;
  count: number;
};

/**
 * Create an incremental Coppock Curve indicator
 *
 * @example
 * ```ts
 * const coppock = createCoppockCurve({ wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 });
 * for (const candle of stream) {
 *   const { value } = coppock.next(candle);
 *   if (coppock.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createCoppockCurve(
  options: {
    wmaPeriod?: number;
    longRocPeriod?: number;
    shortRocPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<CoppockCurveState>,
): IncrementalIndicator<number | null, CoppockCurveState> {
  const wmaPeriod = options.wmaPeriod ?? 10;
  const longRocPeriod = options.longRocPeriod ?? 14;
  const shortRocPeriod = options.shortRocPeriod ?? 11;
  const source: PriceSource = options.source ?? "close";

  let longRoc: ReturnType<typeof createRoc>;
  let shortRoc: ReturnType<typeof createRoc>;
  let wma: ReturnType<typeof createWma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    longRoc = createRoc({ period: longRocPeriod, source }, { fromState: s.longRocState });
    shortRoc = createRoc({ period: shortRocPeriod, source }, { fromState: s.shortRocState });
    wma = createWma({ period: wmaPeriod }, { fromState: s.wmaState });
    count = s.count;
  } else {
    longRoc = createRoc({ period: longRocPeriod, source });
    shortRoc = createRoc({ period: shortRocPeriod, source });
    wma = createWma({ period: wmaPeriod });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, CoppockCurveState> = {
    next(candle: NormalizedCandle) {
      count++;

      const longRocResult = longRoc.next(candle);
      const shortRocResult = shortRoc.next(candle);

      if (longRocResult.value !== null && shortRocResult.value !== null) {
        const rocSum = longRocResult.value + shortRocResult.value;
        const wmaResult = wma.next(makeCandle(candle.time, rocSum));
        return { time: candle.time, value: wmaResult.value };
      }

      return { time: candle.time, value: null };
    },

    peek(candle: NormalizedCandle) {
      const longRocVal = longRoc.peek(candle).value;
      const shortRocVal = shortRoc.peek(candle).value;

      if (longRocVal !== null && shortRocVal !== null) {
        const rocSum = longRocVal + shortRocVal;
        const wmaVal = wma.peek(makeCandle(candle.time, rocSum)).value;
        return { time: candle.time, value: wmaVal };
      }

      return { time: candle.time, value: null };
    },

    getState(): CoppockCurveState {
      return {
        wmaPeriod,
        longRocPeriod,
        shortRocPeriod,
        source,
        longRocState: longRoc.getState(),
        shortRocState: shortRoc.getState(),
        wmaState: wma.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return wma.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
