/**
 * Scoring Strategy Presets
 *
 * Pre-configured scoring strategies for common trading styles.
 */

import type { ScoringConfig, ScoringPreset } from "../types";
import { ScoreBuilder } from "./builder";

/**
 * Momentum trading preset
 *
 * Focuses on RSI, MACD, and Stochastics for momentum-based entries.
 * Best for swing trading with mean reversion or breakout strategies.
 * @example
 * ```ts
 * import { createMomentumPreset, calculateScore, normalizeCandles } from "trendcraft";
 *
 * const config = createMomentumPreset();
 * const candles = normalizeCandles(rawCandles);
 * const score = calculateScore(candles, candles.length - 1, config);
 * console.log(score.totalScore, score.strength); // e.g. 72, "strong"
 * ```
 */
export function createMomentumPreset(): ScoringConfig {
  return ScoreBuilder.create()
    .addRsiOversold(30, 3.0)
    .addStochOversold(20, 2.0)
    .addStochBullishCross(20, 2.5)
    .addMacdBullish(2.0)
    .addVolumeSpike(1.5, 1.5)
    .setThresholds(70, 50, 30)
    .build();
}

/**
 * Mean reversion preset
 *
 * Focuses on oversold conditions for buying dips.
 * Includes multiple oversold indicators for confirmation.
 * @example
 * ```ts
 * import { createMeanReversionPreset, calculateScore } from "trendcraft";
 *
 * const config = createMeanReversionPreset();
 * const score = calculateScore(candles, candles.length - 1, config);
 * if (score.strength === "strong") console.log("buy signal");
 * ```
 */
export function createMeanReversionPreset(): ScoringConfig {
  return ScoreBuilder.create()
    .addRsiOversold(25, 3.0) // More extreme oversold
    .addRsiOversold(30, 2.0) // Standard oversold
    .addStochOversold(15, 2.5) // Extreme stochastics
    .addStochBullishCross(20, 3.0)
    .addVolumeAnomaly(2, 2.0) // Volume spike on oversold
    .addCmfPositive(0.05, 1.5) // Money flowing in
    .setThresholds(75, 55, 35)
    .build();
}

/**
 * Trend following preset
 *
 * Focuses on Perfect Order and trend confirmation signals.
 * Best for swing trading in established trends.
 * @example
 * ```ts
 * import { createTrendFollowingPreset, calculateScoreSeries } from "trendcraft";
 *
 * const config = createTrendFollowingPreset();
 * const series = calculateScoreSeries(candles, config);
 * const latest = series[series.length - 1];
 * console.log(latest.value.totalScore, latest.value.strength);
 * ```
 */
export function createTrendFollowingPreset(): ScoringConfig {
  return ScoreBuilder.create()
    .addPOConfirmation(3.5)
    .addPerfectOrderBullish(3.0)
    .addPullbackEntry(20, 2.5)
    .addPriceAboveEma(20, 1.5)
    .addGoldenCross(50, 200, 2.0)
    .addBullishVolumeTrend(1.5)
    .addCmfPositive(0.1, 1.5)
    .setThresholds(70, 50, 30)
    .build();
}

/**
 * Balanced preset
 *
 * Combines momentum, trend, and volume signals for a balanced approach.
 * Good general-purpose strategy.
 * @example
 * ```ts
 * import { createBalancedPreset, calculateScore } from "trendcraft";
 *
 * const config = createBalancedPreset();
 * const score = calculateScore(candles, candles.length - 1, config);
 * console.log(score.totalScore); // 0-100
 * ```
 */
export function createBalancedPreset(): ScoringConfig {
  return (
    ScoreBuilder.create()
      // Trend (40%)
      .addPerfectOrderBullish(2.5)
      .addPullbackEntry(20, 2.0)
      .addPriceAboveEma(20, 1.0)
      // Momentum (35%)
      .addRsiOversold(30, 2.0)
      .addMacdBullish(1.5)
      .addStochBullishCross(20, 1.5)
      // Volume (25%)
      .addVolumeSpike(1.5, 1.0)
      .addBullishVolumeTrend(1.0)
      .addCmfPositive(0.1, 1.0)
      .setThresholds(70, 50, 30)
      .build()
  );
}

/**
 * Aggressive preset
 *
 * Lower thresholds for more frequent signals.
 * Higher risk, higher potential reward.
 * @example
 * ```ts
 * import { createAggressivePreset, calculateScore } from "trendcraft";
 *
 * const config = createAggressivePreset();
 * const score = calculateScore(candles, candles.length - 1, config);
 * // Lower thresholds: strong >= 60, moderate >= 40, weak >= 25
 * ```
 */
export function createAggressivePreset(): ScoringConfig {
  return ScoreBuilder.create()
    .addRsiOversold(35, 2.0) // Less strict oversold
    .addStochOversold(25, 1.5)
    .addMacdBullish(2.0)
    .addPerfectOrderBullish(2.0)
    .addVolumeSpike(1.3, 1.5) // Lower volume threshold
    .setThresholds(60, 40, 25) // Lower score thresholds
    .build();
}

/**
 * Conservative preset
 *
 * Higher thresholds and more confirmations required.
 * Lower risk, fewer but higher quality signals.
 * @example
 * ```ts
 * import { createConservativePreset, calculateScore } from "trendcraft";
 *
 * const config = createConservativePreset();
 * const score = calculateScore(candles, candles.length - 1, config);
 * // Higher thresholds: strong >= 80, moderate >= 60, weak >= 40
 * ```
 */
export function createConservativePreset(): ScoringConfig {
  return ScoreBuilder.create()
    .addPOConfirmation(3.0)
    .addPerfectOrderBullish(2.5)
    .addRsiOversold(25, 2.5) // More extreme oversold
    .addStochBullishCross(15, 2.5)
    .addVolumeAnomaly(2.5, 2.0) // Stronger volume confirmation
    .addCmfPositive(0.15, 2.0)
    .setThresholds(80, 60, 40) // Higher thresholds
    .build();
}

/**
 * Get preset configuration by name
 * @example
 * ```ts
 * import { getPreset, calculateScore } from "trendcraft";
 *
 * const config = getPreset("momentum");
 * const score = calculateScore(candles, candles.length - 1, config);
 * ```
 */
export function getPreset(name: ScoringPreset): ScoringConfig {
  switch (name) {
    case "momentum":
      return createMomentumPreset();
    case "meanReversion":
      return createMeanReversionPreset();
    case "trendFollowing":
      return createTrendFollowingPreset();
    case "balanced":
      return createBalancedPreset();
    case "aggressive":
      return createAggressivePreset();
    case "conservative":
      return createConservativePreset();
    default:
      throw new Error(`Unknown preset: ${name}`);
  }
}

/**
 * List all available preset names
 * @example
 * ```ts
 * import { listPresets } from "trendcraft";
 *
 * console.log(listPresets());
 * // ["momentum", "meanReversion", "trendFollowing", "balanced", "aggressive", "conservative"]
 * ```
 */
export function listPresets(): ScoringPreset[] {
  return ["momentum", "meanReversion", "trendFollowing", "balanced", "aggressive", "conservative"];
}
