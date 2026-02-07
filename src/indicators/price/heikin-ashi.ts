/**
 * Heikin-Ashi (平均足) indicator
 *
 * Heikin-Ashi candles smooth price action to better identify trends.
 * They use modified OHLC values based on averages of current and previous bars.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

const EPSILON = 1e-10;

/**
 * Heikin-Ashi candle value
 */
export type HeikinAshiValue = {
  /** Heikin-Ashi open */
  open: number;
  /** Heikin-Ashi high */
  high: number;
  /** Heikin-Ashi low */
  low: number;
  /** Heikin-Ashi close */
  close: number;
  /** Trend direction: 1 = strong bullish (no lower shadow), -1 = strong bearish (no upper shadow), 0 = indecision */
  trend: 1 | -1 | 0;
};

/**
 * Calculate Heikin-Ashi candles
 *
 * Formulas:
 * - haClose = (Open + High + Low + Close) / 4
 * - haOpen = (prev_haOpen + prev_haClose) / 2 (first bar: (Open + Close) / 2)
 * - haHigh = max(High, haOpen, haClose)
 * - haLow = min(Low, haOpen, haClose)
 *
 * Trend detection:
 * - 1 (bullish): haClose > haOpen AND haLow equals haOpen (no lower shadow)
 * - -1 (bearish): haClose < haOpen AND haHigh equals haOpen (no upper shadow)
 * - 0 (indecision): otherwise
 *
 * @param candles - Array of candles (raw or normalized)
 * @returns Series of Heikin-Ashi values (never null)
 *
 * @example
 * ```ts
 * const ha = heikinAshi(candles);
 * const lastBar = ha[ha.length - 1].value;
 * if (lastBar.trend === 1) console.log("Strong bullish trend");
 * ```
 */
export function heikinAshi(candles: Candle[] | NormalizedCandle[]): Series<HeikinAshiValue> {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<HeikinAshiValue> = [];

  let prevHaOpen = 0;
  let prevHaClose = 0;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];

    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    let trend: 1 | -1 | 0 = 0;
    if (haClose > haOpen + EPSILON && Math.abs(haLow - haOpen) < EPSILON) {
      trend = 1;
    } else if (haClose < haOpen - EPSILON && Math.abs(haHigh - haOpen) < EPSILON) {
      trend = -1;
    }

    result.push({
      time: c.time,
      value: { open: haOpen, high: haHigh, low: haLow, close: haClose, trend },
    });

    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }

  return result;
}
