/**
 * Incremental Pivot Points
 *
 * Computes classic pivot point levels from the previous candle's OHLC.
 * Supports Standard, Fibonacci, Woodie, Camarilla, and DeMark methods.
 */

import type { NormalizedCandle } from "../../../types";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type PivotMethod = "standard" | "fibonacci" | "woodie" | "camarilla" | "demark";

export type PivotPointsValue = {
  pivot: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  s1: number | null;
  s2: number | null;
  s3: number | null;
};

export type PivotPointsState = {
  prevCandle: { high: number; low: number; close: number } | null;
  method: PivotMethod;
  count: number;
};

const nullValue: PivotPointsValue = {
  pivot: null,
  r1: null,
  r2: null,
  r3: null,
  s1: null,
  s2: null,
  s3: null,
};

function computePivot(
  method: PivotMethod,
  prevHigh: number,
  prevLow: number,
  prevClose: number,
  currentOpen: number,
): PivotPointsValue {
  const range = prevHigh - prevLow;

  switch (method) {
    case "standard": {
      const pp = (prevHigh + prevLow + prevClose) / 3;
      return {
        pivot: pp,
        r1: 2 * pp - prevLow,
        r2: pp + range,
        r3: prevHigh + 2 * (pp - prevLow),
        s1: 2 * pp - prevHigh,
        s2: pp - range,
        s3: prevLow - 2 * (prevHigh - pp),
      };
    }
    case "fibonacci": {
      const pp = (prevHigh + prevLow + prevClose) / 3;
      return {
        pivot: pp,
        r1: pp + 0.382 * range,
        r2: pp + 0.618 * range,
        r3: pp + range,
        s1: pp - 0.382 * range,
        s2: pp - 0.618 * range,
        s3: pp - range,
      };
    }
    case "woodie": {
      // Woodie uses current open
      const pp = (prevHigh + prevLow + 2 * currentOpen) / 4;
      return {
        pivot: pp,
        r1: 2 * pp - prevLow,
        r2: pp + range,
        r3: prevHigh + 2 * (pp - prevLow),
        s1: 2 * pp - prevHigh,
        s2: pp - range,
        s3: prevLow - 2 * (prevHigh - pp),
      };
    }
    case "camarilla": {
      const pp = (prevHigh + prevLow + prevClose) / 3;
      return {
        pivot: pp,
        r1: prevClose + (range * 1.1) / 12,
        r2: prevClose + (range * 1.1) / 6,
        r3: prevClose + (range * 1.1) / 4,
        s1: prevClose - (range * 1.1) / 12,
        s2: prevClose - (range * 1.1) / 6,
        s3: prevClose - (range * 1.1) / 4,
      };
    }
    case "demark": {
      let x: number;
      if (prevClose < currentOpen) {
        x = prevHigh + 2 * prevLow + prevClose;
      } else if (prevClose > currentOpen) {
        x = 2 * prevHigh + prevLow + prevClose;
      } else {
        x = prevHigh + prevLow + 2 * prevClose;
      }
      const pp = x / 4;
      return {
        pivot: pp,
        r1: x / 2 - prevLow,
        r2: null,
        r3: null,
        s1: x / 2 - prevHigh,
        s2: null,
        s3: null,
      };
    }
    default:
      return nullValue;
  }
}

/**
 * Create an incremental Pivot Points indicator
 *
 * Calculates pivot, support, and resistance levels from previous bar's OHLC.
 *
 * @example
 * ```ts
 * const pivots = createPivotPoints({ method: 'fibonacci' });
 * for (const candle of stream) {
 *   const { value } = pivots.next(candle);
 *   if (value.pivot !== null) {
 *     console.log(`PP: ${value.pivot}, R1: ${value.r1}, S1: ${value.s1}`);
 *   }
 * }
 * ```
 */
export function createPivotPoints(
  options: { method?: PivotMethod } = {},
  warmUpOptions?: WarmUpOptions<PivotPointsState>,
): IncrementalIndicator<PivotPointsValue, PivotPointsState> {
  const method: PivotMethod = options.method ?? "standard";

  let prevCandle: { high: number; low: number; close: number } | null;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    prevCandle = s.prevCandle ? { ...s.prevCandle } : null;
    count = s.count;
  } else {
    prevCandle = null;
    count = 0;
  }

  const indicator: IncrementalIndicator<PivotPointsValue, PivotPointsState> = {
    next(candle: NormalizedCandle) {
      count++;

      let value: PivotPointsValue;
      if (prevCandle === null) {
        value = nullValue;
      } else {
        value = computePivot(
          method,
          prevCandle.high,
          prevCandle.low,
          prevCandle.close,
          candle.open,
        );
      }

      prevCandle = { high: candle.high, low: candle.low, close: candle.close };
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      if (prevCandle === null) {
        return { time: candle.time, value: nullValue };
      }
      const value = computePivot(
        method,
        prevCandle.high,
        prevCandle.low,
        prevCandle.close,
        candle.open,
      );
      return { time: candle.time, value };
    },

    getState(): PivotPointsState {
      return {
        prevCandle: prevCandle ? { ...prevCandle } : null,
        method,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= 2;
    },
  };

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
