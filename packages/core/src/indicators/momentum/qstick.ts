/**
 * QStick indicator
 *
 * Created by Tushar Chande, QStick is the moving average of
 * (Close - Open), measuring buying/selling pressure.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * QStick options
 */
export type QstickOptions = {
  /** Period for SMA calculation (default: 14) */
  period?: number;
};

/**
 * Calculate QStick
 *
 * QStick = SMA(Close - Open, period)
 *
 * Interpretation:
 * - Positive QStick: Buying pressure (closes above opens on average)
 * - Negative QStick: Selling pressure (closes below opens on average)
 * - Zero-line crossovers indicate shifts in market sentiment
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - QStick options
 * @returns Series of QStick values (null for insufficient data)
 *
 * @example
 * ```ts
 * const qs = qstick(candles);
 * const isBullish = qs[i].value !== null && qs[i].value! > 0;
 * ```
 */
export function qstick(
  candles: Candle[] | NormalizedCandle[],
  options: QstickOptions = {},
): Series<number | null> {
  const { period = 14 } = options;

  if (period < 1) {
    throw new Error("QStick period must be at least 1");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];

  // Calculate Close - Open for each bar
  const diffs = normalized.map((c) => c.close - c.open);

  for (let i = 0; i < normalized.length; i++) {
    if (i < period - 1) {
      result.push({ time: normalized[i].time, value: null });
      continue;
    }

    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += diffs[j];
    }

    result.push({ time: normalized[i].time, value: sum / period });
  }

  return result;
}
