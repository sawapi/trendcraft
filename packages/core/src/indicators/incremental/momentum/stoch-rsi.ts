/**
 * Incremental Stochastic RSI (StochRSI)
 *
 * Applies Stochastic oscillator to RSI values.
 *
 * Steps:
 * 1. Calculate RSI incrementally
 * 2. Apply Stochastic (min/max over lookback) to RSI
 * 3. Smooth with SMA for %K
 * 4. Smooth %K with SMA for %D
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

/**
 * StochRSI output value
 */
export type StochRsiValue = {
  stochRsi: number | null;
  k: number | null;
  d: number | null;
};

/**
 * State for incremental StochRSI
 */
export type StochRsiState = {
  rsiPeriod: number;
  stochPeriod: number;
  kPeriod: number;
  dPeriod: number;
  count: number;
  // RSI state
  prevClose: number | null;
  avgGain: number;
  avgLoss: number;
  rsiCount: number;
  initialGains: number[];
  initialLosses: number[];
  // Stochastic on RSI
  rsiBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rsiValidCount: number;
  // K smoothing (SMA of raw stochRSI)
  rawStochBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  rawStochSum: number;
  rawStochValidCount: number;
  // D smoothing (SMA of K)
  kBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  kSum: number;
  kValidCount: number;
};

/**
 * Create an incremental Stochastic RSI indicator
 *
 * @example
 * ```ts
 * const srsi = createStochRsi({ rsiPeriod: 14, stochPeriod: 14 });
 * for (const candle of stream) {
 *   const { value } = srsi.next(candle);
 *   if (srsi.isWarmedUp) console.log(value.k, value.d);
 * }
 * ```
 */
export function createStochRsi(
  options: {
    rsiPeriod?: number;
    stochPeriod?: number;
    kPeriod?: number;
    dPeriod?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<StochRsiState>,
): IncrementalIndicator<StochRsiValue, StochRsiState> {
  const rsiPeriod = options.rsiPeriod ?? 14;
  const stochPeriod = options.stochPeriod ?? 14;
  const kPeriod = options.kPeriod ?? 3;
  const dPeriod = options.dPeriod ?? 3;
  const source: PriceSource = options.source ?? "close";

  let count: number;
  let prevClose: number | null;
  let avgGain: number;
  let avgLoss: number;
  let rsiCount: number;
  let initialGains: number[];
  let initialLosses: number[];
  let rsiBuffer: CircularBuffer<number>;
  let rsiValidCount: number;
  let rawStochBuffer: CircularBuffer<number>;
  let rawStochSum: number;
  let rawStochValidCount: number;
  let kBuffer: CircularBuffer<number>;
  let kSum: number;
  let kValidCount: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    count = s.count;
    prevClose = s.prevClose;
    avgGain = s.avgGain;
    avgLoss = s.avgLoss;
    rsiCount = s.rsiCount;
    initialGains = [...s.initialGains];
    initialLosses = [...s.initialLosses];
    rsiBuffer = CircularBuffer.fromSnapshot(s.rsiBuffer);
    rsiValidCount = s.rsiValidCount;
    rawStochBuffer = CircularBuffer.fromSnapshot(s.rawStochBuffer);
    rawStochSum = s.rawStochSum;
    rawStochValidCount = s.rawStochValidCount;
    kBuffer = CircularBuffer.fromSnapshot(s.kBuffer);
    kSum = s.kSum;
    kValidCount = s.kValidCount;
  } else {
    count = 0;
    prevClose = null;
    avgGain = 0;
    avgLoss = 0;
    rsiCount = 0;
    initialGains = [];
    initialLosses = [];
    rsiBuffer = new CircularBuffer<number>(stochPeriod);
    rsiValidCount = 0;
    rawStochBuffer = new CircularBuffer<number>(kPeriod);
    rawStochSum = 0;
    rawStochValidCount = 0;
    kBuffer = new CircularBuffer<number>(dPeriod);
    kSum = 0;
    kValidCount = 0;
  }

  /**
   * Compute RSI value from current state (returns null if not warmed up)
   */
  function computeRsi(close: number): number | null {
    rsiCount++;

    if (prevClose === null) {
      prevClose = close;
      return null;
    }

    const change = close - prevClose;
    prevClose = close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (rsiCount <= rsiPeriod) {
      initialGains.push(gain);
      initialLosses.push(loss);
      return null;
    }

    if (rsiCount === rsiPeriod + 1) {
      // First RSI: use simple average
      let gainSum = 0;
      let lossSum = 0;
      for (let i = 0; i < initialGains.length; i++) {
        gainSum += initialGains[i];
        lossSum += initialLosses[i];
      }
      avgGain = (gainSum + gain) / rsiPeriod;
      avgLoss = (lossSum + loss) / rsiPeriod;
    } else {
      // Wilder's smoothing
      avgGain = (avgGain * (rsiPeriod - 1) + gain) / rsiPeriod;
      avgLoss = (avgLoss * (rsiPeriod - 1) + loss) / rsiPeriod;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  /**
   * Apply stochastic to RSI and compute K, D
   */
  function processRsi(rsiVal: number | null): StochRsiValue {
    if (rsiVal === null) {
      return { stochRsi: null, k: null, d: null };
    }

    rsiBuffer.push(rsiVal);
    rsiValidCount++;

    // Need stochPeriod RSI values for stochastic
    if (rsiValidCount < stochPeriod) {
      return { stochRsi: null, k: null, d: null };
    }

    // Find min/max RSI in buffer
    let minRsi = rsiBuffer.get(0);
    let maxRsi = rsiBuffer.get(0);
    for (let i = 1; i < rsiBuffer.length; i++) {
      const v = rsiBuffer.get(i);
      if (v < minRsi) minRsi = v;
      if (v > maxRsi) maxRsi = v;
    }

    const range = maxRsi - minRsi;
    const rawStoch = range === 0 ? 50 : ((rsiVal - minRsi) / range) * 100;

    // K = SMA of raw stochRSI
    if (rawStochBuffer.isFull) {
      rawStochSum = rawStochSum - rawStochBuffer.oldest() + rawStoch;
    } else {
      rawStochSum += rawStoch;
    }
    rawStochBuffer.push(rawStoch);
    rawStochValidCount++;

    if (rawStochValidCount < kPeriod) {
      return { stochRsi: rawStoch, k: null, d: null };
    }

    const kVal = rawStochSum / kPeriod;

    // D = SMA of K
    if (kBuffer.isFull) {
      kSum = kSum - kBuffer.oldest() + kVal;
    } else {
      kSum += kVal;
    }
    kBuffer.push(kVal);
    kValidCount++;

    if (kValidCount < dPeriod) {
      return { stochRsi: rawStoch, k: kVal, d: null };
    }

    const dVal = kSum / dPeriod;
    return { stochRsi: rawStoch, k: kVal, d: dVal };
  }

  const indicator: IncrementalIndicator<StochRsiValue, StochRsiState> = {
    next(candle: NormalizedCandle) {
      count++;
      const rsiVal = computeRsi(getSourcePrice(candle, source));
      const value = processRsi(rsiVal);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Save state, compute, restore
      const savedState = indicator.getState();
      const result = indicator.next(candle);

      // Restore state
      count = savedState.count;
      prevClose = savedState.prevClose;
      avgGain = savedState.avgGain;
      avgLoss = savedState.avgLoss;
      rsiCount = savedState.rsiCount;
      initialGains = [...savedState.initialGains];
      initialLosses = [...savedState.initialLosses];
      rsiBuffer = CircularBuffer.fromSnapshot(savedState.rsiBuffer);
      rsiValidCount = savedState.rsiValidCount;
      rawStochBuffer = CircularBuffer.fromSnapshot(savedState.rawStochBuffer);
      rawStochSum = savedState.rawStochSum;
      rawStochValidCount = savedState.rawStochValidCount;
      kBuffer = CircularBuffer.fromSnapshot(savedState.kBuffer);
      kSum = savedState.kSum;
      kValidCount = savedState.kValidCount;

      return result;
    },

    getState(): StochRsiState {
      return {
        rsiPeriod,
        stochPeriod,
        kPeriod,
        dPeriod,
        count,
        prevClose,
        avgGain,
        avgLoss,
        rsiCount,
        initialGains: [...initialGains],
        initialLosses: [...initialLosses],
        rsiBuffer: rsiBuffer.snapshot(),
        rsiValidCount,
        rawStochBuffer: rawStochBuffer.snapshot(),
        rawStochSum,
        rawStochValidCount,
        kBuffer: kBuffer.snapshot(),
        kSum,
        kValidCount,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return kValidCount >= dPeriod;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
