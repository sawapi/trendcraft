/**
 * Incremental Schaff Trend Cycle (STC)
 *
 * Combines MACD with double Stochastic smoothing:
 * 1. MACD = EMA(fast) - EMA(slow)
 * 2. Stochastic of MACD over cyclePeriod → smooth with factor → PF
 * 3. Stochastic of PF over cyclePeriod → smooth with factor → STC
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type StcState = {
  fastPeriod: number;
  slowPeriod: number;
  cyclePeriod: number;
  factor: number;
  source: PriceSource;
  fastEma: number | null;
  slowEma: number | null;
  fastSum: number;
  slowSum: number;
  fastMult: number;
  slowMult: number;
  macdBuffer: { data: (number | null)[]; head: number; length: number; capacity: number };
  prevPf: number;
  pfBuffer: { data: (number | null)[]; head: number; length: number; capacity: number };
  prevStc: number;
  firstPfDone: boolean;
  firstStcDone: boolean;
  count: number;
};

/**
 * Create an incremental STC indicator
 *
 * @example
 * ```ts
 * const stc = createStc({ fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 });
 * for (const candle of stream) {
 *   const { value } = stc.next(candle);
 *   if (stc.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createStc(
  options: {
    fastPeriod?: number;
    slowPeriod?: number;
    cyclePeriod?: number;
    factor?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<StcState>,
): IncrementalIndicator<number | null, StcState> {
  const fastPeriod = options.fastPeriod ?? 23;
  const slowPeriod = options.slowPeriod ?? 50;
  const cyclePeriod = options.cyclePeriod ?? 10;
  const factor = options.factor ?? 0.5;
  const source: PriceSource = options.source ?? "close";
  const fastMult = 2 / (fastPeriod + 1);
  const slowMult = 2 / (slowPeriod + 1);

  let fastEma: number | null;
  let slowEma: number | null;
  let fastSum: number;
  let slowSum: number;
  let macdBuffer: CircularBuffer<number | null>;
  let prevPf: number;
  let pfBuffer: CircularBuffer<number | null>;
  let prevStc: number;
  let firstPfDone: boolean;
  let firstStcDone: boolean;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    fastEma = s.fastEma;
    slowEma = s.slowEma;
    fastSum = s.fastSum;
    slowSum = s.slowSum;
    macdBuffer = CircularBuffer.fromSnapshot(s.macdBuffer);
    prevPf = s.prevPf;
    pfBuffer = CircularBuffer.fromSnapshot(s.pfBuffer);
    prevStc = s.prevStc;
    firstPfDone = s.firstPfDone;
    firstStcDone = s.firstStcDone;
    count = s.count;
  } else {
    fastEma = null;
    slowEma = null;
    fastSum = 0;
    slowSum = 0;
    macdBuffer = new CircularBuffer<number | null>(cyclePeriod);
    prevPf = 0;
    pfBuffer = new CircularBuffer<number | null>(cyclePeriod);
    prevStc = 0;
    firstPfDone = false;
    firstStcDone = false;
    count = 0;
  }

  function updateEma(
    price: number,
    prev: number | null,
    sum: number,
    period: number,
    mult: number,
    cnt: number,
  ): { ema: number | null; sum: number } {
    if (cnt < period) return { ema: null, sum: sum + price };
    if (cnt === period) {
      const s = sum + price;
      return { ema: s / period, sum: s };
    }
    return { ema: price * mult + (prev ?? 0) * (1 - mult), sum };
  }

  function bufferMinMax(buf: CircularBuffer<number | null>): { min: number; max: number } | null {
    if (buf.length < cyclePeriod) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      const v = buf.get(i);
      if (v === null) return null;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  function simulateBufferMinMax(
    buf: CircularBuffer<number | null>,
    newVal: number,
  ): { min: number; max: number } | null {
    const arr: number[] = [];
    const start = buf.length >= cyclePeriod ? 1 : 0;
    for (let i = start; i < buf.length; i++) {
      const v = buf.get(i);
      if (v === null) return null;
      arr.push(v);
    }
    arr.push(newVal);
    if (arr.length < cyclePeriod) return null;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of arr) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { min, max };
  }

  const indicator: IncrementalIndicator<number | null, StcState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;

      const fr = updateEma(price, fastEma, fastSum, fastPeriod, fastMult, count);
      fastEma = fr.ema;
      fastSum = fr.sum;
      const sr = updateEma(price, slowEma, slowSum, slowPeriod, slowMult, count);
      slowEma = sr.ema;
      slowSum = sr.sum;

      if (fastEma === null || slowEma === null) {
        return { time: candle.time, value: null };
      }

      const macdVal = fastEma - slowEma;
      macdBuffer.push(macdVal);

      // First stochastic pass
      const mm = bufferMinMax(macdBuffer);
      if (mm === null) {
        return { time: candle.time, value: null };
      }

      const range1 = mm.max - mm.min;
      const rawStoch1 = range1 > 0 ? ((macdVal - mm.min) / range1) * 100 : prevPf;
      prevPf = prevPf + factor * (rawStoch1 - prevPf);
      firstPfDone = true;
      pfBuffer.push(prevPf);

      // Second stochastic pass
      const pm = bufferMinMax(pfBuffer);
      if (pm === null) {
        return { time: candle.time, value: null };
      }

      const range2 = pm.max - pm.min;
      const rawStoch2 = range2 > 0 ? ((prevPf - pm.min) / range2) * 100 : prevStc;
      prevStc = prevStc + factor * (rawStoch2 - prevStc);
      firstStcDone = true;

      return { time: candle.time, value: prevStc };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      const fr = updateEma(price, fastEma, fastSum, fastPeriod, fastMult, peekCount);
      const sr = updateEma(price, slowEma, slowSum, slowPeriod, slowMult, peekCount);

      if (fr.ema === null || sr.ema === null) {
        return { time: candle.time, value: null };
      }

      const macdVal = fr.ema - sr.ema;

      // Simulate first stochastic
      const mm = simulateBufferMinMax(macdBuffer, macdVal);
      if (mm === null) return { time: candle.time, value: null };

      const range1 = mm.max - mm.min;
      const rawStoch1 = range1 > 0 ? ((macdVal - mm.min) / range1) * 100 : prevPf;
      const peekPf = prevPf + factor * (rawStoch1 - prevPf);

      // Simulate second stochastic
      const pm = simulateBufferMinMax(pfBuffer, peekPf);
      if (pm === null) return { time: candle.time, value: null };

      const range2 = pm.max - pm.min;
      const rawStoch2 = range2 > 0 ? ((peekPf - pm.min) / range2) * 100 : prevStc;
      const peekStc = prevStc + factor * (rawStoch2 - prevStc);

      return { time: candle.time, value: peekStc };
    },

    getState(): StcState {
      return {
        fastPeriod,
        slowPeriod,
        cyclePeriod,
        factor,
        source,
        fastEma,
        slowEma,
        fastSum,
        slowSum,
        fastMult,
        slowMult,
        macdBuffer: macdBuffer.snapshot() as StcState["macdBuffer"],
        prevPf,
        pfBuffer: pfBuffer.snapshot() as StcState["pfBuffer"],
        prevStc,
        firstPfDone,
        firstStcDone,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return firstStcDone;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
