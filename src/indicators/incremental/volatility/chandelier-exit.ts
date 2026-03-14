/**
 * Incremental Chandelier Exit
 *
 * Long Exit = Highest High (n) - ATR * Multiplier
 * Short Exit = Lowest Low (n) + ATR * Multiplier
 */

import type { ChandelierExitValue, NormalizedCandle } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { createAtr } from "./atr";
import type { AtrState } from "./atr";

export type ChandelierExitState = {
  period: number;
  multiplier: number;
  hlLookback: number;
  atrState: AtrState;
  highBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  lowBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  prevDirection: 1 | -1 | 0;
  count: number;
};

/**
 * Create an incremental Chandelier Exit indicator
 *
 * @example
 * ```ts
 * const ce = createChandelierExit({ period: 22, multiplier: 3.0 });
 * for (const candle of stream) {
 *   const { value } = ce.next(candle);
 *   if (value.isCrossover) console.log('Direction change!');
 * }
 * ```
 */
export function createChandelierExit(
  options: { period?: number; multiplier?: number; lookback?: number } = {},
  warmUpOptions?: WarmUpOptions<ChandelierExitState>,
): IncrementalIndicator<ChandelierExitValue, ChandelierExitState> {
  const period = options.period ?? 22;
  const multiplier = options.multiplier ?? 3.0;
  const hlLookback = options.lookback ?? period;

  let atrIndicator: ReturnType<typeof createAtr>;
  let highBuffer: CircularBuffer<number>;
  let lowBuffer: CircularBuffer<number>;
  let prevDirection: 1 | -1 | 0;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    atrIndicator = createAtr({ period }, { fromState: s.atrState });
    highBuffer = CircularBuffer.fromSnapshot(s.highBuffer);
    lowBuffer = CircularBuffer.fromSnapshot(s.lowBuffer);
    prevDirection = s.prevDirection;
    count = s.count;
  } else {
    atrIndicator = createAtr({ period });
    highBuffer = new CircularBuffer<number>(hlLookback);
    lowBuffer = new CircularBuffer<number>(hlLookback);
    prevDirection = 0;
    count = 0;
  }

  function getHighest(buf: CircularBuffer<number>): number {
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      if (buf.get(i) > max) max = buf.get(i);
    }
    return max;
  }

  function getLowest(buf: CircularBuffer<number>): number {
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < buf.length; i++) {
      if (buf.get(i) < min) min = buf.get(i);
    }
    return min;
  }

  function computeValue(
    candle: NormalizedCandle,
    atrVal: number | null,
    advance: boolean,
  ): ChandelierExitValue {
    const hh = highBuffer.length > 0 ? Math.max(getHighest(highBuffer), candle.high) : candle.high;
    const ll = lowBuffer.length > 0 ? Math.min(getLowest(lowBuffer), candle.low) : candle.low;

    // For peek: the buffers already include this candle for the `next` path
    // For advance=true, we use post-push values; for peek we simulate
    let highestHigh: number | null = null;
    let lowestLow: number | null = null;

    if (
      count >= hlLookback - 1 ||
      (advance && count + 1 >= hlLookback) ||
      (!advance && count >= hlLookback - 1)
    ) {
      highestHigh = hh;
      lowestLow = ll;
    } else {
      highestHigh = hh;
      lowestLow = ll;
    }

    let longExit: number | null = null;
    let shortExit: number | null = null;

    if (atrVal !== null && highestHigh !== null && lowestLow !== null) {
      const atrDist = atrVal * multiplier;
      longExit = highestHigh - atrDist;
      shortExit = lowestLow + atrDist;
    }

    let direction: 1 | -1 | 0 = 0;
    if (longExit !== null && shortExit !== null) {
      if (candle.close > longExit) {
        direction = 1;
      } else if (candle.close < shortExit) {
        direction = -1;
      } else {
        direction = prevDirection !== 0 ? prevDirection : 1;
      }
    }

    let isCrossover = false;
    if (prevDirection !== 0 && direction !== 0 && prevDirection !== direction) {
      isCrossover = true;
    }

    return {
      longExit,
      shortExit,
      direction,
      isCrossover,
      highestHigh,
      lowestLow,
      atr: atrVal,
    };
  }

  const indicator: IncrementalIndicator<ChandelierExitValue, ChandelierExitState> = {
    next(candle: NormalizedCandle) {
      count++;
      const atrResult = atrIndicator.next(candle);
      highBuffer.push(candle.high);
      lowBuffer.push(candle.low);

      const highestHigh = getHighest(highBuffer);
      const lowestLow = getLowest(lowBuffer);
      const atrVal = atrResult.value;

      let longExit: number | null = null;
      let shortExit: number | null = null;

      if (atrVal !== null) {
        const atrDist = atrVal * multiplier;
        longExit = highestHigh - atrDist;
        shortExit = lowestLow + atrDist;
      }

      let direction: 1 | -1 | 0 = 0;
      if (longExit !== null && shortExit !== null) {
        if (candle.close > longExit) {
          direction = 1;
        } else if (candle.close < shortExit) {
          direction = -1;
        } else {
          direction = prevDirection !== 0 ? prevDirection : 1;
        }
      }

      let isCrossover = false;
      if (prevDirection !== 0 && direction !== 0 && prevDirection !== direction) {
        isCrossover = true;
      }

      const value: ChandelierExitValue = {
        longExit,
        shortExit,
        direction,
        isCrossover,
        highestHigh,
        lowestLow,
        atr: atrVal,
      };

      prevDirection = direction;
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const atrVal = atrIndicator.peek(candle).value;

      // Simulate adding to buffers
      let hh = candle.high;
      let ll = candle.low;
      if (highBuffer.length > 0) {
        hh = Math.max(getHighest(highBuffer), candle.high);
        ll = Math.min(getLowest(lowBuffer), candle.low);
        // If buffer is full, we also need to remove oldest and consider new
        if (highBuffer.isFull) {
          // Recalculate without oldest, plus new value
          let maxH = candle.high;
          let minL = candle.low;
          for (let i = 1; i < highBuffer.length; i++) {
            if (highBuffer.get(i) > maxH) maxH = highBuffer.get(i);
            if (lowBuffer.get(i) < minL) minL = lowBuffer.get(i);
          }
          hh = maxH;
          ll = minL;
        }
      }

      let longExit: number | null = null;
      let shortExit: number | null = null;

      if (atrVal !== null) {
        longExit = hh - atrVal * multiplier;
        shortExit = ll + atrVal * multiplier;
      }

      let direction: 1 | -1 | 0 = 0;
      if (longExit !== null && shortExit !== null) {
        if (candle.close > longExit) {
          direction = 1;
        } else if (candle.close < shortExit) {
          direction = -1;
        } else {
          direction = prevDirection !== 0 ? prevDirection : 1;
        }
      }

      let isCrossover = false;
      if (prevDirection !== 0 && direction !== 0 && prevDirection !== direction) {
        isCrossover = true;
      }

      return {
        time: candle.time,
        value: {
          longExit,
          shortExit,
          direction,
          isCrossover,
          highestHigh: hh,
          lowestLow: ll,
          atr: atrVal,
        },
      };
    },

    getState(): ChandelierExitState {
      return {
        period,
        multiplier,
        hlLookback,
        atrState: atrIndicator.getState(),
        highBuffer: highBuffer.snapshot(),
        lowBuffer: lowBuffer.snapshot(),
        prevDirection,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return atrIndicator.isWarmedUp;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
