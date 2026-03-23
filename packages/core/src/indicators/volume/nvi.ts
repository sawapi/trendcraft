/**
 * Negative Volume Index (NVI) indicator
 *
 * NVI tracks price changes on days when volume decreases from the previous day.
 * The theory is that "smart money" is active on quiet volume days.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * NVI options
 */
export type NviOptions = {
  /** Initial NVI value (default: 1000) */
  initialValue?: number;
};

/**
 * Calculate Negative Volume Index
 *
 * If today's volume < yesterday's volume:
 *   NVI = Previous NVI + ((Close - Previous Close) / Previous Close) × Previous NVI
 * Otherwise:
 *   NVI = Previous NVI (unchanged)
 *
 * Interpretation:
 * - Rising NVI suggests smart money is buying on quiet days
 * - NVI above its 255-day MA: 96% chance of bull market (Fosback)
 * - NVI below its 255-day MA: higher probability of bear market
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - NVI options
 * @returns Series of NVI values
 *
 * @example
 * ```ts
 * const nviData = nvi(candles);
 * // Compare NVI with its 255-period MA for long-term signals
 * ```
 */
export function nvi(
  candles: Candle[] | NormalizedCandle[],
  options: NviOptions = {},
): Series<number | null> {
  const { initialValue = 1000 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  if (normalized.length === 0) return result;

  let currentNvi = initialValue;
  result.push({ time: normalized[0].time, value: currentNvi });

  for (let i = 1; i < normalized.length; i++) {
    const prevClose = normalized[i - 1].close;

    if (normalized[i].volume < normalized[i - 1].volume && prevClose !== 0) {
      currentNvi *= normalized[i].close / prevClose;
    }

    result.push({ time: normalized[i].time, value: currentNvi });
  }

  return tagSeries(result, { pane: "sub", label: "NVI" });
}
