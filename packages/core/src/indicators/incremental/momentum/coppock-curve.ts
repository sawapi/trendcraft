/**
 * Incremental Coppock Curve
 *
 * Coppock Curve = WMA(ROC(longPeriod) + ROC(shortPeriod), wmaPeriod)
 *
 * A momentum indicator originally designed for long-term monthly charts.
 * Buy signals occur when the Coppock Curve turns up from below zero.
 *
 * State category: **Cascaded** (two ROC stages feeding a WMA). Resume
 * with a different `wmaPeriod` / `longRocPeriod` / `shortRocPeriod` /
 * `source` is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import type { WmaState } from "../moving-average/wma";
import { createWma } from "../moving-average/wma";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { makeCandle } from "../utils";
import type { RocState } from "./roc";
import { createRoc } from "./roc";

export type CoppockCurveState = {
  longRocState: IndicatorSnapshot<RocState>;
  shortRocState: IndicatorSnapshot<RocState>;
  wmaState: IndicatorSnapshot<WmaState>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const COPPOCK_CURVE_VERSION = 1;

type CoppockCurveParams = {
  wmaPeriod: number;
  longRocPeriod: number;
  shortRocPeriod: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<CoppockCurveState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<CoppockCurveState>> {
  const { params, state } = resolveResume<CoppockCurveParams, CoppockCurveState>({
    indicator: "coppockCurve",
    version: COPPOCK_CURVE_VERSION,
    category: "cascaded",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11, source: "close" },
  });

  const wmaPeriod = requireParam(
    "coppockCurve",
    params,
    "wmaPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const longRocPeriod = requireParam(
    "coppockCurve",
    params,
    "longRocPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const shortRocPeriod = requireParam(
    "coppockCurve",
    params,
    "shortRocPeriod",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const source = params.source;

  let longRoc: ReturnType<typeof createRoc>;
  let shortRoc: ReturnType<typeof createRoc>;
  let wma: ReturnType<typeof createWma>;
  let count: number;

  if (state !== null) {
    longRoc = createRoc({ period: longRocPeriod, source }, { fromState: state.longRocState });
    shortRoc = createRoc({ period: shortRocPeriod, source }, { fromState: state.shortRocState });
    wma = createWma({ period: wmaPeriod }, { fromState: state.wmaState });
    count = state.count;
  } else {
    longRoc = createRoc({ period: longRocPeriod, source });
    shortRoc = createRoc({ period: shortRocPeriod, source });
    wma = createWma({ period: wmaPeriod });
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<CoppockCurveState>> = {
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

    getState(): IndicatorSnapshot<CoppockCurveState> {
      return makeSnapshot(
        "coppockCurve",
        COPPOCK_CURVE_VERSION,
        { wmaPeriod, longRocPeriod, shortRocPeriod, source },
        {
          longRocState: longRoc.getState(),
          shortRocState: shortRoc.getState(),
          wmaState: wma.getState(),
          count,
        },
      );
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
