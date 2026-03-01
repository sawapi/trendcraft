/**
 * Candle Resampler
 *
 * Incrementally resamples lower-timeframe candles into higher-timeframe candles.
 * For example, converts 1-minute candles into 5-minute candles in real time.
 *
 * @example
 * ```ts
 * const resampler = createCandleResampler({ targetIntervalMs: 300_000 }); // 5-min
 * for (const candle1m of stream) {
 *   const candle5m = resampler.addCandle(candle1m);
 *   if (candle5m) {
 *     // A 5-minute candle was completed
 *     console.log(candle5m);
 *   }
 * }
 * ```
 */

import type { NormalizedCandle } from "../types";
import type {
  CandleResampler,
  CandleResamplerOptions,
  CandleResamplerState,
} from "./types";

/**
 * Compute the period start for a given timestamp and interval.
 * Aligns to UTC epoch boundaries.
 */
function getIntervalStart(time: number, intervalMs: number): number {
  return Math.floor(time / intervalMs) * intervalMs;
}

/**
 * Create a stateful candle resampler that aggregates lower-TF candles into higher-TF.
 *
 * @param options - Resampler configuration
 * @param fromState - Optional saved state to restore from
 * @returns A CandleResampler instance
 *
 * @example
 * ```ts
 * // Resample 1-minute to 15-minute candles
 * const resampler = createCandleResampler({ targetIntervalMs: 15 * 60_000 });
 * const completed = resampler.addCandle(oneMinCandle);
 * ```
 */
export function createCandleResampler(
  options: CandleResamplerOptions,
  fromState?: CandleResamplerState,
): CandleResampler {
  const { targetIntervalMs } = options;

  if (targetIntervalMs <= 0) {
    throw new Error("targetIntervalMs must be positive");
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

  function resetFromCandle(periodStart: number, candle: NormalizedCandle): void {
    currentPeriodStart = periodStart;
    open = candle.open;
    high = candle.high;
    low = candle.low;
    close = candle.close;
    volume = candle.volume;
  }

  function mergeCandle(candle: NormalizedCandle): void {
    if (high === null || candle.high > high) high = candle.high;
    if (low === null || candle.low < low) low = candle.low;
    close = candle.close;
    volume += candle.volume;
  }

  return {
    addCandle(candle: NormalizedCandle): NormalizedCandle | null {
      const periodStart = getIntervalStart(candle.time, targetIntervalMs);

      // First candle ever
      if (currentPeriodStart === null) {
        resetFromCandle(periodStart, candle);
        return null;
      }

      // Same period → merge into current
      if (periodStart === currentPeriodStart) {
        mergeCandle(candle);
        return null;
      }

      // New period → complete the old candle and start a new one
      const completed = buildCandle();
      resetFromCandle(periodStart, candle);
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

    getState(): CandleResamplerState {
      return {
        targetIntervalMs,
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
