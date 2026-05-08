/**
 * Position Sizing Module
 *
 * Provides various position sizing methods for risk management.
 *
 * Available methods:
 * 1. Risk-Based: Size based on risk amount and stop distance
 * 2. ATR-Based: Size based on ATR volatility measure
 * 3. Kelly Criterion: Optimal sizing based on win rate and payoff ratio
 * 4. Fixed Fractional: Simple percentage of account
 *
 * @example
 * ```ts
 * import { riskBasedSize, atrBasedSize, kellySize, fixedFractionalSize } from 'trendcraft';
 *
 * // Risk-based (recommended for active traders)
 * const riskResult = riskBasedSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   stopLossPrice: 48,
 *   riskPercent: 1,
 * });
 *
 * // ATR-based (volatility-adjusted)
 * const atrResult = atrBasedSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   atrValue: 2.5,
 *   atrMultiplier: 2,
 *   riskPercent: 1,
 * });
 *
 * // Kelly (for systematic strategies with known statistics)
 * const kellyResult = kellySize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   winRate: 0.6,
 *   winLossRatio: 1.5,
 *   kellyFraction: 0.5,
 * });
 *
 * // Fixed fractional (simple allocation)
 * const fixedResult = fixedFractionalSize({
 *   accountSize: 100000,
 *   entryPrice: 50,
 *   fractionPercent: 10,
 * });
 * ```
 */

// ATR-based sizing
export { atrBasedSize, calculateAtrStopDistance, recommendedAtrMultiplier } from "./atr-based";
// Fixed fractional
export { fixedFractionalSize, fractionForPositionCount, maxPositions } from "./fixed-fractional";

// Kelly criterion
export { calculateKellyPercent, kellySize } from "./kelly";
// Risk-based sizing
export { calculateStopDistance, riskBasedSize, riskPerShare } from "./risk-based";

// Utilities
export { applyConstraints, createResult, validateInputs } from "./utils";
