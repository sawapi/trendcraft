/**
 * Candle Aggregator
 *
 * Converts a stream of trades (ticks) into OHLCV candles
 * by grouping trades within fixed time intervals.
 *
 * @example
 * ```ts
 * const agg = createCandleAggregator({ intervalMs: 60_000 }); // 1-minute candles
 * for (const trade of tickStream) {
 *   const candle = agg.addTrade(trade);
 *   if (candle) {
 *     // A candle was completed
 *     console.log(candle);
 *   }
 * }
 * // At session end, flush the last partial candle
 * const last = agg.flush();
 * ```
 */

import type { NormalizedCandle } from "../types";
import type {
  Trade,
  CandleAggregator,
  CandleAggregatorOptions,
  CandleAggregatorState,
} from "./types";

/**
 * Compute the period start for a given timestamp and interval.
 * Aligns to UTC epoch boundaries.
 */
function getIntervalStart(time: number, intervalMs: number): number {
  return Math.floor(time / intervalMs) * intervalMs;
}

/**
 * Create a stateful candle aggregator that converts trades into OHLCV candles.
 *
 * @param options - Aggregator configuration
 * @param fromState - Optional saved state to restore from
 * @returns A CandleAggregator instance
 *
 * @example
 * ```ts
 * const agg = createCandleAggregator({ intervalMs: 60_000 });
 * const completed = agg.addTrade({ time: Date.now(), price: 100, volume: 10 });
 * if (completed) processCandle(completed);
 * ```
 */
export function createCandleAggregator(
  options: CandleAggregatorOptions,
  fromState?: CandleAggregatorState,
): CandleAggregator {
  const { intervalMs } = options;

  if (intervalMs <= 0) {
    throw new Error("intervalMs must be positive");
  }

  let currentPeriodStart = fromState?.currentPeriodStart ?? null;
  let open = fromState?.open ?? null;
  let high = fromState?.high ?? null;
  let low = fromState?.low ?? null;
  let close = fromState?.close ?? null;
  let volume = fromState?.volume ?? 0;

  function buildCandle(): NormalizedCandle {
    return {
      time: currentPeriodStart!,
      open: open!,
      high: high!,
      low: low!,
      close: close!,
      volume,
    };
  }

  function resetCandle(periodStart: number, trade: Trade): void {
    currentPeriodStart = periodStart;
    open = trade.price;
    high = trade.price;
    low = trade.price;
    close = trade.price;
    volume = trade.volume;
  }

  function updateCandle(trade: Trade): void {
    if (high === null || trade.price > high) high = trade.price;
    if (low === null || trade.price < low) low = trade.price;
    close = trade.price;
    volume += trade.volume;
  }

  return {
    addTrade(trade: Trade): NormalizedCandle | null {
      const periodStart = getIntervalStart(trade.time, intervalMs);

      // First trade ever
      if (currentPeriodStart === null) {
        resetCandle(periodStart, trade);
        return null;
      }

      // Same period → update current candle
      if (periodStart === currentPeriodStart) {
        updateCandle(trade);
        return null;
      }

      // New period → complete the old candle and start a new one
      const completed = buildCandle();
      resetCandle(periodStart, trade);
      return completed;
    },

    getCurrentCandle(): NormalizedCandle | null {
      if (currentPeriodStart === null || open === null) {
        return null;
      }
      return buildCandle();
    },

    flush(): NormalizedCandle | null {
      if (currentPeriodStart === null || open === null) {
        return null;
      }
      const candle = buildCandle();
      currentPeriodStart = null;
      open = null;
      high = null;
      low = null;
      close = null;
      volume = 0;
      return candle;
    },

    getState(): CandleAggregatorState {
      return {
        intervalMs,
        currentPeriodStart,
        open,
        high,
        low,
        close,
        volume,
      };
    },
  };
}
