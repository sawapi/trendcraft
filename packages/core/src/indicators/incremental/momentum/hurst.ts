/**
 * Incremental Hurst Exponent
 *
 * Estimates the Hurst exponent via Rescaled Range (R/S) analysis over a rolling
 * window of prices. H > 0.5 indicates trend persistence, H < 0.5 indicates
 * mean reversion, and H ~ 0.5 indicates a random walk.
 *
 * Uses a CircularBuffer to store the most recent `maxWindow` prices and
 * performs R/S analysis across multiple sub-window sizes (geometric progression).
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import type { IncrementalIndicator, WarmUpOptions } from "../types";
import { getSourcePrice } from "../utils";

export type HurstState = {
  priceBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  minWindow: number;
  maxWindow: number;
  source: PriceSource;
  count: number;
};

/**
 * Compute the Rescaled Range (R/S) statistic for a series of returns.
 */
function rescaledRange(returns: number[]): number | null {
  const n = returns.length;
  if (n < 2) return null;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += returns[i];
  const mean = sum / n;
  // Cumulative deviations
  const cumDev: number[] = new Array(n);
  cumDev[0] = returns[0] - mean;
  for (let i = 1; i < n; i++) cumDev[i] = cumDev[i - 1] + (returns[i] - mean);
  let maxDev = Number.NEGATIVE_INFINITY;
  let minDev = Number.POSITIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    if (cumDev[i] > maxDev) maxDev = cumDev[i];
    if (cumDev[i] < minDev) minDev = cumDev[i];
  }
  const range = maxDev - minDev;
  let variance = 0;
  for (let i = 0; i < n; i++) {
    const d = returns[i] - mean;
    variance += d * d;
  }
  const std = Math.sqrt(variance / (n - 1));
  if (std === 0) return null;
  return range / std;
}

/**
 * Compute the slope of a simple linear regression (y = slope*x + intercept).
 */
function linearRegressionSlope(x: number[], y: number[]): number {
  const n = x.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0.5;
  return (n * sumXY - sumX * sumY) / denom;
}

/**
 * Compute the Hurst exponent from a price series using R/S analysis.
 *
 * @param prices - Array of prices (oldest first)
 * @param minWindow - Minimum sub-window size for R/S analysis
 * @returns Hurst exponent in [0, 1], or null if insufficient data
 */
function calculateHurstFromPrices(prices: number[], minWindow: number): number | null {
  const n = prices.length;
  if (n < minWindow + 1) return null;

  // Compute log returns
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    returns.push(prices[i - 1] > 0 ? Math.log(prices[i] / prices[i - 1]) : 0);
  }

  const totalReturns = returns.length;
  if (totalReturns < minWindow) return null;

  // Generate sub-window sizes via geometric progression (factor 1.5)
  const windowSizes: number[] = [];
  let ws = minWindow;
  while (ws <= totalReturns) {
    windowSizes.push(Math.floor(ws));
    ws *= 1.5;
  }

  // Ensure final window size covers the full return array
  if (windowSizes.length === 0 || windowSizes[windowSizes.length - 1] !== totalReturns) {
    windowSizes.push(totalReturns);
  }

  // Deduplicate after flooring
  const uniqueSizes: number[] = [];
  for (const s of windowSizes) {
    if (uniqueSizes.length === 0 || uniqueSizes[uniqueSizes.length - 1] !== s) {
      uniqueSizes.push(s);
    }
  }

  if (uniqueSizes.length < 2) return null;

  const logN: number[] = [];
  const logRS: number[] = [];

  for (const size of uniqueSizes) {
    const numSegments = Math.floor(totalReturns / size);
    if (numSegments === 0) continue;

    let rsSum = 0;
    let validSegments = 0;

    for (let seg = 0; seg < numSegments; seg++) {
      const start = seg * size;
      const segment = returns.slice(start, start + size);
      const rs = rescaledRange(segment);
      if (rs !== null && rs > 0) {
        rsSum += rs;
        validSegments++;
      }
    }

    if (validSegments > 0) {
      const avgRS = rsSum / validSegments;
      logN.push(Math.log(size));
      logRS.push(Math.log(avgRS));
    }
  }

  if (logN.length < 2) return null;

  const hurst = linearRegressionSlope(logN, logRS);
  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, hurst));
}

/**
 * Create an incremental Hurst Exponent indicator
 *
 * @example
 * ```ts
 * const hurst = createHurst({ minWindow: 20, maxWindow: 100 });
 * for (const candle of stream) {
 *   const { value } = hurst.next(candle);
 *   if (value !== null) {
 *     if (value > 0.5) console.log("Trending");
 *     else if (value < 0.5) console.log("Mean-reverting");
 *   }
 * }
 * ```
 */
export function createHurst(
  options: {
    minWindow?: number;
    maxWindow?: number;
    source?: PriceSource;
  } = {},
  warmUpOptions?: WarmUpOptions<HurstState>,
): IncrementalIndicator<number | null, HurstState> {
  const minWindow = options.minWindow ?? 20;
  const maxWindow = options.maxWindow ?? 100;
  const source: PriceSource = options.source ?? "close";

  let priceBuffer: CircularBuffer<number>;
  let count: number;

  if (warmUpOptions?.fromState) {
    const s = warmUpOptions.fromState;
    priceBuffer = CircularBuffer.fromSnapshot(s.priceBuffer);
    count = s.count;
  } else {
    priceBuffer = new CircularBuffer<number>(maxWindow);
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, HurstState> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      priceBuffer.push(price);
      count++;

      if (count < maxWindow) {
        return { time: candle.time, value: null };
      }

      const prices = priceBuffer.toArray();
      const value = calculateHurstFromPrices(prices, minWindow);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      const peekCount = count + 1;

      if (peekCount < maxWindow) {
        return { time: candle.time, value: null };
      }

      // Simulate buffer state after push without mutating
      let prices: number[];
      if (priceBuffer.isFull) {
        // Drop oldest, append new price
        const arr = priceBuffer.toArray();
        prices = arr.slice(1);
        prices.push(price);
      } else {
        prices = priceBuffer.toArray();
        prices.push(price);
      }

      const value = calculateHurstFromPrices(prices, minWindow);
      return { time: candle.time, value };
    },

    getState(): HurstState {
      return {
        priceBuffer: priceBuffer.snapshot(),
        minWindow,
        maxWindow,
        source,
        count,
      };
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return count >= maxWindow;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
