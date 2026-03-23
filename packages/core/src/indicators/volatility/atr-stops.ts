/**
 * ATR Stop Levels indicator
 *
 * Provides ATR-based stop loss and take profit levels for risk management.
 * Calculates dynamic levels based on current market volatility.
 *
 * Use cases:
 * - Position sizing: Calculate risk per trade based on ATR stop distance
 * - Trailing stops: Use longStopLevel as dynamic trailing stop
 * - Take profit targets: Use ATR-based targets for consistent risk/reward
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { AtrStopsOptions, AtrStopsValue, Candle, NormalizedCandle, Series } from "../../types";
import { atr } from "./atr";

/**
 * Calculate ATR-based stop loss and take profit levels
 *
 * Provides dynamic risk levels based on current volatility.
 * Higher volatility = wider stops, lower volatility = tighter stops.
 *
 * This is essential for:
 * - Position sizing (risk amount / stop distance = shares)
 * - Consistent risk management across different market conditions
 * - Avoiding premature stop-outs in volatile markets
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - ATR stops options
 * @returns Series of AtrStopsValue
 *
 * @example
 * ```ts
 * const stops = atrStops(candles, {
 *   period: 14,
 *   stopMultiplier: 2.0,
 *   takeProfitMultiplier: 3.0,
 * });
 *
 * const latest = stops[stops.length - 1].value;
 * console.log(`Long Stop: ${latest.longStopLevel}`);
 * console.log(`Long Target: ${latest.longTakeProfitLevel}`);
 * console.log(`Stop Distance: ${latest.stopDistance}`);
 *
 * // Position sizing example
 * const accountRisk = 10000; // Risk $10,000
 * const shares = Math.floor(accountRisk / latest.stopDistance);
 * ```
 */
export function atrStops(
  candles: Candle[] | NormalizedCandle[],
  options: AtrStopsOptions = {},
): Series<AtrStopsValue> {
  const { period = 14, stopMultiplier = 2.0, takeProfitMultiplier = 3.0 } = options;

  if (period < 1) {
    throw new Error("ATR Stops period must be at least 1");
  }

  if (stopMultiplier <= 0) {
    throw new Error("ATR Stops stopMultiplier must be positive");
  }

  if (takeProfitMultiplier <= 0) {
    throw new Error("ATR Stops takeProfitMultiplier must be positive");
  }

  // Normalize if needed
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Calculate ATR
  const atrData = atr(normalized, { period });

  const result: Series<AtrStopsValue> = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const atrValue = atrData[i].value;

    if (atrValue === null) {
      result.push({
        time: candle.time,
        value: {
          longStopLevel: null,
          shortStopLevel: null,
          longTakeProfitLevel: null,
          shortTakeProfitLevel: null,
          atr: null,
          stopDistance: null,
          takeProfitDistance: null,
        },
      });
    } else {
      const stopDistance = atrValue * stopMultiplier;
      const takeProfitDistance = atrValue * takeProfitMultiplier;

      result.push({
        time: candle.time,
        value: {
          longStopLevel: candle.close - stopDistance,
          shortStopLevel: candle.close + stopDistance,
          longTakeProfitLevel: candle.close + takeProfitDistance,
          shortTakeProfitLevel: candle.close - takeProfitDistance,
          atr: atrValue,
          stopDistance,
          takeProfitDistance,
        },
      });
    }
  }

  return tagSeries(result, { overlay: true, label: "ATR Stops" });
}

/**
 * Calculate ATR-based stop level for a specific entry price
 *
 * Utility function for real-time position management.
 *
 * @param entryPrice - Entry price of the position
 * @param atrValue - Current ATR value
 * @param multiplier - ATR multiplier for stop distance
 * @param direction - 'long' or 'short'
 * @returns Stop loss price
 *
 * @example
 * ```ts
 * const stopPrice = calculateAtrStop(100, 2.5, 2.0, 'long');
 * // stopPrice = 100 - (2.5 * 2.0) = 95
 * ```
 */
export function calculateAtrStop(
  entryPrice: number,
  atrValue: number,
  multiplier: number,
  direction: "long" | "short",
): number {
  const distance = atrValue * multiplier;
  return direction === "long" ? entryPrice - distance : entryPrice + distance;
}

/**
 * Calculate ATR-based take profit level for a specific entry price
 *
 * @param entryPrice - Entry price of the position
 * @param atrValue - Current ATR value
 * @param multiplier - ATR multiplier for target distance
 * @param direction - 'long' or 'short'
 * @returns Take profit price
 */
export function calculateAtrTakeProfit(
  entryPrice: number,
  atrValue: number,
  multiplier: number,
  direction: "long" | "short",
): number {
  const distance = atrValue * multiplier;
  return direction === "long" ? entryPrice + distance : entryPrice - distance;
}

/**
 * Calculate ATR-based trailing stop level
 *
 * @param peakPrice - Highest price since entry (for long) or lowest (for short)
 * @param atrValue - Current ATR value
 * @param multiplier - ATR multiplier for trail distance
 * @param direction - 'long' or 'short'
 * @returns Trailing stop price
 */
export function calculateAtrTrailingStop(
  peakPrice: number,
  atrValue: number,
  multiplier: number,
  direction: "long" | "short",
): number {
  const distance = atrValue * multiplier;
  return direction === "long" ? peakPrice - distance : peakPrice + distance;
}
