/**
 * Incremental Klinger Volume Oscillator (KVO)
 *
 * Computes Volume Force → short/long EMA → KVO = short - long → signal = EMA(KVO).
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type KlingerValue = {
  kvo: number | null;
  signal: number | null;
  histogram: number | null;
};

export type KlingerState = {
  shortPeriod: number;
  longPeriod: number;
  signalPeriod: number;
  prevHlc: number | null;
  prevTrend: number;
  cm: number;
  shortEma: EmaInternalState;
  longEma: EmaInternalState;
  signalEma: EmaInternalState;
  count: number;
};

type EmaInternalState = {
  period: number;
  multiplier: number;
  sum: number;
  validCount: number;
  prevEma: number | null;
};

/**
 * Lightweight internal EMA that accepts nullable input.
 * Null inputs are skipped (returned as null) without advancing the EMA state.
 */
function createInternalEma(
  period: number,
  state?: EmaInternalState,
): {
  next(value: number | null): number | null;
  peek(value: number | null): number | null;
  getState(): EmaInternalState;
} {
  const multiplier = state?.multiplier ?? 2 / (period + 1);
  let sum = state?.sum ?? 0;
  let validCount = state?.validCount ?? 0;
  let prevEma = state?.prevEma ?? null;

  return {
    next(value: number | null): number | null {
      if (value === null) return null;
      validCount++;
      if (validCount < period) {
        sum += value;
        return null;
      }
      if (validCount === period) {
        sum += value;
        prevEma = sum / period;
        return prevEma;
      }
      if (prevEma === null) return null;
      prevEma = value * multiplier + prevEma * (1 - multiplier);
      return prevEma;
    },

    peek(value: number | null): number | null {
      if (value === null) return null;
      const peekCount = validCount + 1;
      if (peekCount < period) return null;
      if (peekCount === period) return (sum + value) / period;
      if (prevEma === null) return null;
      return value * multiplier + prevEma * (1 - multiplier);
    },

    getState(): EmaInternalState {
      return { period, multiplier, sum, validCount, prevEma };
    },
  };
}

/**
 * Create an incremental Klinger Volume Oscillator
 *
 * @example
 * ```ts
 * const kvo = createKlinger({ shortPeriod: 34, longPeriod: 55, signalPeriod: 13 });
 * for (const candle of stream) {
 *   const { value } = kvo.next(candle);
 *   if (value.kvo !== null) console.log(value.kvo, value.signal);
 * }
 * ```
 */
export function createKlinger(
  options: { shortPeriod?: number; longPeriod?: number; signalPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<KlingerState>,
): IncrementalIndicator<KlingerValue, KlingerState> {
  const shortPeriod = options.shortPeriod ?? 34;
  const longPeriod = options.longPeriod ?? 55;
  const signalPeriod = options.signalPeriod ?? 13;

  let prevHlc: number | null;
  let prevTrend: number;
  let cm: number;
  let shortEma: ReturnType<typeof createInternalEma>;
  let longEma: ReturnType<typeof createInternalEma>;
  let signalEma: ReturnType<typeof createInternalEma>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevHlc = s.prevHlc;
    prevTrend = s.prevTrend;
    cm = s.cm;
    shortEma = createInternalEma(shortPeriod, s.shortEma);
    longEma = createInternalEma(longPeriod, s.longEma);
    signalEma = createInternalEma(signalPeriod, s.signalEma);
    count = s.count;
  } else {
    prevHlc = null;
    prevTrend = 1;
    cm = 0;
    shortEma = createInternalEma(shortPeriod);
    longEma = createInternalEma(longPeriod);
    signalEma = createInternalEma(signalPeriod);
    count = 0;
  }

  const nullValue: KlingerValue = { kvo: null, signal: null, histogram: null };

  function computeVf(candle: NormalizedCandle): {
    vf: number;
    newHlc: number;
    newTrend: number;
    newCm: number;
  } {
    const hlc = candle.high + candle.low + candle.close;
    const dm = candle.high - candle.low;

    if (prevHlc === null) {
      return { vf: 0, newHlc: hlc, newTrend: 1, newCm: dm };
    }

    const trend = hlc > prevHlc ? 1 : -1;
    const newCm = trend === prevTrend ? cm + dm : dm;
    const cmRatio = newCm === 0 ? 0 : Math.abs(2 * (dm / newCm) - 1);
    const vf = candle.volume * cmRatio * trend * 100;

    return { vf, newHlc: hlc, newTrend: trend, newCm };
  }

  const indicator: IncrementalIndicator<KlingerValue, KlingerState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (prevHlc === null) {
        prevHlc = candle.high + candle.low + candle.close;
        cm = candle.high - candle.low;
        prevTrend = 1;

        // Feed VF=0 to EMAs for the first bar
        shortEma.next(0);
        longEma.next(0);
        signalEma.next(null);

        return { time: candle.time, value: nullValue };
      }

      const { vf, newHlc, newTrend, newCm } = computeVf(candle);
      prevHlc = newHlc;
      prevTrend = newTrend;
      cm = newCm;

      const shortVal = shortEma.next(vf);
      const longVal = longEma.next(vf);

      let kvo: number | null = null;
      if (shortVal !== null && longVal !== null) {
        kvo = shortVal - longVal;
      }

      const signal = signalEma.next(kvo);
      const histogram = kvo !== null && signal !== null ? kvo - signal : null;

      return { time: candle.time, value: { kvo, signal, histogram } };
    },

    peek(candle: NormalizedCandle) {
      if (prevHlc === null) {
        return { time: candle.time, value: nullValue };
      }

      const { vf } = computeVf(candle);

      const shortVal = shortEma.peek(vf);
      const longVal = longEma.peek(vf);

      let kvo: number | null = null;
      if (shortVal !== null && longVal !== null) {
        kvo = shortVal - longVal;
      }

      const signal = signalEma.peek(kvo);
      const histogram = kvo !== null && signal !== null ? kvo - signal : null;

      return { time: candle.time, value: { kvo, signal, histogram } };
    },

    getState(): KlingerState {
      return {
        shortPeriod,
        longPeriod,
        signalPeriod,
        prevHlc,
        prevTrend,
        cm,
        shortEma: shortEma.getState(),
        longEma: longEma.getState(),
        signalEma: signalEma.getState(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return signalEma.getState().prevEma !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
