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
 *    (no flow on either side reads 50; only positive 100; only negative 0)
 *
 * Uses CircularBuffer to store money flow direction/amount for the lookback window.
 *
 * State category: **Mixed** (a fixed-size buffer of *derived* signed
 * money flows plus the recursive `prevTp` carry-over needed to sign
 * the next flow). Resume with a different `period` is refused — the
 * window length is baked into the buffered flows.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";

/**
 * Bare state shape for MFI. `period` lives in `meta.params`.
 */
export type MfiState = {
  prevTp: number | null;
  /** Buffer stores signed money flows: positive=up, negative=down, 0=unchanged */
  flowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  positiveSum: number;
  negativeSum: number;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const MFI_VERSION = 1;

type MfiParams = {
  period: number;
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
  options: { period?: number } = {},
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<MfiState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<MfiState>> {
  const { params, state } = resolveResume<MfiParams, MfiState>({
    indicator: "mfi",
    version: MFI_VERSION,
    category: "mixed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { period: 14 },
  });

  const period = requireParam(
    "mfi",
    params,
    "period",
    (v): v is number => Number.isInteger(v) && v >= 1,
    "must be a positive integer",
  );

  let prevTp: number | null;
  let flowBuffer: CircularBuffer<number>;
  let positiveSum: number;
  let negativeSum: number;
  let count: number;

  if (state !== null) {
    prevTp = state.prevTp;
    flowBuffer = CircularBuffer.fromSnapshot(state.flowBuffer);
    positiveSum = state.positiveSum;
    negativeSum = state.negativeSum;
    count = state.count;
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

    flowBuffer.push(signedFlow);

    // Rebuild both sums from the window, oldest first — the same terms in the
    // same order as the batch `mfi`, so the two agree bit for bit. A running
    // sum with eviction leaves floating-point residue behind once the flows
    // that produced it are gone, and a residue of 1e-14 is enough to turn a
    // window with no flow at all into a 100 or 0 reading.
    positiveSum = 0;
    negativeSum = 0;
    for (let i = 0; i < flowBuffer.length; i++) {
      const flow = flowBuffer.get(i);
      if (flow > 0) positiveSum += flow;
      else if (flow < 0) negativeSum -= flow;
    }

    // Need period + 1 candles (period for sums + 1 for first TP comparison)
    if (count <= period) {
      return null;
    }

    // Compute MFI. Both sums zero (flat typical price or zero volume) reads
    // neutral, matching the batch `mfi` and this library's RSI.
    if (positiveSum === 0 && negativeSum === 0) return 50;
    if (negativeSum === 0) return 100;
    if (positiveSum === 0) return 0;
    const ratio = positiveSum / negativeSum;
    return 100 - 100 / (1 + ratio);
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<MfiState>> = {
    next(candle: NormalizedCandle) {
      const value = computeNext(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Save and restore for peek
      const savedTp = prevTp;
      const savedBuffer = flowBuffer.snapshot();
      const savedPositive = positiveSum;
      const savedNegative = negativeSum;
      const savedCount = count;

      const result = indicator.next(candle);

      // Restore
      prevTp = savedTp;
      flowBuffer = CircularBuffer.fromSnapshot(savedBuffer);
      positiveSum = savedPositive;
      negativeSum = savedNegative;
      count = savedCount;

      return result;
    },

    getState(): IndicatorSnapshot<MfiState> {
      return makeSnapshot(
        "mfi",
        MFI_VERSION,
        { period },
        {
          prevTp,
          flowBuffer: flowBuffer.snapshot(),
          positiveSum,
          negativeSum,
          count,
        },
      );
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
