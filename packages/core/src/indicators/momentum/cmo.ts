/**
 * Chande Momentum Oscillator (CMO) indicator
 *
 * Created by Tushar Chande, CMO measures momentum using both up and down
 * price movement, oscillating between -100 and +100.
 *
 * Uses Wilder's smoothing method (same approach as RSI) to match
 * the industry-standard TA-Lib implementation.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";

/**
 * CMO options
 */
export type CmoOptions = {
  /** Period for CMO calculation (default: 14) */
  period?: number;
  /** Price source (default: 'close') */
  source?: PriceSource;
};

/**
 * Calculate Chande Momentum Oscillator
 *
 * CMO = 100 × (AvgGain - AvgLoss) / (AvgGain + AvgLoss)
 *
 * Interpretation:
 * - Above +50: Overbought
 * - Below -50: Oversold
 * - Zero-line crossovers signal trend changes
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - CMO options
 * @returns Series of CMO values (-100 to +100, null for insufficient data)
 *
 * @example
 * ```ts
 * const cmoData = cmo(candles);
 * const isOverbought = cmoData[i].value !== null && cmoData[i].value! > 50;
 * ```
 */
export function cmo(
  candles: Candle[] | NormalizedCandle[],
  options: CmoOptions = {},
): Series<number | null> {
  const { period = 14, source = "close" } = options;

  if (period < 1) {
    throw new Error("CMO period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const prices = normalized.map((c) => getPrice(c, source));

  // Null padding for insufficient data
  for (let i = 0; i < Math.min(period, normalized.length); i++) {
    result.push({ time: normalized[i].time, value: null });
  }

  if (normalized.length <= period) {
    return result;
  }

  // Initial seed: simple average of first `period` changes
  let avgUp = 0;
  let avgDown = 0;
  for (let j = 1; j <= period; j++) {
    const diff = prices[j] - prices[j - 1];
    if (diff > 0) avgUp += diff;
    else avgDown -= diff;
  }
  avgUp /= period;
  avgDown /= period;

  // First CMO value
  let total = avgUp + avgDown;
  result.push({
    time: normalized[period].time,
    value: total === 0 ? 0 : (100 * (avgUp - avgDown)) / total,
  });

  // Subsequent values use Wilder's smoothing
  for (let i = period + 1; i < normalized.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) {
      avgUp = (avgUp * (period - 1) + diff) / period;
      avgDown = (avgDown * (period - 1)) / period;
    } else {
      avgUp = (avgUp * (period - 1)) / period;
      avgDown = (avgDown * (period - 1) - diff) / period;
    }

    total = avgUp + avgDown;
    result.push({
      time: normalized[i].time,
      value: total === 0 ? 0 : (100 * (avgUp - avgDown)) / total,
    });
  }

  return tagSeries(result, {
    overlay: false,
    label: "CMO",
    yRange: [-100, 100],
    referenceLines: [50, -50],
  });
}
