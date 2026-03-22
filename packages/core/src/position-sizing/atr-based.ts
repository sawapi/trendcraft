/**
 * ATR-Based Position Sizing
 *
 * Calculates position size using Average True Range for volatility-adjusted stops.
 * Formula: Position = (Account * Risk%) / (ATR * Multiplier)
 *
 * Higher volatility = wider stops = smaller position
 * Lower volatility = tighter stops = larger position
 */

import type { AtrBasedSizingOptions, PositionSizeResult } from "../types";
import { applyConstraints, createResult, validateInputs } from "./utils";

/**
 * Calculate stop distance based on ATR and multiplier
 *
 * @param atrValue - Current ATR value
 * @param multiplier - ATR multiplier
 * @returns Stop distance in price units
 *
 * @example
 * ```ts
 * const distance = calculateAtrStopDistance(2.5, 2);
 * // distance = 5
 * ```
 */
export function calculateAtrStopDistance(atrValue: number, multiplier: number): number {
  return atrValue * multiplier;
}

/**
 * Get recommended ATR multiplier based on trading style
 *
 * @param style - Trading style: "conservative", "moderate", or "aggressive"
 * @returns Recommended ATR multiplier
 *
 * @example
 * ```ts
 * const mult = recommendedAtrMultiplier("moderate");
 * // mult = 2.0
 * ```
 */
export function recommendedAtrMultiplier(
  style: "conservative" | "moderate" | "aggressive",
): number {
  switch (style) {
    case "conservative":
      return 3.0; // Wider stops, smaller positions
    case "moderate":
      return 2.0; // Standard
    case "aggressive":
      return 1.5; // Tighter stops, larger positions
    default:
      return 2.0;
  }
}

/**
 * Calculate position size using ATR-based method
 *
 * Uses ATR to set dynamic stop loss distance based on market volatility.
 * This ensures consistent risk across different market conditions.
 *
 * @param options - ATR-based sizing options
 * @returns Position size result
 *
 * @example
 * ```ts
 * // $100,000 account, risk 1%, ATR of $2.50, 2x ATR stop
 * const result = atrBasedSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   riskPercent: 1,
 *   atrValue: 2.5,
 *   atrMultiplier: 2,
 * });
 * // Stop distance = 2.5 * 2 = $5
 * // result.shares = 200 (risking $1000 on $5 stop distance)
 * ```
 */
export function atrBasedSize(options: AtrBasedSizingOptions): PositionSizeResult {
  const {
    accountSize,
    entryPrice,
    riskPercent,
    atrValue,
    atrMultiplier = 2,
    direction = "long",
    minShares = 0,
    maxPositionPercent = 100,
    roundShares = true,
  } = options;

  validateInputs(accountSize, entryPrice, "atrBasedSize");

  if (riskPercent <= 0 || riskPercent > 100) {
    throw new Error("atrBasedSize: riskPercent must be between 0 and 100");
  }

  if (atrValue <= 0) {
    throw new Error("atrBasedSize: atrValue must be positive");
  }

  if (atrMultiplier <= 0) {
    throw new Error("atrBasedSize: atrMultiplier must be positive");
  }

  // Calculate stop distance from ATR
  const stopDistance = atrValue * atrMultiplier;
  const stopLossPrice =
    direction === "long" ? entryPrice - stopDistance : entryPrice + stopDistance;

  // Calculate risk amount in dollars
  const riskAmount = accountSize * (riskPercent / 100);

  // Calculate raw shares: Risk Amount / Stop Distance
  const rawShares = riskAmount / stopDistance;

  // Apply constraints
  const shares = applyConstraints(rawShares, entryPrice, accountSize, {
    minShares,
    maxPositionPercent,
    roundShares,
  });

  // Recalculate actual risk with constrained shares
  const actualRiskAmount = shares * stopDistance;

  return createResult(
    shares,
    entryPrice,
    actualRiskAmount,
    accountSize,
    "atr-based",
    stopLossPrice,
  );
}
