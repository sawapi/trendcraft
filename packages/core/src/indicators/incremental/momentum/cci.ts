/**
 * Incremental Commodity Channel Index (CCI)
 *
 * CCI = (Typical Price - SMA of TP) / (constant × Mean Deviation)
 * Typical Price = (High + Low + Close) / 3
 *
 * State category: **Windowed** (a fixed-size typical-price buffer plus
 * a running `sum`). Resume with a different `period` carries the raw
 * typical prices forward and recomputes the running sum; `source`
 * change is refused. `constant` is a resume-invariant param — it only
 * scales the final projection, never the buffer or sum.
 *
 * Migrated to the 0.4.0 State Contract.
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
 * Bare state shape for CCI. Params (`period`, `constant`, `source`)
 * live in `meta.params` on the wire.
 */
export type CciState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  sum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const CCI_VERSION = 1;

type CciParams = {
  period: number;
  constant: number;
  source: PriceSource;
};

/**
 * Create an incremental Commodity Channel Index indicator
 *
 * @example
 * ```ts
 * const cciInd = createCci({ period: 20 });
 * for (const candle of stream) {
 *   const result = cciInd.next(candle);
 *   if (cciInd.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createCci(
  options: { period?: number; constant?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<CciState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<CciState>> {
  const { params, state, reconfigured } = resolveResume<CciParams, CciState>({
    indicator: "cci",
    version: CCI_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { constant: 0.015, source: "hlc3" },
    resumeInvariantParams: ["constant"],
  });

  const period = requireParam(
    "cci",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );
  const constant = params.constant;
  const source = params.source;

  let buffer: CircularBuffer<number>;
  let sum: number;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw typical prices forward and
      // recompute the running sum against the new window.
      const old = CircularBuffer.fromSnapshot<number>(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
      sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer.get(i);
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      sum = state.sum;
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    sum = 0;
    count = 0;
  }

  function computeCci(tp: number, buf: CircularBuffer<number>, currentSum: number): number | null {
    if (buf.length < period) return null;

    const smaTP = currentSum / period;

    // Calculate mean deviation
    let meanDev = 0;
    for (let i = 0; i < buf.length; i++) {
      meanDev += Math.abs(buf.get(i) - smaTP);
    }
    meanDev /= period;

    return meanDev !== 0 ? (tp - smaTP) / (constant * meanDev) : 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<CciState>> = {
    next(candle: NormalizedCandle) {
      const tp = getSourcePrice(candle, source);

      if (buffer.isFull) {
        sum = sum - buffer.oldest() + tp;
      } else {
        sum += tp;
      }
      buffer.push(tp);
      count++;

      const value = computeCci(tp, buffer, sum);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const tp = getSourcePrice(candle, source);

      let newSum: number;
      if (buffer.isFull) {
        newSum = sum - buffer.oldest() + tp;
      } else {
        newSum = sum + tp;
      }

      // Create temporary buffer for mean deviation calculation
      const tempBuf = CircularBuffer.fromSnapshot(buffer.snapshot());
      tempBuf.push(tp);

      const value = computeCci(tp, tempBuf, newSum);
      return { time: candle.time, value };
    },

    getState(): IndicatorSnapshot<CciState> {
      return makeSnapshot(
        "cci",
        CCI_VERSION,
        { period, constant, source },
        { buffer: buffer.snapshot(), sum, count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // Gate on buffer fill, not `count`: after a period-growing resume
      // the carried buffer is shorter than the old `count`, and
      // computeCci() still returns null until it refills.
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
