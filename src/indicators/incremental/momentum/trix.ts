/**
 * Incremental TRIX (Triple Exponential Average)
 *
 * 1. EMA1 = EMA(close, period)
 * 2. EMA2 = EMA(EMA1, period)
 * 3. EMA3 = EMA(EMA2, period)
 * 4. TRIX = (EMA3 - prevEMA3) / prevEMA3 × 100
 * 5. Signal = EMA(TRIX, signalPeriod)
 */

import type { NormalizedCandle } from "../../../types";
import { createEma } from "../moving-average/ema";
import type { EmaState } from "../moving-average/ema";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type TrixValue = {
  trix: number | null;
  signal: number | null;
};

export type TrixState = {
  period: number;
  signalPeriod: number;
  ema1State: EmaState;
  ema2State: EmaState;
  ema3State: EmaState;
  signalEmaState: EmaState;
  prevEma3: number | null;
  trixCount: number;
  trixSum: number;
  count: number;
};

function makeCandle(time: number, value: number): NormalizedCandle {
  return { time, open: value, high: value, low: value, close: value, volume: 0 };
}

/**
 * Create an incremental TRIX indicator
 *
 * @example
 * ```ts
 * const trix = createTrix({ period: 15, signalPeriod: 9 });
 * for (const candle of stream) {
 *   const { value } = trix.next(candle);
 *   if (value.trix !== null) console.log(value.trix, value.signal);
 * }
 * ```
 */
export function createTrix(
  options: { period?: number; signalPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<TrixState>,
): IncrementalIndicator<TrixValue, TrixState> {
  const period = options.period ?? 15;
  const signalPeriod = options.signalPeriod ?? 9;

  let ema1: ReturnType<typeof createEma>;
  let ema2: ReturnType<typeof createEma>;
  let ema3: ReturnType<typeof createEma>;
  let signalEma: ReturnType<typeof createEma>;
  let prevEma3: number | null;
  let trixCount: number;
  let trixSum: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    ema1 = createEma({ period }, { fromState: s.ema1State });
    ema2 = createEma({ period }, { fromState: s.ema2State });
    ema3 = createEma({ period }, { fromState: s.ema3State });
    signalEma = createEma({ period: signalPeriod }, { fromState: s.signalEmaState });
    prevEma3 = s.prevEma3;
    trixCount = s.trixCount;
    trixSum = s.trixSum;
    count = s.count;
  } else {
    ema1 = createEma({ period });
    ema2 = createEma({ period });
    ema3 = createEma({ period });
    signalEma = createEma({ period: signalPeriod });
    prevEma3 = null;
    trixCount = 0;
    trixSum = 0;
    count = 0;
  }

  const indicator: IncrementalIndicator<TrixValue, TrixState> = {
    next(candle: NormalizedCandle) {
      count++;

      // Pass through triple EMA
      const e1 = ema1.next(candle);
      const e1Val = e1.value;
      const e2 = e1Val !== null ? ema2.next(makeCandle(candle.time, e1Val)) : { value: null };
      const e2Val = e2.value as number | null;
      const e3 = e2Val !== null ? ema3.next(makeCandle(candle.time, e2Val)) : { value: null };
      const e3Val = e3.value as number | null;

      // TRIX = ROC of EMA3
      let trixVal: number | null = null;
      if (e3Val !== null && prevEma3 !== null) {
        if (prevEma3 === 0) {
          trixVal = 0;
        } else {
          trixVal = ((e3Val - prevEma3) / prevEma3) * 100;
        }
      }

      // Signal line = EMA of TRIX values
      let signalVal: number | null = null;
      if (trixVal !== null) {
        trixCount++;
        if (trixCount < signalPeriod) {
          trixSum += trixVal;
        } else if (trixCount === signalPeriod) {
          trixSum += trixVal;
          const seed = trixSum / signalPeriod;
          // Feed the signal EMA — we need to feed all prior trix values
          // Actually, we'll use the signalEma which processes from position 0
          const sigResult = signalEma.next(makeCandle(candle.time, trixVal));
          signalVal = sigResult.value;
        } else {
          const sigResult = signalEma.next(makeCandle(candle.time, trixVal));
          signalVal = sigResult.value;
        }
      }

      if (e3Val !== null) {
        prevEma3 = e3Val;
      }

      return { time: candle.time, value: { trix: trixVal, signal: signalVal } };
    },

    peek(candle: NormalizedCandle) {
      const e1Val = ema1.peek(candle).value;
      if (e1Val === null) return { time: candle.time, value: { trix: null, signal: null } };

      const e2Val = ema2.peek(makeCandle(candle.time, e1Val)).value;
      if (e2Val === null) return { time: candle.time, value: { trix: null, signal: null } };

      const e3Val = ema3.peek(makeCandle(candle.time, e2Val)).value;
      if (e3Val === null) return { time: candle.time, value: { trix: null, signal: null } };

      let trixVal: number | null = null;
      if (prevEma3 !== null) {
        trixVal = prevEma3 === 0 ? 0 : ((e3Val - prevEma3) / prevEma3) * 100;
      }

      let signalVal: number | null = null;
      if (trixVal !== null && trixCount >= signalPeriod - 1) {
        signalVal = signalEma.peek(makeCandle(candle.time, trixVal)).value;
      }

      return { time: candle.time, value: { trix: trixVal, signal: signalVal } };
    },

    getState(): TrixState {
      return {
        period,
        signalPeriod,
        ema1State: ema1.getState(),
        ema2State: ema2.getState(),
        ema3State: ema3.getState(),
        signalEmaState: signalEma.getState(),
        prevEma3,
        trixCount,
        trixSum,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      // First valid TRIX requires 3*(period-1)+1 candles, then +1 for ROC
      return prevEma3 !== null && ema3.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
