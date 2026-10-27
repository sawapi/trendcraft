/**
 * Supertrend indicator
 *
 * Supertrend is a trend-following indicator that uses ATR to calculate
 * dynamic support/resistance levels.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { assertPeriod } from "../../utils/validate-period";
import { SUPERTREND_META } from "../indicator-meta";
import { atr } from "../volatility/atr";

/**
 * Supertrend options
 */
export type SupertrendOptions = {
  /** ATR period (default: 10) */
  period?: number;
  /** ATR multiplier (default: 3) */
  multiplier?: number;
};

/**
 * Supertrend value
 */
export type SupertrendValue = {
  /**
   * Supertrend value (support when bullish, resistance when bearish);
   * `null` while `direction` is 0
   */
  supertrend: number | null;
  /**
   * Trend direction: 1 = bullish (up), -1 = bearish (down), 0 = undefined —
   * during the ATR warm-up, and after it until the close first breaks a band
   */
  direction: 1 | -1 | 0;
  /** Upper band value */
  upperBand: number | null;
  /** Lower band value */
  lowerBand: number | null;
};

/**
 * Calculate Supertrend indicator
 *
 * Calculation:
 * - Basic Upper Band = (High + Low) / 2 + Multiplier × ATR
 * - Basic Lower Band = (High + Low) / 2 - Multiplier × ATR
 * - Final Upper Band = If Basic Upper Band < Previous Final Upper Band OR Previous Close > Previous Final Upper Band
 *                      Then Basic Upper Band, Else Previous Final Upper Band
 * - Final Lower Band = If Basic Lower Band > Previous Final Lower Band OR Previous Close < Previous Final Lower Band
 *                      Then Basic Lower Band, Else Previous Final Lower Band
 *
 * Trend:
 * - Bullish when price closes above the upper band
 * - Bearish when price closes below the lower band
 * - Undefined (`direction: 0`) until the first such close: no direction is
 *   assumed before price has broken a band, so the first defined direction
 *   is a real break rather than a seed that a trend later corrects. From
 *   that bar on the result equals TradingView's `ta.supertrend`, which
 *   seeds a downtrend instead. With the defaults this stretch typically
 *   lasts 10–25 bars after the warm-up, sometimes 50+.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Supertrend options
 * @returns Series of Supertrend values
 *
 * @example
 * ```ts
 * const st = supertrend(candles);
 * const stCustom = supertrend(candles, { period: 7, multiplier: 2 });
 *
 * // Check trend
 * const isBullish = st[i].value.direction === 1;
 * const isBearish = st[i].value.direction === -1;
 *
 * // Use as trailing stop
 * const stopLevel = st[i].value.supertrend;
 * ```
 */
export function supertrend(
  candles: Candle[] | NormalizedCandle[],
  options: SupertrendOptions = {},
): Series<SupertrendValue> {
  const { period = 10, multiplier = 3 } = options;

  assertPeriod("Supertrend period", period);
  if (multiplier <= 0) {
    throw new Error("Supertrend multiplier must be positive");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  const result: Series<SupertrendValue> = [];

  // Calculate ATR
  const atrData = atr(normalized, { period });

  // Store final bands
  const finalUpperBand: (number | null)[] = [];
  const finalLowerBand: (number | null)[] = [];
  const directions: (1 | -1 | 0)[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const atrValue = atrData[i].value;

    if (atrValue === null) {
      result.push({
        time: candle.time,
        value: {
          supertrend: null,
          direction: 0,
          upperBand: null,
          lowerBand: null,
        },
      });
      finalUpperBand.push(null);
      finalLowerBand.push(null);
      directions.push(0);
      continue;
    }

    // Calculate basic bands
    const hl2 = (candle.high + candle.low) / 2;
    const basicUpperBand = hl2 + multiplier * atrValue;
    const basicLowerBand = hl2 - multiplier * atrValue;

    // Calculate final upper band
    let finalUpper: number;
    const prevFinalUpper = finalUpperBand[i - 1];
    const prevClose = i > 0 ? normalized[i - 1].close : 0;

    if (prevFinalUpper === null || basicUpperBand < prevFinalUpper || prevClose > prevFinalUpper) {
      finalUpper = basicUpperBand;
    } else {
      finalUpper = prevFinalUpper;
    }

    // Calculate final lower band
    let finalLower: number;
    const prevFinalLower = finalLowerBand[i - 1];

    if (prevFinalLower === null || basicLowerBand > prevFinalLower || prevClose < prevFinalLower) {
      finalLower = basicLowerBand;
    } else {
      finalLower = prevFinalLower;
    }

    // Determine trend direction
    let direction: 1 | -1 | 0;
    const prevDirection = directions[i - 1] ?? 0;

    if (prevDirection === 0) {
      // Undefined until the close first breaks a band
      direction = candle.close > finalUpper ? 1 : candle.close < finalLower ? -1 : 0;
    } else if (prevDirection === 1) {
      // Was bullish
      if (candle.close < finalLower) {
        direction = -1; // Switch to bearish
      } else {
        direction = 1; // Stay bullish
      }
    } else {
      // Was bearish
      if (candle.close > finalUpper) {
        direction = 1; // Switch to bullish
      } else {
        direction = -1; // Stay bearish
      }
    }

    // Determine supertrend value
    const supertrendValue = direction === 0 ? null : direction === 1 ? finalLower : finalUpper;

    finalUpperBand.push(finalUpper);
    finalLowerBand.push(finalLower);
    directions.push(direction);

    result.push({
      time: candle.time,
      value: {
        supertrend: supertrendValue,
        direction,
        upperBand: finalUpper,
        lowerBand: finalLower,
      },
    });
  }

  return tagSeries(result, withLabelParams(SUPERTREND_META, [period, multiplier]));
}
