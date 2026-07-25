/**
 * Incremental Linear Regression
 *
 * Rolling least-squares fit over the last `period` prices with x = 0..period-1
 * indexed within the window. Each bar's fit is recomputed from the window
 * itself (O(period)), running the same arithmetic as the batch
 * `linearRegression()` so the two agree by construction.
 *
 * Running sums (sumY, sumY², sumXY) would make this O(1) per bar, but the
 * uncentred r² term `period·sumY² − sumY²` cancels catastrophically once
 * prices are large relative to their spread: r² collapsed to 0 on 204 of 287
 * bars at price ~1e8, breaking parity with the batch indicator, and the drift
 * persisted into snapshots.
 *
 * State category: **Windowed** (a raw price buffer). Warmup is gated on
 * `buffer.isFull`, not a monotonic `count`, so resume with a different
 * `period` carries the buffer forward correctly; `source` change is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import { slopeOverIndex } from "../../../core/statistics";
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

export type LinearRegressionValue = {
  value: number;
  slope: number;
  intercept: number;
  rSquared: number;
};

/**
 * Bare state shape for Linear Regression. Params (`period`, `source`)
 * live in `meta.params` on the wire.
 */
export type LinearRegressionState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Per-indicator schema version. Bumped on any breaking state change.
 *
 * v2 dropped the running `sumY`/`sumY2`/`sumXY`: the r² term derived from
 * them was numerically unsound and their drift survived snapshot/restore.
 */
export const LINEAR_REGRESSION_VERSION = 2;

type LinearRegressionParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Linear Regression indicator.
 *
 * @example
 * ```ts
 * const lr = createLinearRegression({ period: 14 });
 * for (const candle of stream) {
 *   const { value } = lr.next(candle);
 *   if (value && value.rSquared > 0.8) console.log("strong trend, slope=", value.slope);
 * }
 * ```
 */
export function createLinearRegression(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<LinearRegressionState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<LinearRegressionValue | null, IndicatorSnapshot<LinearRegressionState>> {
  const { params, state, reconfigured } = resolveResume<
    LinearRegressionParams,
    LinearRegressionState
  >({
    indicator: "linearRegression",
    version: LINEAR_REGRESSION_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14, source: "close" },
  });

  const period = requireParam(
    "linearRegression",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const source = params.source;

  // Closed-form constants for x = 0..period-1
  const sumX = (period * (period - 1)) / 2;

  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period changed — carry the raw prices forward into the new window.
      const old = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const carry = Math.min(old.length, period);
      for (let i = old.length - carry; i < old.length; i++) {
        buffer.push(old.get(i));
      }
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
    }
    count = state.count;
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  /**
   * Least-squares fit over a full window, mirroring the batch indicator:
   * slope/intercept from the closed-form x sums, then r² from the actual
   * residuals about the window mean. Computing r² from centred sums of
   * squares is what keeps it meaningful at high price levels.
   */
  function fitWindow(window: readonly number[]): LinearRegressionValue {
    let sumY = 0;
    for (let j = 0; j < period; j++) sumY += window[j];

    const slope = slopeOverIndex(window);
    const intercept = (sumY - slope * sumX) / period;

    const meanY = sumY / period;
    let ssTot = 0;
    let ssRes = 0;
    for (let j = 0; j < period; j++) {
      const dy = window[j] - meanY;
      const res = window[j] - (intercept + slope * j);
      ssTot += dy * dy;
      ssRes += res * res;
    }
    const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return {
      value: intercept + slope * (period - 1),
      slope,
      intercept,
      rSquared: Math.min(1, Math.max(0, rSquared)),
    };
  }

  function compute(): LinearRegressionValue | null {
    if (!buffer.isFull) return null;
    return fitWindow(buffer.toArray());
  }

  const indicator: IncrementalIndicator<
    LinearRegressionValue | null,
    IndicatorSnapshot<LinearRegressionState>
  > = {
    next(candle: NormalizedCandle) {
      buffer.push(getSourcePrice(candle, source));
      count++;
      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const y = getSourcePrice(candle, source);
      if (!buffer.isFull && buffer.length + 1 < period) {
        return { time: candle.time, value: null };
      }

      // The window the buffer would hold after pushing `y`.
      const window = buffer.toArray().slice(buffer.isFull ? 1 : 0);
      window.push(y);

      return { time: candle.time, value: fitWindow(window) };
    },

    getState(): IndicatorSnapshot<LinearRegressionState> {
      return makeSnapshot(
        "linearRegression",
        LINEAR_REGRESSION_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return buffer.isFull;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
