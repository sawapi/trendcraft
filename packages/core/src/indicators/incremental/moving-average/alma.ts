/**
 * Incremental ALMA (Arnaud Legoux Moving Average)
 *
 * Uses a Gaussian distribution to weight prices in a sliding window.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type AlmaState = {
  period: number;
  offset: number;
  sigma: number;
  source: PriceSource;
  weights: number[];
  buffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/**
 * Create an incremental ALMA indicator
 *
 * @example
 * ```ts
 * const alma = createAlma({ period: 9, offset: 0.85, sigma: 6 });
 * for (const candle of stream) {
 *   const { value } = alma.next(candle);
 *   if (alma.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createAlma(
  options: { period?: number; offset?: number; sigma?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<AlmaState>,
): IncrementalIndicator<number | null, AlmaState> {
  // Resume order: explicit option > persisted state > canonical default.
  // Reading the snapshot first is critical — every parameter shapes the
  // pre-computed Gaussian weights and the sliding-window buffer size, so
  // silently swapping to defaults on resume produces a discontinuous
  // ALMA after restore.
  const fs = warmUpOptions?.fromState ?? null;
  const period = options.period ?? fs?.period ?? 9;
  const offset = options.offset ?? fs?.offset ?? 0.85;
  const sigma = options.sigma ?? fs?.sigma ?? 6;
  const source: PriceSource = options.source ?? fs?.source ?? "close";

  // Pre-compute normalized Gaussian weights (Pine Script convention:
  // `m = offset * (period - 1)`, matching TradingView's `ta.alma()`).
  // Some references use `m = offset * period` instead — the magnitude
  // shift is small; we standardize on the Pine Script form.
  const m = offset * (period - 1);
  const sd = period / sigma;
  const weights: number[] = new Array(period);
  let weightSum = 0;

  for (let i = 0; i < period; i++) {
    const w = Math.exp(-((i - m) * (i - m)) / (2 * sd * sd));
    weights[i] = w;
    weightSum += w;
  }
  for (let i = 0; i < period; i++) {
    weights[i] /= weightSum;
  }

  // The snapshot stores raw source prices, not derived state. That
  // means a *shape*-only parameter change on resume (period / offset /
  // sigma) only invalidates the weights — the buffered prices remain
  // valid input. Carry the latest min(snapshot.length, new period)
  // prices into a buffer of the new capacity so re-parameterization
  // can emit a value immediately when enough history is on hand.
  //
  // A `source` change is different: the old buffer holds numbers
  // derived from the old source (e.g. `close`) and would mix
  // mathematically with new source values (e.g. `high`) for the next
  // `period` outputs. When source differs, the buffered prices have to
  // be discarded — the new indicator starts a fresh warm-up.
  const shapeMatchesSnapshot =
    fs !== null && fs.period === period && fs.offset === offset && fs.sigma === sigma;
  const sourceMatchesSnapshot = fs !== null && fs.source === source;
  const snapshotMatches = shapeMatchesSnapshot && sourceMatchesSnapshot;

  let buffer: CircularBuffer<number>;
  let count: number;

  if (fs !== null && snapshotMatches) {
    buffer = CircularBuffer.fromSnapshot(fs.buffer);
    count = fs.count;
  } else if (fs !== null && sourceMatchesSnapshot) {
    // Shape change only — buffered source prices stay valid.
    buffer = new CircularBuffer<number>(period);
    const oldBuffer = CircularBuffer.fromSnapshot(fs.buffer);
    const available = oldBuffer.length;
    const carryStart = Math.max(0, available - period);
    for (let i = carryStart; i < available; i++) {
      buffer.push(oldBuffer.get(i));
    }
    // Preserve the public count contract — `count` is "candles
    // processed so far" across the indicator's whole lifetime.
    // Warm-up readiness uses `buffer.length >= period` instead, so a
    // grown period correctly stays not-warmed-up even though count
    // is large.
    count = fs.count;
  } else {
    // Fresh start (fs === null) — count begins at 0 by definition.
    // For a source change we *also* discard buffered prices because
    // their meaning shifts (close vs high vs hl2 etc.), but we keep
    // `fs.count` so the public processed-candles counter stays
    // monotonic across the reconfiguration.
    buffer = new CircularBuffer<number>(period);
    count = fs?.count ?? 0;
  }

  function computeAlma(): number {
    let value = 0;
    for (let i = 0; i < period; i++) {
      value += weights[i] * buffer.get(i);
    }
    return value;
  }

  const indicator: IncrementalIndicator<number | null, AlmaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      // Warm-up is gated on the *buffer* having `period` samples, not
      // on the public `count`. A shape-only resume can carry forward
      // historical prices (so buffer is full and we emit immediately
      // even though count is the old run's total), and a grown-period
      // resume needs more bars even when count is already large.
      if (buffer.length < period) {
        return { time: candle.time, value: null };
      }

      return { time: candle.time, value: computeAlma() };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      // Buffer-based warm-up gate (see next()'s comment). A simulated
      // push grows length by 1 until the buffer is full, then it caps.
      const peekLength = Math.min(buffer.length + 1, period);
      if (peekLength < period) {
        return { time: candle.time, value: null };
      }

      // Simulate buffer with new price appended
      let value = 0;
      const len = buffer.length;

      if (len < period) {
        // Buffer not yet full: existing items + new price
        for (let i = 0; i < len; i++) {
          // Shift by 1: weight[i] → buffer[i] but offset since buffer is shorter
          value += weights[i] * buffer.get(i);
        }
        value += weights[len] * price;
      } else {
        // Buffer full: oldest gets evicted, everything shifts left
        for (let i = 0; i < period - 1; i++) {
          value += weights[i] * buffer.get(i + 1);
        }
        value += weights[period - 1] * price;
      }

      return { time: candle.time, value };
    },

    getState(): AlmaState {
      return {
        period,
        offset,
        sigma,
        source,
        weights: [...weights],
        buffer: buffer.snapshot(),
        count,
      };
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
