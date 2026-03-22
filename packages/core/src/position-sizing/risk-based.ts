/**
 * Risk-Based Position Sizing
 *
 * Calculates position size based on fixed risk per trade and stop loss distance.
 * Formula: Position = (Account * Risk%) / (Entry - StopLoss)
 *
 * This is the most widely used professional sizing method.
 */

import type { PositionSizeResult, RiskBasedSizingOptions } from "../types";
import { applyConstraints, createResult, validateInputs } from "./utils";

/**
 * Calculate absolute stop distance between entry and stop loss
 *
 * @param entryPrice - Entry price
 * @param stopLossPrice - Stop loss price
 * @returns Absolute distance between prices
 *
 * @example
 * ```ts
 * const distance = calculateStopDistance(50, 48);
 * // distance = 2
 * ```
 */
export function calculateStopDistance(entryPrice: number, stopLossPrice: number): number {
  return Math.abs(entryPrice - stopLossPrice);
}

/**
 * Calculate risk per share given total risk and share count
 *
 * @param totalRisk - Total risk amount in currency
 * @param shares - Number of shares
 * @returns Risk per share
 *
 * @example
 * ```ts
 * const perShare = riskPerShare(1000, 500);
 * // perShare = 2 (each share has $2 at risk)
 * ```
 */
export function riskPerShare(totalRisk: number, shares: number): number {
  if (shares === 0) return 0;
  return totalRisk / shares;
}

/**
 * Calculate position size using risk-based method
 *
 * The classic risk-based sizing approach:
 * 1. Define your risk per trade (e.g., 1-2% of account)
 * 2. Set your stop loss based on technicals
 * 3. Calculate shares that limits loss to your risk amount
 *
 * @param options - Risk-based sizing options
 * @returns Position size result
 *
 * @example
 * ```ts
 * // $100,000 account, risk 1%, entry at $50, stop at $48
 * const result = riskBasedSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   riskPercent: 1,
 *   stopLossPrice: 48,
 * });
 * // result.shares = 500 (risking $1000 on $2 stop distance)
 * ```
 */
export function riskBasedSize(options: RiskBasedSizingOptions): PositionSizeResult {
  const {
    accountSize,
    entryPrice,
    riskPercent,
    stopLossPrice,
    direction = "long",
    minShares = 0,
    maxPositionPercent = 100,
    roundShares = true,
  } = options;

  validateInputs(accountSize, entryPrice, "riskBasedSize");

  if (riskPercent <= 0 || riskPercent > 100) {
    throw new Error("riskBasedSize: riskPercent must be between 0 and 100");
  }

  // Validate stop loss position relative to direction
  if (direction === "long" && stopLossPrice >= entryPrice) {
    throw new Error("riskBasedSize: for long positions, stopLossPrice must be below entryPrice");
  }
  if (direction === "short" && stopLossPrice <= entryPrice) {
    throw new Error("riskBasedSize: for short positions, stopLossPrice must be above entryPrice");
  }

  // Calculate stop distance
  const stopDistance = Math.abs(entryPrice - stopLossPrice);

  if (stopDistance === 0) {
    throw new Error("riskBasedSize: stopLossPrice cannot equal entryPrice");
  }

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
    "risk-based",
    stopLossPrice,
  );
}
