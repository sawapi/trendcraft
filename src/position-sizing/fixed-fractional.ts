/**
 * Fixed Fractional Position Sizing
 *
 * The simplest position sizing method - always invest a fixed percentage
 * of the account, regardless of risk parameters.
 *
 * Pros:
 * - Simple and consistent
 * - Easy to understand and implement
 * - Works well for long-term investors
 *
 * Cons:
 * - Doesn't account for trade-specific risk
 * - May over/under-size positions relative to stop distance
 * - Not optimal for active traders
 *
 * Best for: Long-term investors, portfolio allocation, simple strategies
 */

import type { FixedFractionalOptions, PositionSizeResult } from "../types";
import { applyConstraints, createResult, validateInputs } from "./utils";

/**
 * Calculate position size using fixed fractional method
 *
 * Always allocates the same percentage of account to each position.
 * This is the simplest method but doesn't optimize for risk.
 *
 * @param options - Fixed fractional sizing options
 * @returns Position size result
 *
 * @example
 * ```ts
 * // Always invest 10% of account per position
 * const result = fixedFractionalSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   fractionPercent: 10,
 * });
 * // result.shares = 200 ($10,000 position at $50/share)
 * // result.positionValue = 10000
 * ```
 *
 * @example
 * ```ts
 * // With maximum position constraint
 * const result = fixedFractionalSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   fractionPercent: 30,
 *   maxPositionPercent: 20, // Cap at 20%
 * });
 * // result.shares = 400 ($20,000 position, capped from $30,000)
 * ```
 */
export function fixedFractionalSize(options: FixedFractionalOptions): PositionSizeResult {
  const {
    accountSize,
    entryPrice,
    fractionPercent,
    minShares = 0,
    maxPositionPercent = 100,
    roundShares = true,
  } = options;

  validateInputs(accountSize, entryPrice, "fixedFractionalSize");

  if (fractionPercent <= 0 || fractionPercent > 100) {
    throw new Error("fixedFractionalSize: fractionPercent must be between 0 and 100");
  }

  // Calculate position value
  const positionValue = accountSize * (fractionPercent / 100);

  // Calculate raw shares
  const rawShares = positionValue / entryPrice;

  // Apply constraints
  const shares = applyConstraints(rawShares, entryPrice, accountSize, {
    minShares,
    maxPositionPercent,
    roundShares,
  });

  // For fixed fractional, risk amount equals position value (theoretical max loss)
  const actualPositionValue = shares * entryPrice;

  return createResult(
    shares,
    entryPrice,
    actualPositionValue,
    accountSize,
    "fixed-fractional",
    null,
  );
}

/**
 * Calculate the number of equal-sized positions that fit in an account
 *
 * Useful for portfolio allocation and diversification planning.
 *
 * @param accountSize - Total account value
 * @param fractionPercent - Percentage per position
 * @returns Number of positions that fit
 *
 * @example
 * ```ts
 * const positions = maxPositions(100000, 10);
 * // positions = 10 (can have 10 positions at 10% each)
 * ```
 */
export function maxPositions(accountSize: number, fractionPercent: number): number {
  if (accountSize <= 0 || fractionPercent <= 0) {
    return 0;
  }

  return Math.floor(100 / fractionPercent);
}

/**
 * Calculate fraction percent needed for a target number of positions
 *
 * @param targetPositions - Desired number of equal positions
 * @returns Fraction percent per position
 *
 * @example
 * ```ts
 * const fraction = fractionForPositionCount(5);
 * // fraction = 20 (20% per position for 5 equal positions)
 * ```
 */
export function fractionForPositionCount(targetPositions: number): number {
  if (targetPositions <= 0) {
    throw new Error("fractionForPositionCount: targetPositions must be positive");
  }

  return 100 / targetPositions;
}
