/**
 * Incremental Standard Deviation
 *
 * State category: **Windowed** (raw price buffer; window statistics are
 * recomputed from it each bar, O(period)).
 * Migrated to the 0.4.0 State Contract: `getState()` returns
 * `IndicatorSnapshot<StandardDeviationState>` and `fromState` accepts
 * the same.
 *
 * Rolling population standard deviation (divides by N, matching the
 * batch `standardDeviation()` and TA-Lib convention).
 *
 * Defaults: `period` defaults to 20 and `source` to `"close"`, the same as
 * the batch `standardDeviation()`.
 */

import { centeredMoments } from "../../../core/statistics";
import type { NormalizedCandle, PriceSource } from "../../../types";
import { assertPriceSource } from "../../../utils/validate-price-source";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requirePeriod,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for Standard Deviation. Params (`period`, `source`)
 * live in `meta.params` on the wire — they are not part of the bare state.
 */
export type StandardDeviationState = {
  buffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Per-indicator schema version. Bump on any breaking state change.
 *
 * v2 dropped the running `sum`/`sumSq`: they were the source of a drift that
 * survived snapshot/restore, and the buffer alone determines the window.
 */
export const STANDARD_DEVIATION_VERSION = 2;

type StandardDeviationParams = {
  period: number;
  source: PriceSource;
};

/**
 * Create an incremental Standard Deviation indicator.
 *
 * @example
 * ```ts
 * // Fresh start — period is required on first call.
 * const sd = createStandardDeviation({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = sd.next(candle);
 *   if (sd.isWarmedUp) console.log(value);
 * }
 *
 * // Resume from a saved snapshot — period may be omitted; the
 * // snapshot supplies it.
 * const resumed = createStandardDeviation({}, { fromState: snapshot });
 * ```
 */
export function createStandardDeviation(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<StandardDeviationState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<StandardDeviationState>> {
  const { params, state, reconfigured } = resolveResume<
    StandardDeviationParams,
    StandardDeviationState
  >({
    indicator: "standardDeviation",
    version: STANDARD_DEVIATION_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 20, source: "close" }, // same as the batch standardDeviation()
  });

  const period = requirePeriod("standardDeviation", params, "period");
  const source = params.source;
  assertPriceSource("Standard Deviation source", source);

  let buffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // Period change. The snapshot's buffer is at the OLD capacity;
      // rebuild at the NEW capacity holding the most recent
      // min(snapshot.length, newPeriod) samples.
      const oldBuffer = CircularBuffer.fromSnapshot(state.buffer);
      buffer = new CircularBuffer<number>(period);
      const available = oldBuffer.length;
      const carryStart = Math.max(0, available - period);
      for (let i = carryStart; i < available; i++) {
        buffer.push(oldBuffer.get(i));
      }
      count = state.count;
    } else {
      buffer = CircularBuffer.fromSnapshot(state.buffer);
      count = state.count;
    }
  } else {
    buffer = new CircularBuffer<number>(period);
    count = 0;
  }

  /**
   * Population standard deviation of the window, recomputed from the buffer.
   *
   * A running sum-of-squares would be O(1) per bar but cancels catastrophically
   * once prices are large relative to their spread (over 700% error at price
   * ~1e8), diverging from the two-pass batch `standardDeviation()` it is
   * contracted to match — and the drift persisted into snapshots, so a resumed
   * stream stayed wrong. See centeredMoments.
   */
  function stdDevOf(window: readonly number[]): number {
    return Math.sqrt(centeredMoments(window).sumSqDev / period);
  }

  function compute(): number | null {
    if (buffer.length < period) return null;
    return stdDevOf(buffer.toArray());
  }

  const indicator: IncrementalIndicator<
    number | null,
    IndicatorSnapshot<StandardDeviationState>
  > = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      buffer.push(price);
      count++;
      return { time: candle.time, value: compute() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      if (Math.min(buffer.length + 1, period) < period) {
        return { time: candle.time, value: null };
      }
      // The window the buffer would hold after pushing `price`.
      const window = buffer.toArray().slice(buffer.isFull ? 1 : 0);
      window.push(price);
      return { time: candle.time, value: stdDevOf(window) };
    },

    getState(): IndicatorSnapshot<StandardDeviationState> {
      return makeSnapshot(
        "standardDeviation",
        STANDARD_DEVIATION_VERSION,
        { period, source },
        { buffer: buffer.snapshot(), count },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
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
