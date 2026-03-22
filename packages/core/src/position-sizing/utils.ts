/**
 * Position Sizing Utility Functions
 */

import type { PositionSizeResult, PositionSizingMethod } from "../types";

/**
 * Apply constraints to calculated position size
 */
export function applyConstraints(
  shares: number,
  entryPrice: number,
  accountSize: number,
  options: {
    minShares?: number;
    maxPositionPercent?: number;
    roundShares?: boolean;
  },
): number {
  const { minShares = 0, maxPositionPercent = 100, roundShares = true } = options;

  // Apply maximum position constraint
  const maxPositionValue = accountSize * (maxPositionPercent / 100);
  const maxShares = maxPositionValue / entryPrice;
  let constrainedShares = Math.min(shares, maxShares);

  // Apply rounding (floor to be conservative)
  if (roundShares) {
    constrainedShares = Math.floor(constrainedShares);
  }

  // Apply minimum shares constraint
  if (constrainedShares < minShares) {
    return 0; // Cannot meet minimum, don't trade
  }

  return Math.max(0, constrainedShares);
}

/**
 * Create a standardized PositionSizeResult
 */
export function createResult(
  shares: number,
  entryPrice: number,
  riskAmount: number,
  accountSize: number,
  method: PositionSizingMethod,
  stopPrice: number | null = null,
): PositionSizeResult {
  const positionValue = shares * entryPrice;
  const riskPercent = accountSize > 0 ? (riskAmount / accountSize) * 100 : 0;

  return {
    shares,
    positionValue,
    riskAmount,
    riskPercent,
    stopPrice,
    method,
  };
}

/**
 * Validate common inputs
 */
export function validateInputs(accountSize: number, entryPrice: number, context: string): void {
  if (accountSize <= 0) {
    throw new Error(`${context}: accountSize must be positive`);
  }
  if (entryPrice <= 0) {
    throw new Error(`${context}: entryPrice must be positive`);
  }
}
