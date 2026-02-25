/**
 * Incremental Parabolic SAR (Stop and Reverse)
 *
 * Tracks trend direction with dynamic acceleration-based stop levels.
 * TA-Lib compatible initialization using MINUS_DM for initial direction.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type ParabolicSarValue = {
  sar: number | null;
  direction: 1 | -1 | 0;
  isReversal: boolean;
  af: number | null;
  ep: number | null;
};

export type ParabolicSarState = {
  step: number;
  max: number;
  count: number;
  initialized: boolean;
  isLong: boolean;
  sar: number;
  ep: number;
  af: number;
  prevLow: number;
  prevHigh: number;
  firstHigh: number;
  firstLow: number;
};

/**
 * Create an incremental Parabolic SAR indicator
 *
 * @example
 * ```ts
 * const psar = createParabolicSar({ step: 0.02, max: 0.2 });
 * for (const candle of stream) {
 *   const { value } = psar.next(candle);
 *   if (psar.isWarmedUp) console.log(value.sar, value.direction);
 * }
 * ```
 */
export function createParabolicSar(
  options: { step?: number; max?: number } = {},
  warmUpOptions?: WarmUpOptions<ParabolicSarState>,
): IncrementalIndicator<ParabolicSarValue, ParabolicSarState> {
  const step = options.step ?? 0.02;
  const max = options.max ?? 0.2;

  let count: number;
  let initialized: boolean;
  let isLong: boolean;
  let sar: number;
  let ep: number;
  let af: number;
  let prevLow: number;
  let prevHigh: number;
  let firstHigh: number;
  let firstLow: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    count = s.count;
    initialized = s.initialized;
    isLong = s.isLong;
    sar = s.sar;
    ep = s.ep;
    af = s.af;
    prevLow = s.prevLow;
    prevHigh = s.prevHigh;
    firstHigh = s.firstHigh;
    firstLow = s.firstLow;
  } else {
    count = 0;
    initialized = false;
    isLong = true;
    sar = 0;
    ep = 0;
    af = step;
    prevLow = 0;
    prevHigh = 0;
    firstHigh = 0;
    firstLow = 0;
  }

  const nullValue: ParabolicSarValue = {
    sar: null,
    direction: 0,
    isReversal: false,
    af: null,
    ep: null,
  };

  function computeSar(
    newHigh: number,
    newLow: number,
    curSar: number,
    curEp: number,
    curAf: number,
    curIsLong: boolean,
    curPrevHigh: number,
    curPrevLow: number,
  ): {
    outputSar: number;
    isReversal: boolean;
    nextSar: number;
    nextEp: number;
    nextAf: number;
    nextIsLong: boolean;
  } {
    let outputSar: number;
    let isReversal = false;
    let nextSar: number;
    let nextEp = curEp;
    let nextAf = curAf;
    let nextIsLong = curIsLong;

    if (curIsLong) {
      if (newLow <= curSar) {
        // Reversal: long → short
        nextIsLong = false;
        isReversal = true;

        nextSar = curEp;
        if (nextSar < curPrevHigh) nextSar = curPrevHigh;
        if (nextSar < newHigh) nextSar = newHigh;
        outputSar = nextSar;

        nextAf = step;
        nextEp = newLow;
        nextSar = nextSar + nextAf * (nextEp - nextSar);
        if (nextSar < curPrevHigh) nextSar = curPrevHigh;
        if (nextSar < newHigh) nextSar = newHigh;
      } else {
        outputSar = curSar;

        if (newHigh > curEp) {
          nextEp = newHigh;
          nextAf = curAf + step;
          if (nextAf > max) nextAf = max;
        }

        nextSar = curSar + nextAf * (nextEp - curSar);
        if (nextSar > curPrevLow) nextSar = curPrevLow;
        if (nextSar > newLow) nextSar = newLow;
      }
    } else {
      if (newHigh >= curSar) {
        // Reversal: short → long
        nextIsLong = true;
        isReversal = true;

        nextSar = curEp;
        if (nextSar > curPrevLow) nextSar = curPrevLow;
        if (nextSar > newLow) nextSar = newLow;
        outputSar = nextSar;

        nextAf = step;
        nextEp = newHigh;
        nextSar = nextSar + nextAf * (nextEp - nextSar);
        if (nextSar > curPrevLow) nextSar = curPrevLow;
        if (nextSar > newLow) nextSar = newLow;
      } else {
        outputSar = curSar;

        if (newLow < curEp) {
          nextEp = newLow;
          nextAf = curAf + step;
          if (nextAf > max) nextAf = max;
        }

        nextSar = curSar + nextAf * (nextEp - curSar);
        if (nextSar < curPrevHigh) nextSar = curPrevHigh;
        if (nextSar < newHigh) nextSar = newHigh;
      }
    }

    return { outputSar, isReversal, nextSar, nextEp, nextAf, nextIsLong };
  }

  const indicator: IncrementalIndicator<ParabolicSarValue, ParabolicSarState> = {
    next(candle: NormalizedCandle) {
      count++;

      if (count === 1) {
        // First candle: store for initialization, return null
        firstHigh = candle.high;
        firstLow = candle.low;
        return { time: candle.time, value: nullValue };
      }

      if (!initialized) {
        // Second candle: initialize direction and state
        const diffP = candle.high - firstHigh;
        const diffM = firstLow - candle.low;
        const minusDm = diffM > 0 && diffM > diffP ? diffM : 0;
        isLong = minusDm > 0 ? false : true;

        if (isLong) {
          sar = firstLow;
          ep = candle.high;
        } else {
          sar = firstHigh;
          ep = candle.low;
        }
        af = step;

        // prevLow/prevHigh for first iteration = current candle (TA-Lib compat)
        prevLow = candle.low;
        prevHigh = candle.high;
        initialized = true;
      }

      const result = computeSar(
        candle.high, candle.low,
        sar, ep, af, isLong,
        prevHigh, prevLow,
      );

      // Update state for next iteration
      sar = result.nextSar;
      ep = result.nextEp;
      af = result.nextAf;
      isLong = result.nextIsLong;
      prevLow = candle.low;
      prevHigh = candle.high;

      return {
        time: candle.time,
        value: {
          sar: result.outputSar,
          direction: isLong ? 1 : -1,
          isReversal: result.isReversal,
          af,
          ep,
        },
      };
    },

    peek(candle: NormalizedCandle) {
      if (count === 0) {
        return { time: candle.time, value: nullValue };
      }

      if (!initialized) {
        // Would be the second candle
        const diffP = candle.high - firstHigh;
        const diffM = firstLow - candle.low;
        const minusDm = diffM > 0 && diffM > diffP ? diffM : 0;
        const peekIsLong = minusDm > 0 ? false : true;

        let peekSar: number;
        let peekEp: number;
        if (peekIsLong) {
          peekSar = firstLow;
          peekEp = candle.high;
        } else {
          peekSar = firstHigh;
          peekEp = candle.low;
        }

        const result = computeSar(
          candle.high, candle.low,
          peekSar, peekEp, step, peekIsLong,
          candle.high, candle.low,
        );

        return {
          time: candle.time,
          value: {
            sar: result.outputSar,
            direction: result.nextIsLong ? 1 : -1,
            isReversal: result.isReversal,
            af: result.nextAf,
            ep: result.nextEp,
          },
        };
      }

      const result = computeSar(
        candle.high, candle.low,
        sar, ep, af, isLong,
        prevHigh, prevLow,
      );

      return {
        time: candle.time,
        value: {
          sar: result.outputSar,
          direction: result.nextIsLong ? 1 : -1,
          isReversal: result.isReversal,
          af: result.nextAf,
          ep: result.nextEp,
        },
      };
    },

    getState(): ParabolicSarState {
      return {
        step, max, count, initialized, isLong,
        sar, ep, af, prevLow, prevHigh,
        firstHigh, firstLow,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return initialized;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
