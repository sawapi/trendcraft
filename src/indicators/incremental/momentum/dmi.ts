/**
 * Incremental DMI (Directional Movement Index) and ADX
 *
 * Uses Wilder's smoothing for TR, +DM, -DM and ADX computation.
 * TA-Lib compatible: TR[0]=0, first smoothed output at index=period.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type DmiValue = {
  plusDi: number | null;
  minusDi: number | null;
  adx: number | null;
};

export type DmiState = {
  period: number;
  adxPeriod: number;
  count: number;
  prevClose: number | null;
  prevHigh: number | null;
  prevLow: number | null;
  initSumTr: number;
  initSumPlusDm: number;
  initSumMinusDm: number;
  smoothedTr: number | null;
  smoothedPlusDm: number | null;
  smoothedMinusDm: number | null;
  dxInitSum: number;
  dxValidCount: number;
  adx: number | null;
};

/**
 * Create an incremental DMI/ADX indicator
 *
 * @example
 * ```ts
 * const dmiInd = createDmi({ period: 14, adxPeriod: 14 });
 * for (const candle of stream) {
 *   const { value } = dmiInd.next(candle);
 *   if (dmiInd.isWarmedUp) console.log(value.plusDi, value.minusDi, value.adx);
 * }
 * ```
 */
export function createDmi(
  options: { period?: number; adxPeriod?: number } = {},
  warmUpOptions?: WarmUpOptions<DmiState>,
): IncrementalIndicator<DmiValue, DmiState> {
  const period = options.period ?? 14;
  const adxPeriod = options.adxPeriod ?? 14;

  let count: number;
  let prevClose: number | null;
  let prevHigh: number | null;
  let prevLow: number | null;
  let initSumTr: number;
  let initSumPlusDm: number;
  let initSumMinusDm: number;
  let smoothedTr: number | null;
  let smoothedPlusDm: number | null;
  let smoothedMinusDm: number | null;
  let dxInitSum: number;
  let dxValidCount: number;
  let adxVal: number | null;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    count = s.count;
    prevClose = s.prevClose;
    prevHigh = s.prevHigh;
    prevLow = s.prevLow;
    initSumTr = s.initSumTr;
    initSumPlusDm = s.initSumPlusDm;
    initSumMinusDm = s.initSumMinusDm;
    smoothedTr = s.smoothedTr;
    smoothedPlusDm = s.smoothedPlusDm;
    smoothedMinusDm = s.smoothedMinusDm;
    dxInitSum = s.dxInitSum;
    dxValidCount = s.dxValidCount;
    adxVal = s.adx;
  } else {
    count = 0;
    prevClose = null;
    prevHigh = null;
    prevLow = null;
    initSumTr = 0;
    initSumPlusDm = 0;
    initSumMinusDm = 0;
    smoothedTr = null;
    smoothedPlusDm = null;
    smoothedMinusDm = null;
    dxInitSum = 0;
    dxValidCount = 0;
    adxVal = null;
  }

  const nullValue: DmiValue = { plusDi: null, minusDi: null, adx: null };

  function computeRaw(candle: NormalizedCandle): { tr: number; pDm: number; mDm: number } {
    if (prevClose === null || prevHigh === null || prevLow === null) {
      // First candle: no previous data
      return { tr: 0, pDm: 0, mDm: 0 };
    }

    const highLow = candle.high - candle.low;
    const highPrevClose = Math.abs(candle.high - prevClose);
    const lowPrevClose = Math.abs(candle.low - prevClose);
    const tr = Math.max(highLow, highPrevClose, lowPrevClose);

    const upMove = candle.high - prevHigh;
    const downMove = prevLow - candle.low;

    let pDm = 0;
    let mDm = 0;
    if (upMove > downMove && upMove > 0) {
      pDm = upMove;
    }
    if (downMove > upMove && downMove > 0) {
      mDm = downMove;
    }

    return { tr, pDm, mDm };
  }

  function processCandle(candle: NormalizedCandle): DmiValue {
    // count is 1-based (already incremented before this call)
    // count=1 → batch index 0, count=N → batch index N-1

    const raw = computeRaw(candle);

    // Wilder smoothing phases (batch indices: 0..period-1 accumulate, period = first output)
    // count 1..period → accumulate initSum
    // count period+1 → first smoothed value
    // count > period+1 → Wilder's continuation

    if (count <= period) {
      // Accumulation phase
      initSumTr += raw.tr;
      initSumPlusDm += raw.pDm;
      initSumMinusDm += raw.mDm;

      prevClose = candle.close;
      prevHigh = candle.high;
      prevLow = candle.low;
      return nullValue;
    }

    if (count === period + 1) {
      // First smoothed value: initSum - initSum/period + current
      smoothedTr = initSumTr - initSumTr / period + raw.tr;
      smoothedPlusDm = initSumPlusDm - initSumPlusDm / period + raw.pDm;
      smoothedMinusDm = initSumMinusDm - initSumMinusDm / period + raw.mDm;
    } else {
      // Wilder's smoothing: prev - prev/period + current
      const prevTr = smoothedTr ?? 0;
      const prevPDm = smoothedPlusDm ?? 0;
      const prevMDm = smoothedMinusDm ?? 0;
      smoothedTr = prevTr - prevTr / period + raw.tr;
      smoothedPlusDm = prevPDm - prevPDm / period + raw.pDm;
      smoothedMinusDm = prevMDm - prevMDm / period + raw.mDm;
    }

    // Compute +DI, -DI
    if (smoothedTr === 0) {
      prevClose = candle.close;
      prevHigh = candle.high;
      prevLow = candle.low;
      return nullValue;
    }

    const plusDi = (100 * smoothedPlusDm) / smoothedTr;
    const minusDi = (100 * smoothedMinusDm) / smoothedTr;

    // Compute DX
    const diSum = plusDi + minusDi;
    const dx = diSum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / diSum;

    // ADX smoothing (wilderSmoothNullable)
    dxValidCount++;
    let currentAdx: number | null = null;

    if (dxValidCount < adxPeriod) {
      // Accumulate DX for initial ADX average
      dxInitSum += dx;
    } else if (dxValidCount === adxPeriod) {
      // First ADX = average of first adxPeriod DX values
      dxInitSum += dx;
      adxVal = dxInitSum / adxPeriod;
      currentAdx = adxVal;
    } else {
      // Wilder's smoothing for ADX: (prev * (period-1) + curr) / period
      adxVal = ((adxVal ?? 0) * (adxPeriod - 1) + dx) / adxPeriod;
      currentAdx = adxVal;
    }

    prevClose = candle.close;
    prevHigh = candle.high;
    prevLow = candle.low;

    return { plusDi, minusDi, adx: currentAdx };
  }

  const indicator: IncrementalIndicator<DmiValue, DmiState> = {
    next(candle: NormalizedCandle) {
      count++;
      const value = processCandle(candle);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      // Compute without modifying state
      const peekCount = count + 1;

      const raw = computeRaw(candle);

      if (peekCount <= period) {
        return { time: candle.time, value: nullValue };
      }

      let peekSmoothedTr: number;
      let peekSmoothedPlusDm: number;
      let peekSmoothedMinusDm: number;

      if (peekCount === period + 1) {
        const peekInitSumTr = initSumTr + raw.tr; // no, initSum was accumulated for count 1..period
        // Actually at this point initSumTr already has all values from count 1..period
        peekSmoothedTr = initSumTr - initSumTr / period + raw.tr;
        peekSmoothedPlusDm = initSumPlusDm - initSumPlusDm / period + raw.pDm;
        peekSmoothedMinusDm = initSumMinusDm - initSumMinusDm / period + raw.mDm;
      } else {
        const prevTr = smoothedTr ?? 0;
        const prevPDm = smoothedPlusDm ?? 0;
        const prevMDm = smoothedMinusDm ?? 0;
        peekSmoothedTr = prevTr - prevTr / period + raw.tr;
        peekSmoothedPlusDm = prevPDm - prevPDm / period + raw.pDm;
        peekSmoothedMinusDm = prevMDm - prevMDm / period + raw.mDm;
      }

      if (peekSmoothedTr === 0) {
        return { time: candle.time, value: nullValue };
      }

      const plusDi = (100 * peekSmoothedPlusDm) / peekSmoothedTr;
      const minusDi = (100 * peekSmoothedMinusDm) / peekSmoothedTr;
      const diSum = plusDi + minusDi;
      const dx = diSum === 0 ? 0 : (100 * Math.abs(plusDi - minusDi)) / diSum;

      const peekDxValidCount = dxValidCount + 1;
      let currentAdx: number | null = null;

      if (peekDxValidCount < adxPeriod) {
        // Still accumulating
      } else if (peekDxValidCount === adxPeriod) {
        currentAdx = (dxInitSum + dx) / adxPeriod;
      } else {
        currentAdx = ((adxVal ?? 0) * (adxPeriod - 1) + dx) / adxPeriod;
      }

      return { time: candle.time, value: { plusDi, minusDi, adx: currentAdx } };
    },

    getState(): DmiState {
      return {
        period,
        adxPeriod,
        count,
        prevClose,
        prevHigh,
        prevLow,
        initSumTr,
        initSumPlusDm,
        initSumMinusDm,
        smoothedTr,
        smoothedPlusDm,
        smoothedMinusDm,
        dxInitSum,
        dxValidCount,
        adx: adxVal,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return adxVal !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
