/**
 * Incremental ZLEMA (Zero-Lag Exponential Moving Average)
 *
 * ZLEMA = EMA(adjusted_price, period)
 * where adjusted_price = price + (price - price[lag])
 * and lag = floor((period - 1) / 2)
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type ZlemaState = {
  period: number;
  source: PriceSource;
  lag: number;
  multiplier: number;
  prevZlema: number | null;
  /** Sum of adjusted prices during SMA seed phase */
  seedSum: number;
  /** Count of adjusted prices accumulated in seed phase */
  seedCount: number;
  buffer: { data: number[]; head: number; length: number; capacity: number };
  count: number;
};

/**
 * Create an incremental ZLEMA indicator
 *
 * @example
 * ```ts
 * const zlema = createZlema({ period: 20 });
 * for (const candle of stream) {
 *   const { value } = zlema.next(candle);
 *   if (zlema.isWarmedUp) console.log(value);
 * }
 * ```
 */
export function createZlema(
  options: { period?: number; source?: PriceSource } = {},
  warmUpOptions?: WarmUpOptions<ZlemaState>,
): IncrementalIndicator<number | null, ZlemaState> {
  const period = options.period ?? 20;
  if (period < 1) {
    throw new Error("ZLEMA period must be at least 1");
  }
  const source: PriceSource = options.source ?? "close";
  const lag = Math.floor((period - 1) / 2);
  const multiplier = 2 / (period + 1);

  // Buffer to hold prices for lag lookback (need lag+1 to access price[i-lag])
  let buffer: CircularBuffer<number>;
  let prevZlema: number | null;
  let seedSum: number;
  let seedCount: number;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    buffer = CircularBuffer.fromSnapshot(s.buffer);
    prevZlema = s.prevZlema;
    seedSum = s.seedSum;
    seedCount = s.seedCount;
    count = s.count;
  } else {
    buffer = new CircularBuffer<number>(lag + 1);
    prevZlema = null;
    seedSum = 0;
    seedCount = 0;
    count = 0;
  }

  function compute(price: number, currentCount: number, isPeek: boolean): number | null {
    // Need at least lag+1 prices to compute adjusted price
    if (currentCount <= lag) {
      return null;
    }

    // Get the lagged price from the buffer
    // In buffer: index 0 = oldest. We need the price from `lag` bars ago.
    // After pushing current price, buffer has min(count, lag+1) items.
    // The lagged price is at index 0 when buffer is full.
    const lagPrice = isPeek ? buffer.get(buffer.length - lag) : buffer.get(buffer.length - 1 - lag);
    const adjustedPrice = price + (price - lagPrice);

    // SMA seed phase: need `period - lag` adjusted prices for seeding
    const seedTarget = period - lag;
    const currentSeedCount = isPeek ? seedCount + 1 : seedCount;
    const currentSeedSum = isPeek ? seedSum + adjustedPrice : seedSum;

    if (currentSeedCount < seedTarget) {
      return null;
    }

    if (currentSeedCount === seedTarget) {
      return currentSeedSum / seedTarget;
    }

    // Standard EMA on adjusted price
    const prev = isPeek ? prevZlema : prevZlema;
    return adjustedPrice * multiplier + (prev ?? 0) * (1 - multiplier);
  }

  const indicator: IncrementalIndicator<number | null, ZlemaState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      count++;
      buffer.push(price);

      if (count <= lag) {
        return { time: candle.time, value: null };
      }

      // Accumulate adjusted prices for SMA seed
      const lagPrice = buffer.get(buffer.length - 1 - lag);
      const adjustedPrice = price + (price - lagPrice);
      seedCount++;

      const seedTarget = period - lag;

      if (seedCount < seedTarget) {
        seedSum += adjustedPrice;
        return { time: candle.time, value: null };
      }

      if (seedCount === seedTarget) {
        seedSum += adjustedPrice;
        prevZlema = seedSum / seedTarget;
        return { time: candle.time, value: prevZlema };
      }

      // Standard EMA
      prevZlema = adjustedPrice * multiplier + (prevZlema ?? 0) * (1 - multiplier);
      return { time: candle.time, value: prevZlema };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const nextCount = count + 1;

      // Not enough data yet for lag lookback
      if (nextCount <= lag) {
        return { time: candle.time, value: null };
      }

      // Compute lag price from simulated buffer state after push
      let lagPrice: number;
      if (lag === 0) {
        // No lag: adjusted price = 2*price - price = price
        lagPrice = price;
      } else if (buffer.length < lag) {
        // Buffer doesn't have enough items even after push
        return { time: candle.time, value: null };
      } else if (buffer.length < buffer.capacity) {
        // Buffer not yet full: after push, lag price is at index (length - lag)
        lagPrice = buffer.get(buffer.length - lag);
      } else {
        // Buffer full: push evicts oldest, lag price shifts by 1
        lagPrice = buffer.get(buffer.length - lag);
      }

      const adjustedPrice = price + (price - lagPrice);
      const nextSeedCount = seedCount + 1;
      const seedTarget = period - lag;

      if (nextSeedCount < seedTarget) {
        return { time: candle.time, value: null };
      }

      if (nextSeedCount === seedTarget) {
        return { time: candle.time, value: (seedSum + adjustedPrice) / seedTarget };
      }

      // Standard EMA
      const value = adjustedPrice * multiplier + (prevZlema ?? 0) * (1 - multiplier);
      return { time: candle.time, value };
    },

    getState(): ZlemaState {
      return {
        period,
        source,
        lag,
        multiplier,
        prevZlema,
        seedSum,
        seedCount,
        buffer: buffer.snapshot(),
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return prevZlema !== null;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
