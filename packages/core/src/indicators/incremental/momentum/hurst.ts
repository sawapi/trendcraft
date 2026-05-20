/**
 * Incremental Hurst Exponent
 *
 * Estimates the Hurst exponent via Rescaled Range (R/S) analysis over a rolling
 * window of prices. H > 0.5 indicates trend persistence, H < 0.5 indicates
 * mean reversion, and H ~ 0.5 indicates a random walk.
 *
 * State category: **Windowed** (a single raw price buffer of size
 * `maxWindow`). A `maxWindow` change carries the most recent prices
 * forward into the resized buffer; `minWindow` is a resume-invariant
 * param (it only affects the R/S sub-window projection, never the
 * buffered data); `source` change is refused.
 *
 * Migrated to the 0.4.0 State Contract.
 */

import type { NormalizedCandle, PriceSource } from "../../../types";
import { CircularBuffer } from "../circular-buffer";
import {
  type IndicatorSnapshot,
  makeSnapshot,
  requireParam,
  resolveResume,
} from "../state-contract";
import type { IncrementalIndicator } from "../types";
import { getSourcePrice } from "../utils";

/**
 * Bare state shape for Hurst. Params (`minWindow`, `maxWindow`,
 * `source`) live in `meta.params` on the wire.
 */
export type HurstState = {
  priceBuffer: ReturnType<CircularBuffer<number>["snapshot"]>;
  count: number;
};

/** Per-indicator schema version. Bumped on any breaking state change. */
export const HURST_VERSION = 1;

type HurstParams = {
  minWindow: number;
  maxWindow: number;
  source: PriceSource;
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
  warmUpOptions?: {
    fromState?: IndicatorSnapshot<HurstState>;
    warmUp?: NormalizedCandle[];
  },
): IncrementalIndicator<number | null, IndicatorSnapshot<HurstState>> {
  const { params, state, reconfigured } = resolveResume<HurstParams, HurstState>({
    indicator: "hurst",
    version: HURST_VERSION,
    category: "windowed",
    options,
    fromState: warmUpOptions?.fromState ?? null,
    defaults: { minWindow: 20, maxWindow: 100, source: "close" },
    resumeInvariantParams: ["minWindow"],
  });

  const minWindow = requireParam(
    "hurst",
    params,
    "minWindow",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const maxWindow = requireParam(
    "hurst",
    params,
    "maxWindow",
    (v): v is number => Number.isInteger(v) && v >= 2,
    "must be an integer >= 2",
  );
  const source = params.source;

  let priceBuffer: CircularBuffer<number>;
  let count: number;

  if (state !== null) {
    if (reconfigured) {
      // maxWindow changed — carry the most recent prices forward.
      const old = CircularBuffer.fromSnapshot<number>(state.priceBuffer);
      priceBuffer = new CircularBuffer<number>(maxWindow);
      const carry = Math.min(old.length, maxWindow);
      for (let i = old.length - carry; i < old.length; i++) {
        priceBuffer.push(old.get(i));
      }
    } else {
      priceBuffer = CircularBuffer.fromSnapshot(state.priceBuffer);
    }
    count = state.count;
  } else {
    priceBuffer = new CircularBuffer<number>(maxWindow);
    count = 0;
  }

  const indicator: IncrementalIndicator<number | null, IndicatorSnapshot<HurstState>> = {
    next(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);
      priceBuffer.push(price);
      count++;

      // Gate on buffer fill, not `count`: after a maxWindow-growing
      // resume the carried buffer is shorter than the old `count`.
      if (priceBuffer.length < maxWindow) {
        return { time: candle.time, value: null };
      }

      const prices = priceBuffer.toArray();
      const value = calculateHurstFromPrices(prices, minWindow);
      return { time: candle.time, value };
    },

    peek(candle: NormalizedCandle) {
      const price = getSourcePrice(candle, source);

      // After the simulated push the buffer holds
      // min(length + 1, maxWindow) prices.
      if (priceBuffer.length + 1 < maxWindow) {
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

    getState(): IndicatorSnapshot<HurstState> {
      return makeSnapshot(
        "hurst",
        HURST_VERSION,
        { minWindow, maxWindow, source },
        {
          priceBuffer: priceBuffer.snapshot(),
          count,
        },
      );
    },

    get count() {
      return count;
    },

    get isWarmedUp() {
      return priceBuffer.length >= maxWindow;
    },
  };

  if (warmUpOptions?.warmUp) {
    for (const candle of warmUpOptions.warmUp) {
      indicator.next(candle);
    }
  }

  return indicator;
}
