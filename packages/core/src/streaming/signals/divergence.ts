/**
 * Incremental Divergence Detector
 *
 * Detects bullish and bearish divergences between price and an indicator
 * by comparing recent highs/lows of each.
 *
 * Bullish divergence: price makes lower lows while indicator makes higher lows
 * Bearish divergence: price makes higher highs while indicator makes lower highs
 *
 * @example
 * ```ts
 * const divergence = createDivergenceDetector({ lookback: 14 });
 * for (const candle of stream) {
 *   const rsi = rsiIndicator.next(candle).value;
 *   const result = divergence.next(candle.close, rsi);
 *   if (result.bullish) console.log('Bullish divergence detected');
 *   if (result.bearish) console.log('Bearish divergence detected');
 * }
 * ```
 */

import type { DivergenceDetector, DivergenceDetectorState, DivergenceResult } from "../types";

/**
 * Options for creating a DivergenceDetector
 */
export type DivergenceDetectorOptions = {
  /** Number of bars to look back for divergence detection (default: 14) */
  lookback?: number;
};

const NO_DIVERGENCE: DivergenceResult = { bullish: false, bearish: false };

/**
 * Create a divergence detector that identifies bullish/bearish divergences
 * between price and an indicator.
 *
 * @param options - Divergence detection options
 * @param fromState - Optional saved state to restore from
 * @returns A DivergenceDetector instance
 *
 * @example
 * ```ts
 * const detector = createDivergenceDetector({ lookback: 20 });
 * const { bullish, bearish } = detector.next(candle.close, rsiValue);
 * ```
 */
export function createDivergenceDetector(
  options: DivergenceDetectorOptions = {},
  fromState?: DivergenceDetectorState,
): DivergenceDetector {
  const lookback = fromState?.lookback ?? options.lookback ?? 14;
  const bufferSize = fromState?.bufferSize ?? lookback;

  let priceBuffer: (number | null)[] = fromState?.priceBuffer ? [...fromState.priceBuffer] : [];
  let indicatorBuffer: (number | null)[] = fromState?.indicatorBuffer
    ? [...fromState.indicatorBuffer]
    : [];

  function pushToBuffer(buf: (number | null)[], value: number | null): (number | null)[] {
    buf.push(value);
    if (buf.length > bufferSize) {
      buf.shift();
    }
    return buf;
  }

  function detectDivergence(
    prices: (number | null)[],
    indicators: (number | null)[],
  ): DivergenceResult {
    if (prices.length < 2) return NO_DIVERGENCE;

    // Find the min/max in the first half and second half of the buffer
    const mid = Math.floor(prices.length / 2);
    const firstPrices = prices.slice(0, mid).filter((v): v is number => v !== null);
    const secondPrices = prices.slice(mid).filter((v): v is number => v !== null);
    const firstIndicators = indicators.slice(0, mid).filter((v): v is number => v !== null);
    const secondIndicators = indicators.slice(mid).filter((v): v is number => v !== null);

    if (
      firstPrices.length === 0 ||
      secondPrices.length === 0 ||
      firstIndicators.length === 0 ||
      secondIndicators.length === 0
    ) {
      return NO_DIVERGENCE;
    }

    const firstPriceLow = Math.min(...firstPrices);
    const secondPriceLow = Math.min(...secondPrices);
    const firstIndicatorLow = Math.min(...firstIndicators);
    const secondIndicatorLow = Math.min(...secondIndicators);

    const firstPriceHigh = Math.max(...firstPrices);
    const secondPriceHigh = Math.max(...secondPrices);
    const firstIndicatorHigh = Math.max(...firstIndicators);
    const secondIndicatorHigh = Math.max(...secondIndicators);

    // Bullish: price makes lower low, indicator makes higher low
    const bullish = secondPriceLow < firstPriceLow && secondIndicatorLow > firstIndicatorLow;

    // Bearish: price makes higher high, indicator makes lower high
    const bearish = secondPriceHigh > firstPriceHigh && secondIndicatorHigh < firstIndicatorHigh;

    return { bullish, bearish };
  }

  return {
    next(price: number | null, indicatorValue: number | null): DivergenceResult {
      priceBuffer = pushToBuffer(priceBuffer, price);
      indicatorBuffer = pushToBuffer(indicatorBuffer, indicatorValue);

      if (priceBuffer.length < bufferSize) {
        return NO_DIVERGENCE;
      }

      return detectDivergence(priceBuffer, indicatorBuffer);
    },

    peek(price: number | null, indicatorValue: number | null): DivergenceResult {
      const tempPrices = [...priceBuffer, price];
      const tempIndicators = [...indicatorBuffer, indicatorValue];
      if (tempPrices.length > bufferSize) tempPrices.shift();
      if (tempIndicators.length > bufferSize) tempIndicators.shift();

      if (tempPrices.length < bufferSize) {
        return NO_DIVERGENCE;
      }

      return detectDivergence(tempPrices, tempIndicators);
    },

    getState(): DivergenceDetectorState {
      return {
        priceBuffer: [...priceBuffer],
        indicatorBuffer: [...indicatorBuffer],
        lookback,
        bufferSize,
      };
    },
  };
}
