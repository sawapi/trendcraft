/**
 * Chandelier Exit indicator
 *
 * A volatility-based trailing stop indicator created by Charles Le Beau.
 * Uses ATR to calculate exit points from the highest high (for longs)
 * or lowest low (for shorts).
 *
 * Calculation:
 * - Long Exit = Highest High (n periods) - ATR * Multiplier
 * - Short Exit = Lowest Low (n periods) + ATR * Multiplier
 *
 * Default parameters use the classic settings: period=22, multiplier=3.0
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type {
  Candle,
  ChandelierExitOptions,
  ChandelierExitValue,
  NormalizedCandle,
  Series,
} from "../../types";
import { CHANDELIER_EXIT_META } from "../indicator-meta";
import { highest, lowest } from "../price/highest-lowest";
import { atr } from "./atr";

/**
 * Calculate Chandelier Exit indicator
 *
 * The Chandelier Exit is a volatility-based trailing stop that hangs
 * from either the highest high (for long positions) or the lowest low
 * (for short positions) like a chandelier hangs from a ceiling.
 *
 * Trading signals:
 * - Long exit: when price closes below longExit
 * - Short exit: when price closes above shortExit
 * - Trend direction: 1 = bullish (price above longExit), -1 = bearish
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Chandelier Exit options
 * @returns Series of ChandelierExitValue
 *
 * @example
 * ```ts
 * // Classic Chandelier Exit (22-period, 3x ATR)
 * const chandelier = chandelierExit(candles);
 *
 * // Custom settings
 * const chandelier = chandelierExit(candles, {
 *   period: 14,
 *   multiplier: 2.5,
 *   lookback: 20,
 * });
 *
 * // Check for exit signals
 * const latest = chandelier[chandelier.length - 1].value;
 * if (latest.direction === 1 && currentPrice < latest.longExit) {
 *   console.log('Long exit signal - price crossed below Chandelier Exit');
 * }
 * ```
 */
export function chandelierExit(
  candles: Candle[] | NormalizedCandle[],
  options: ChandelierExitOptions = {},
): Series<ChandelierExitValue> {
  const { period = 22, multiplier = 3.0, lookback } = options;

  // Use lookback if specified, otherwise use period
  const hlLookback = lookback ?? period;

  if (period < 1) {
    throw new Error("Chandelier Exit period must be at least 1");
  }

  if (hlLookback < 1) {
    throw new Error("Chandelier Exit lookback must be at least 1");
  }

  if (multiplier <= 0) {
    throw new Error("Chandelier Exit multiplier must be positive");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate ATR
  const atrData = atr(normalized, { period });

  // Calculate highest high and lowest low
  const highestData = highest(normalized, hlLookback);
  const lowestData = lowest(normalized, hlLookback);

  const result: Series<ChandelierExitValue> = [];
  let prevDirection: 1 | -1 | 0 = 0;
  let prevLongExit: number | null = null;
  let prevShortExit: number | null = null;

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const atrValue = atrData[i].value;
    const highestHigh = highestData[i].value;
    const lowestLow = lowestData[i].value;

    // Calculate exit levels
    let longExit: number | null = null;
    let shortExit: number | null = null;

    if (atrValue !== null && highestHigh !== null && lowestLow !== null) {
      const atrDistance = atrValue * multiplier;
      longExit = highestHigh - atrDistance;
      shortExit = lowestLow + atrDistance;
    }

    // Determine current trend direction
    let direction: 1 | -1 | 0 = 0;
    if (longExit !== null && shortExit !== null) {
      if (candle.close > longExit) {
        direction = 1; // Bullish
      } else if (candle.close < shortExit) {
        direction = -1; // Bearish
      } else {
        // In the middle - maintain previous direction
        direction = prevDirection !== 0 ? prevDirection : 1;
      }
    }

    // Detect crossover (potential exit signal)
    let isCrossover = false;
    if (prevDirection !== 0 && direction !== 0) {
      // Long exit crossover: was bullish, price crossed below longExit
      if (prevDirection === 1 && direction === -1) {
        isCrossover = true;
      }
      // Short exit crossover: was bearish, price crossed above shortExit
      if (prevDirection === -1 && direction === 1) {
        isCrossover = true;
      }
    }

    result.push({
      time: candle.time,
      value: {
        longExit,
        shortExit,
        direction,
        isCrossover,
        highestHigh,
        lowestLow,
        atr: atrValue,
      },
    });

    prevDirection = direction;
    prevLongExit = longExit;
    prevShortExit = shortExit;
  }

  return tagSeries(result, CHANDELIER_EXIT_META);
}
