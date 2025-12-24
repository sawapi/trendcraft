/**
 * Scoring Conditions for Backtest
 *
 * Functions that create backtest conditions based on scoring thresholds.
 */

import type { MtfContext, NormalizedCandle, ScoringConfig, ScoringPreset } from "../types";
import { calculateScore } from "./calculator";
import { getPreset } from "./presets";

/**
 * Create a backtest condition that triggers when score is above threshold
 *
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration or preset name
 * @returns Condition function for backtest
 *
 * @example
 * ```ts
 * // With config
 * const config = ScoreBuilder.create()
 *   .addPOConfirmation(3.0)
 *   .addRsiOversold(30, 2.0)
 *   .build();
 *
 * const entry = scoreAbove(70, config);
 *
 * // With preset
 * const entry = scoreAbove(70, "trendFollowing");
 *
 * const result = runBacktest(candles, entry, exit, options);
 * ```
 */
export function scoreAbove(
  threshold: number,
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    const result = calculateScore(candles, index, resolvedConfig, context);
    return result.normalizedScore >= threshold;
  };
}

/**
 * Create a backtest condition that triggers when score is below threshold
 *
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration or preset name
 * @returns Condition function for backtest
 */
export function scoreBelow(
  threshold: number,
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    const result = calculateScore(candles, index, resolvedConfig, context);
    return result.normalizedScore <= threshold;
  };
}

/**
 * Create a condition that triggers when score strength matches
 *
 * @param strength - Required strength level
 * @param config - Scoring configuration or preset name
 */
export function scoreStrength(
  strength: "strong" | "moderate" | "weak",
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    const result = calculateScore(candles, index, resolvedConfig, context);

    switch (strength) {
      case "strong":
        return result.strength === "strong";
      case "moderate":
        return result.strength === "strong" || result.strength === "moderate";
      case "weak":
        return result.strength !== "none";
    }
  };
}

/**
 * Create a condition that requires minimum active signals
 *
 * @param minActive - Minimum number of active signals required
 * @param config - Scoring configuration or preset name
 */
export function minActiveSignals(
  minActive: number,
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    const result = calculateScore(candles, index, resolvedConfig, context);
    return result.activeSignals >= minActive;
  };
}

/**
 * Create a condition that requires score AND minimum active signals
 *
 * @param threshold - Score threshold (0-100)
 * @param minActive - Minimum active signals
 * @param config - Scoring configuration or preset name
 */
export function scoreWithMinSignals(
  threshold: number,
  minActive: number,
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    const result = calculateScore(candles, index, resolvedConfig, context);
    return result.normalizedScore >= threshold && result.activeSignals >= minActive;
  };
}

/**
 * Create a condition that checks score change from previous bar
 *
 * @param minIncrease - Minimum score increase required
 * @param config - Scoring configuration or preset name
 */
export function scoreIncreasing(
  minIncrease: number,
  config: ScoringConfig | ScoringPreset,
): (candles: NormalizedCandle[], index: number, context?: MtfContext) => boolean {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return (candles: NormalizedCandle[], index: number, context?: MtfContext): boolean => {
    if (index < 1) return false;

    const currentResult = calculateScore(candles, index, resolvedConfig, context);
    const prevResult = calculateScore(candles, index - 1, resolvedConfig, context);

    return currentResult.normalizedScore - prevResult.normalizedScore >= minIncrease;
  };
}
