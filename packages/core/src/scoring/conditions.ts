/**
 * Scoring Conditions for Backtest
 *
 * Factories that create backtest `PresetCondition`s based on scoring thresholds.
 * The returned objects plug directly into `runBacktest` / `.entry()` / `.exit()`
 * and combinators like `and()` / `or()` / `not()`.
 *
 * Note: scores are computed from the backtest candles only. For MTF-aware
 * scoring, call `calculateScore(candles, index, config, mtfContext)` directly.
 */

import type { PresetCondition, ScoringConfig, ScoringPreset } from "../types";
import { calculateScore } from "./calculator";
import { getPreset } from "./presets";

/**
 * Create a backtest condition that triggers when score is above threshold
 *
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
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
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `scoreAbove(${threshold})`,
    evaluate: (_indicators, _candle, index, candles) => {
      const result = calculateScore(candles, index, resolvedConfig);
      return result.normalizedScore >= threshold;
    },
  };
}

/**
 * Create a backtest condition that triggers when score is below threshold
 *
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
 */
export function scoreBelow(
  threshold: number,
  config: ScoringConfig | ScoringPreset,
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `scoreBelow(${threshold})`,
    evaluate: (_indicators, _candle, index, candles) => {
      const result = calculateScore(candles, index, resolvedConfig);
      return result.normalizedScore <= threshold;
    },
  };
}

/**
 * Create a condition that triggers when score strength matches
 *
 * @param strength - Required strength level
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
 */
export function scoreStrength(
  strength: "strong" | "moderate" | "weak",
  config: ScoringConfig | ScoringPreset,
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `scoreStrength(${strength})`,
    evaluate: (_indicators, _candle, index, candles) => {
      const result = calculateScore(candles, index, resolvedConfig);

      switch (strength) {
        case "strong":
          return result.strength === "strong";
        case "moderate":
          return result.strength === "strong" || result.strength === "moderate";
        case "weak":
          return result.strength !== "none";
      }
    },
  };
}

/**
 * Create a condition that requires minimum active signals
 *
 * @param minActive - Minimum number of active signals required
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
 */
export function minActiveSignals(
  minActive: number,
  config: ScoringConfig | ScoringPreset,
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `minActiveSignals(${minActive})`,
    evaluate: (_indicators, _candle, index, candles) => {
      const result = calculateScore(candles, index, resolvedConfig);
      return result.activeSignals >= minActive;
    },
  };
}

/**
 * Create a condition that requires score AND minimum active signals
 *
 * @param threshold - Score threshold (0-100)
 * @param minActive - Minimum active signals
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
 */
export function scoreWithMinSignals(
  threshold: number,
  minActive: number,
  config: ScoringConfig | ScoringPreset,
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `scoreWithMinSignals(${threshold}, ${minActive})`,
    evaluate: (_indicators, _candle, index, candles) => {
      const result = calculateScore(candles, index, resolvedConfig);
      return result.normalizedScore >= threshold && result.activeSignals >= minActive;
    },
  };
}

/**
 * Create a condition that checks score change from previous bar
 *
 * @param minIncrease - Minimum score increase required
 * @param config - Scoring configuration or preset name
 * @returns Preset condition for backtest
 */
export function scoreIncreasing(
  minIncrease: number,
  config: ScoringConfig | ScoringPreset,
): PresetCondition {
  const resolvedConfig = typeof config === "string" ? getPreset(config) : config;

  return {
    type: "preset",
    name: `scoreIncreasing(${minIncrease})`,
    evaluate: (_indicators, _candle, index, candles) => {
      if (index < 1) return false;

      const currentResult = calculateScore(candles, index, resolvedConfig);
      const prevResult = calculateScore(candles, index - 1, resolvedConfig);

      return currentResult.normalizedScore - prevResult.normalizedScore >= minIncrease;
    },
  };
}
