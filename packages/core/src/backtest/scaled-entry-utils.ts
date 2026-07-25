/**
 * Scaled Entry Backtest - Utility Functions
 *
 * Helper functions for the scaled entry backtest engine:
 * statistics calculation, slippage, and standard backtest delegation.
 */

import type {
  BacktestOptions,
  BacktestResult,
  BacktestSettings,
  Condition,
  NormalizedCandle,
} from "../types";
import type { ExtendedCondition } from "./conditions";
import { runBacktest } from "./engine";
import {
  type BacktestSpanInfo,
  MS_PER_DAY as ENGINE_MS_PER_DAY,
  ZERO_EXTENDED_METRICS,
} from "./engine-utils";

/**
 * Re-export of `engine-utils`'s `MS_PER_DAY` so existing consumers
 * importing from this module still resolve the same constant.
 */
export const MS_PER_DAY = ENGINE_MS_PER_DAY;

/**
 * Standard (non-scaled) backtest - delegates to main engine
 */
export function runStandardBacktest(
  candles: NormalizedCandle[],
  entryCondition: Condition | ExtendedCondition,
  exitCondition: Condition | ExtendedCondition,
  options: BacktestOptions,
): BacktestResult {
  return runBacktest(candles, entryCondition, exitCondition, options);
}

/**
 * Apply slippage to price
 */
export function applySlippage(price: number, slippage: number, direction: "buy" | "sell"): number {
  const slippageMultiplier = slippage / 100;
  if (direction === "buy") {
    return price * (1 + slippageMultiplier);
  }
  return price * (1 - slippageMultiplier);
}

/**
 * Calculate backtest statistics.
 *
 * The scaled-entry path used to carry a copy of this function that had drifted
 * only in its comments; it now shares the engine's implementation so the two
 * paths cannot report differently defined statistics.
 */
export { calculateStats } from "./engine-utils";
/**
 * Re-export of `BacktestSpanInfo` from `engine-utils`. Some host code
 * imported it from this module before the helper was consolidated;
 * keeping the re-export avoids a breaking import-path change.
 */
export type { BacktestSpanInfo };

/**
 * Return empty result for edge cases
 */
export function emptyResult(
  capital: number,
  settings: BacktestSettings,
  span?: BacktestSpanInfo,
): BacktestResult {
  return {
    initialCapital: capital,
    finalCapital: capital,
    totalReturn: 0,
    totalReturnPercent: 0,
    tradeCount: 0,
    winRate: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    ...ZERO_EXTENDED_METRICS,
    firstBarTime: span?.firstTime ?? 0,
    lastBarTime: span?.lastTime ?? 0,
    profitFactor: 0,
    avgHoldingDays: 0,
    trades: [],
    settings,
    drawdownPeriods: [],
  };
}
