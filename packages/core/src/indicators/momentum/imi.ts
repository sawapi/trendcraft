/**
 * Intraday Momentum Index (IMI)
 *
 * A variation of RSI that uses open-to-close price movement
 * instead of close-to-close, with simple rolling sums.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * IMI options
 */
export type ImiOptions = {
  /** Rolling sum period (default: 14) */
  period?: number;
};

/**
 * Calculate Intraday Momentum Index
 *
 * IMI = 100 × SUM(gains, n) / (SUM(gains, n) + SUM(losses, n))
 * where gain = close - open (when close > open), loss = open - close (when open > close)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of IMI values (0-100, null for insufficient data)
 *
 * @example
 * ```ts
 * const result = imi(candles, { period: 14 });
 * ```
 */
export function imi(
  candles: Candle[] | NormalizedCandle[],
  options: ImiOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("IMI period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const result: Series<number | null> = [];

  // Pre-compute gains and losses per bar
  const gains: number[] = [];
  const losses: number[] = [];
  for (const c of normalized) {
    if (c.close > c.open) {
      gains.push(c.close - c.open);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(c.open - c.close);
    }
  }

  // Rolling sum
  let sumGain = 0;
  let sumLoss = 0;

  for (let i = 0; i < normalized.length; i++) {
    sumGain += gains[i];
    sumLoss += losses[i];

    if (i >= period) {
      sumGain -= gains[i - period];
      sumLoss -= losses[i - period];
    }

    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
    } else {
      const total = sumGain + sumLoss;
      result.push({
        time: normalized[i].time,
        value: total === 0 ? 50 : (100 * sumGain) / total,
      });
    }
  }

  return tagSeries(result, {
    pane: "sub",
    label: "IMI",
    yRange: [0, 100],
    referenceLines: [30, 70],
  });
}
