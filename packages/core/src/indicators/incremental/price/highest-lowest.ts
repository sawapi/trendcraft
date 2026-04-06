/**
 * Incremental Highest/Lowest
 *
 * Rolling maximum of highs and minimum of lows over a configurable period.
 * Uses CircularBuffer with O(n) scan per update (period is typically small).
 */

import type { NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";

export type HighestLowestValue = {
  highest: number | null;
  lowest: number | null;
};

export type HighestLowestState = {
  period: number;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/**
 * Create an incremental Highest/Lowest indicator
 *
 * Tracks the rolling maximum high and minimum low over a sliding window.
 *
 * @example
 * ```ts
 * const hl = createHighestLowest({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = hl.next(candle);
 *   if (hl.isWarmedUp) {
 *     console.log(`High: ${value.highest}, Low: ${value.lowest}`);
 *   }
 * }
 * ```
 */
export function createHighestLowest(
  options: { period?: number } = {},
  warmUpOptions?: WarmUpOptions<HighestLowestState>,
): IncrementalIndicator<HighestLowestValue, HighestLowestState> {
  const period = options.period ?? 20;

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

  function scanMaxMin(
    hBuf: CircularBuffer<number>,
    lBuf: CircularBuffer<number>,
  ): HighestLowestValue {
    let highest = Number.NEGATIVE_INFINITY;
    let lowest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < hBuf.length; i++) {
      const h = hBuf.get(i);
      const l = lBuf.get(i);
      if (h > highest) highest = h;
      if (l < lowest) lowest = l;
    }
    return { highest, lowest };
  }

  const nullValue: HighestLowestValue = { highest: null, lowest: null };

  function compute(candle: NormalizedCandle): { time: number; value: HighestLowestValue } {
    // Simulate adding to buffers without mutation
    const newCount = count + 1;
    if (newCount < period) {
      return { time: candle.time, value: nullValue };
    }

    // We need to scan including the new value
    let highest = candle.high;
    let lowest = candle.low;
    // Scan existing buffer excluding oldest if full (it will be overwritten)
    const startIdx = highBuffer.isFull ? 1 : 0;
    for (let i = startIdx; i < highBuffer.length; i++) {
      const h = highBuffer.get(i);
      const l = lowBuffer.get(i);
      if (h > highest) highest = h;
      if (l < lowest) lowest = l;
    }
    return { time: candle.time, value: { highest, lowest } };
  }

  const indicator: IncrementalIndicator<HighestLowestValue, HighestLowestState> = {
    next(candle: NormalizedCandle) {
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);
      count++;

      if (count < period) {
        return { time: candle.time, value: nullValue };
      }

      return { time: candle.time, value: scanMaxMin(highBuffer, lowBuffer) };
    },

    peek(candle: NormalizedCandle) {
      return compute(candle);
    },

    getState(): HighestLowestState {
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

  // Warm up with historical data
  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
