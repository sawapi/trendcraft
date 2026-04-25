/**
 * Incremental TRIX (Triple Exponential Average)
 *
 * 1. EMA1 = EMA(close, period)
 * 2. EMA2 = EMA(EMA1, period)         — null-propagating
 * 3. EMA3 = EMA(EMA2, period)         — null-propagating
 * 4. TRIX = (EMA3 - prevEMA3) / prevEMA3 × 100
 * 5. Signal = EMA(TRIX, signalPeriod) — null-propagating
 *
 * The non-leading EMA stages skip null inputs and seed from the first
 * `period` consecutive non-null upstream samples (matches batch trix()).
 */

import type { NormalizedCandle } from "../../../types";
import { createEma } from "../moving-average/ema";
import type { EmaState } from "../moving-average/ema";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { makeCandle } from "../utils";

export type TrixValue = {
  trix: number | null;
  signal: number | null;
};

type NullEmaState = {
  period: number;
  prev: number | null;
  consec: number;
  buffer: number[];
};

function makeNullEma(period: number, fromState?: NullEmaState) {
  const multiplier = 2 / (period + 1);
  let prev: number | null = fromState?.prev ?? null;
  let consec = fromState?.consec ?? 0;
  let buffer: number[] = fromState ? [...fromState.buffer] : [];

  return {
    next(v: number | null): number | null {
      if (v === null) {
        prev = null;
        consec = 0;
        buffer = [];
        return null;
      }
      if (prev === null) {
        consec++;
        buffer.push(v);
        if (buffer.length > period) buffer.shift();
        if (consec >= period) {
          let sum = 0;
          for (const x of buffer) sum += x;
          prev = sum / period;
          return prev;
        }
        return null;
      }
      prev = v * multiplier + prev * (1 - multiplier);
      return prev;
    },
    peek(v: number | null): number | null {
      if (v === null) return null;
      if (prev === null) {
        if (consec + 1 < period) return null;
        const tail = [...buffer, v];
        if (tail.length > period) tail.shift();
        let sum = 0;
        for (const x of tail) sum += x;
        return sum / period;
      }
      return v * multiplier + prev * (1 - multiplier);
    },
    getState(): NullEmaState {
      return { period, prev, consec, buffer: [...buffer] };
    },
  };
}

export type TrixState = {
  period: number;
  signalPeriod: number;
  ema1State: EmaState;
  ema2State: NullEmaState;
  ema3State: NullEmaState;
  signalState: NullEmaState;
  prevEma3: number | null;
  count: number;
};

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
  let ema2: ReturnType<typeof makeNullEma>;
  let ema3: ReturnType<typeof makeNullEma>;
  let signalEma: ReturnType<typeof makeNullEma>;
  let prevEma3: number | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    ema1 = createEma({ period }, { fromState: s.ema1State });
    ema2 = makeNullEma(period, s.ema2State);
    ema3 = makeNullEma(period, s.ema3State);
    signalEma = makeNullEma(signalPeriod, s.signalState);
    prevEma3 = s.prevEma3;
    count = s.count;
  } else {
    ema1 = createEma({ period });
    ema2 = makeNullEma(period);
    ema3 = makeNullEma(period);
    signalEma = makeNullEma(signalPeriod);
    prevEma3 = null;
    count = 0;
  }

  const indicator: IncrementalIndicator<TrixValue, TrixState> = {
    next(candle: NormalizedCandle) {
      count++;

      const e1Val = ema1.next(candle).value;
      const e2Val = ema2.next(e1Val);
      const e3Val = ema3.next(e2Val);

      let trixVal: number | null = null;
      if (e3Val !== null && prevEma3 !== null) {
        trixVal = prevEma3 === 0 ? 0 : ((e3Val - prevEma3) / prevEma3) * 100;
      }

      const signalVal = signalEma.next(trixVal);

      if (e3Val !== null) {
        prevEma3 = e3Val;
      }

      return { time: candle.time, value: { trix: trixVal, signal: signalVal } };
    },

    peek(candle: NormalizedCandle) {
      const e1Val = ema1.peek(candle).value;
      const e2Val = ema2.peek(e1Val);
      const e3Val = ema3.peek(e2Val);

      let trixVal: number | null = null;
      if (e3Val !== null && prevEma3 !== null) {
        trixVal = prevEma3 === 0 ? 0 : ((e3Val - prevEma3) / prevEma3) * 100;
      }

      const signalVal = signalEma.peek(trixVal);
      return { time: candle.time, value: { trix: trixVal, signal: signalVal } };
    },

    getState(): TrixState {
      return {
        period,
        signalPeriod,
        ema1State: ema1.getState(),
        ema2State: ema2.getState(),
        ema3State: ema3.getState(),
        signalState: signalEma.getState(),
        prevEma3,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return prevEma3 !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
