/**
 * Kelly Criterion Position Sizing
 *
 * Calculates optimal bet size based on historical win rate and payoff ratio.
 * Formula: Kelly% = W - (1-W)/R
 * Where: W = Win rate, R = Win/Loss ratio
 *
 * In practice, traders typically use "fractional Kelly" (e.g., half-Kelly)
 * to reduce volatility while still capturing most of the growth.
 */

import type { KellySizingOptions, PositionSizeResult } from "../types";
import { applyConstraints, createResult, validateInputs } from "./utils";

/**
 * Calculate the Kelly percentage
 *
 * @param winRate - Historical win rate (0-1)
 * @param winLossRatio - Average win / Average loss
 * @returns Kelly percentage (0-100)
 *
 * @example
 * ```ts
 * // 60% win rate, wins are 1.5x losses
 * const kelly = calculateKellyPercent(0.6, 1.5);
 * // kelly = 33.33% (0.6 - 0.4/1.5)
 * ```
 */
export function calculateKellyPercent(winRate: number, winLossRatio: number): number {
  if (winRate < 0 || winRate > 1) {
    throw new Error("calculateKellyPercent: winRate must be between 0 and 1");
  }

  if (winLossRatio <= 0) {
    throw new Error("calculateKellyPercent: winLossRatio must be positive");
  }

  // Kelly formula: f* = W - (1-W)/R
  const kelly = winRate - (1 - winRate) / winLossRatio;

  // Convert to percentage and clamp to valid range
  return Math.max(0, kelly * 100);
}

/**
 * Calculate position size using Kelly Criterion
 *
 * Kelly gives the theoretically optimal bet size for maximum growth.
 * However, full Kelly can be very aggressive with high volatility.
 *
 * Recommended usage:
 * - Half-Kelly (kellyFraction: 0.5): Most common, good balance
 * - Quarter-Kelly (kellyFraction: 0.25): Conservative, for uncertain stats
 *
 * @param options - Kelly sizing options
 * @returns Position size result
 *
 * @example
 * ```ts
 * // $100,000 account, 60% win rate, 1.5 win/loss ratio
 * const result = kellySize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   winRate: 0.6,
 *   winLossRatio: 1.5,
 *   kellyFraction: 0.5, // Half-Kelly for safety
 * });
 * // Full Kelly = 60% - 40%/1.5 = 33.3%
 * // Half Kelly = 16.7%
 * // result.shares = 333 ($16,700 position)
 * ```
 */
export function kellySize(options: KellySizingOptions): PositionSizeResult {
  const {
    accountSize,
    entryPrice,
    winRate,
    winLossRatio,
    kellyFraction = 0.5,
    maxKellyPercent = 25,
    minShares = 0,
    maxPositionPercent = 100,
    roundShares = true,
  } = options;

  validateInputs(accountSize, entryPrice, "kellySize");

  if (winRate < 0 || winRate > 1) {
    throw new Error("kellySize: winRate must be between 0 and 1");
  }

  if (winLossRatio <= 0) {
    throw new Error("kellySize: winLossRatio must be positive");
  }

  if (kellyFraction <= 0 || kellyFraction > 1) {
    throw new Error("kellySize: kellyFraction must be between 0 and 1");
  }

  // Calculate full Kelly percentage
  const fullKelly = calculateKellyPercent(winRate, winLossRatio);

  // Apply Kelly fraction and cap
  let kellyPercent = fullKelly * kellyFraction;
  kellyPercent = Math.min(kellyPercent, maxKellyPercent);

  // If Kelly is 0 or negative, don't trade
  if (kellyPercent <= 0) {
    return createResult(0, entryPrice, 0, accountSize, "kelly", null);
  }

  // Calculate position value
  const positionValue = accountSize * (kellyPercent / 100);

  // Calculate raw shares
  const rawShares = positionValue / entryPrice;

  // Apply constraints (use kellyPercent as effective max if lower)
  const effectiveMaxPercent = Math.min(maxPositionPercent, kellyPercent);
  const shares = applyConstraints(rawShares, entryPrice, accountSize, {
    minShares,
    maxPositionPercent: effectiveMaxPercent,
    roundShares,
  });

  // For Kelly, risk amount is the position value (theoretical max loss)
  const actualPositionValue = shares * entryPrice;

  return createResult(shares, entryPrice, actualPositionValue, accountSize, "kelly", null);
}
