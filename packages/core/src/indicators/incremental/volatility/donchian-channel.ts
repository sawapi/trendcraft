/**
 * Incremental Donchian Channel
 *
 * Shows highest high and lowest low over N periods.
 * Uses CircularBuffer with linear scan for min/max.
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

/**
 * Donchian Channel output value
 */
export type DonchianValue = {
  upper: number | null;
  middle: number | null;
  lower: number | null;
};

/**
 * State for incremental Donchian Channel
 */
export type DonchianState = {
  period: number;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Donchian Channel indicator
 *
 * @example
 * ```ts
 * const dc = createDonchianChannel({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = dc.next(candle);
 *   if (dc.isWarmedUp) console.log(value.upper, value.middle, value.lower);
 * }
 * ```
 */
export function createDonchianChannel(
  options: { period: number },
  warmUpOptions?: WarmUpOptions<DonchianState>,
): IncrementalIndicator<DonchianValue, DonchianState> {
  const period = options.period;

  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    count = s.count;
  } else {
    highBuffer = new CircularBuffer<number>(period);
    lowBuffer = new CircularBuffer<number>(period);
    count = 0;
  }

  function compute(
    hBuf: CircularBuffer<number>,
    lBuf: CircularBuffer<number>,
    n: number,
  ): DonchianValue {
    if (n < period) {
      return { upper: null, middle: null, lower: null };
    }

    let highest = hBuf.get(0);
    let lowest = lBuf.get(0);
    for (let i = 1; i < hBuf.length; i++) {
      const h = hBuf.get(i);
      if (h > highest) highest = h;
    }
    for (let i = 1; i < lBuf.length; i++) {
      const l = lBuf.get(i);
      if (l < lowest) lowest = l;
    }

    return {
      upper: highest,
      middle: (highest + lowest) / 2,
      lower: lowest,
    };
  }

  const indicator: IncrementalIndicator<DonchianValue, DonchianState> = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      return { time: candle.time, value: compute(highBuffer, lowBuffer, count) };
    },

    peek(candle: NormalizedCandle) {
      const tempHigh = CircularBuffer.fromSnapshot(highBuffer.snapshot());
      const tempLow = CircularBuffer.fromSnapshot(lowBuffer.snapshot());
      tempHigh.push(candle.high);
      tempLow.push(candle.low);

      return { time: candle.time, value: compute(tempHigh, tempLow, count + 1) };
    },

    getState(): DonchianState {
      return {
        period,
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= period;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
