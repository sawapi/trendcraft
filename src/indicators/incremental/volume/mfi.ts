/**
 * Incremental Money Flow Index (MFI)
 *
 * Volume-weighted RSI that measures buying/selling pressure.
 *
 * Calculation:
 * 1. Typical Price = (H + L + C) / 3
 * 2. Raw Money Flow = TP × Volume
 * 3. Positive MF = sum over period where TP > prev TP
 * 4. Negative MF = sum over period where TP < prev TP
 * 5. MFI = 100 - 100 / (1 + Positive MF / Negative MF)
 *
 * Uses CircularBuffer to store money flow direction/amount for the lookback window.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

/**
 * State for incremental MFI
 */
export type MfiState = {
  period: number;
  prevTp: number | null;
  /** Buffer stores signed money flows: positive=up, negative=down, 0=unchanged */
  flowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  positiveSum: number;
  negativeSum: number;
  count: number;
};

/**
 * Create an incremental Money Flow Index indicator
 *
 * @example
 * ```ts
 * const mfiInd = createMfi({ period: 14 });
 * for (const candle of stream) {
 *   const result = mfiInd.next(candle);
 *   if (mfiInd.isWarmedUp) console.log(result.value);
 * }
 * ```
 */
export function createMfi(
  options: { period: number },
  warmUpOptions?: WarmUpOptions<MfiState>,
): IncrementalIndicator<number | null, MfiState> {
  const period = options.period;

  let prevTp: number | null;
  let flowBuffer: CircularBuffer<number>;
  let positiveSum: number;
  let negativeSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevTp = s.prevTp;
    flowBuffer = CircularBuffer.fromSnapshot(s.flowBuffer);
    positiveSum = s.positiveSum;
    negativeSum = s.negativeSum;
    count = s.count;
  } else {
    prevTp = null;
    flowBuffer = new CircularBuffer<number>(period);
    positiveSum = 0;
    negativeSum = 0;
    count = 0;
  }

  function computeNext(candle: NormalizedCandle): number | null {
    const tp = (candle.high + candle.low + candle.close) / 3;
    const rawMf = tp * candle.volume;
    count++;

    if (prevTp === null) {
      prevTp = tp;
      // First candle: no direction yet, store 0 as placeholder
      flowBuffer.push(0);
      return null;
    }

    // Determine direction
    let signedFlow: number;
    if (tp > prevTp) {
      signedFlow = rawMf;
    } else if (tp < prevTp) {
      signedFlow = -rawMf;
    } else {
      signedFlow = 0;
    }
    prevTp = tp;

    // Update sums: evict oldest if buffer is full
    if (flowBuffer.isFull) {
      const evicted = flowBuffer.oldest();
      if (evicted > 0) positiveSum -= evicted;
      else if (evicted < 0) negativeSum -= -evicted;
    }

    // Add new flow
    if (signedFlow > 0) positiveSum += signedFlow;
    else if (signedFlow < 0) negativeSum += -signedFlow;

    flowBuffer.push(signedFlow);

    // Need period + 1 candles (period for sums + 1 for first TP comparison)
    if (count <= period) {
      return null;
    }

    // Compute MFI
    if (negativeSum === 0) return 100;
    if (positiveSum === 0) return 0;
    const ratio = positiveSum / negativeSum;
    return 100 - 100 / (1 + ratio);
  }

  const indicator: IncrementalIndicator<number | null, MfiState> = {
    next(candle: NormalizedCandle) {
      const value = computeNext(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Save and restore for peek
      const savedState = indicator.getState();
      const result = indicator.next(candle);

      // Restore
      prevTp = savedState.prevTp;
      flowBuffer = CircularBuffer.fromSnapshot(savedState.flowBuffer);
      positiveSum = savedState.positiveSum;
      negativeSum = savedState.negativeSum;
      count = savedState.count;

      return result;
    },

    getState(): MfiState {
      return {
        period,
        prevTp,
        flowBuffer: flowBuffer.snapshot(),
        positiveSum,
        negativeSum,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count > period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
