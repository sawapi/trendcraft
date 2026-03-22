/**
 * Signal Scoring Module
 *
 * Provides a composite signal scoring system for evaluating trade setups.
 *
 * Features:
 * - Weighted signal aggregation
 * - Pre-built signal evaluators (momentum, trend, volume)
 * - Fluent API for building custom scoring strategies
 * - Strategy presets for common trading styles
 * - Backtest conditions based on scores
 *
 * @example
 * ```ts
 * import {
 *   ScoreBuilder,
 *   calculateScore,
 *   calculateScoreBreakdown,
 *   scoreAbove,
 *   getPreset,
 * } from 'trendcraft';
 *
 * // Build a custom scoring config
 * const config = ScoreBuilder.create()
 *   .addPOConfirmation(3.0)
 *   .addRsiOversold(30, 2.0)
 *   .addVolumeSpike(1.5, 1.5)
 *   .addMacdBullish(1.5)
 *   .build();
 *
 * // Calculate score
 * const score = calculateScore(candles, candles.length - 1, config);
 * console.log(`Score: ${score.normalizedScore}/100 (${score.strength})`);
 *
 * // Get detailed breakdown
 * const breakdown = calculateScoreBreakdown(candles, candles.length - 1, config);
 * for (const c of breakdown.contributions) {
 *   if (c.isActive) {
 *     console.log(`  ${c.displayName}: +${c.score.toFixed(1)}`);
 *   }
 * }
 *
 * // Use in backtest
 * const entry = scoreAbove(70, config);
 * const result = runBacktest(candles, entry, exit, { capital: 100000 });
 *
 * // Or use a preset
 * const result2 = runBacktest(candles, scoreAbove(70, "trendFollowing"), exit);
 * ```
 */

// Calculator
export {
  calculateScore,
  calculateScoreBreakdown,
  calculateScoreSeries,
  isScoreAbove,
  isScoreBelow,
} from "./calculator";

// Builder
export { ScoreBuilder } from "./builder";

// Presets
export {
  getPreset,
  listPresets,
  createMomentumPreset,
  createMeanReversionPreset,
  createTrendFollowingPreset,
  createBalancedPreset,
  createAggressivePreset,
  createConservativePreset,
} from "./presets";

// Backtest conditions
export {
  scoreAbove,
  scoreBelow,
  scoreStrength,
  minActiveSignals,
  scoreWithMinSignals,
  scoreIncreasing,
} from "./conditions";

// Signal evaluators
export * from "./signals";
