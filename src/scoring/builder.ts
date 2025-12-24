/**
 * Score Builder - Fluent API for constructing scoring configurations
 *
 * Provides a chainable API for building complex scoring strategies.
 */

import type { ScoringConfig, SignalDefinition } from "../types";
import {
  createBullishVolumeTrendEvaluator,
  createCmfPositiveEvaluator,
  createGoldenCrossEvaluator,
  createMacdBearishEvaluator,
  createMacdBullishEvaluator,
  createPOConfirmationEvaluator,
  createPerfectOrderBullishEvaluator,
  createPriceAboveEmaEvaluator,
  createPullbackEntryEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOversoldEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
} from "./signals";

/**
 * Fluent builder for creating scoring configurations
 *
 * @example
 * ```ts
 * const config = ScoreBuilder.create()
 *   .addPOConfirmation(3.0)
 *   .addRsiOversold(30, 2.0)
 *   .addVolumeSpike(1.5, 1.5)
 *   .addMacdBullish(1.5)
 *   .build();
 *
 * const result = calculateScore(candles, index, config);
 * ```
 */
export class ScoreBuilder {
  private signals: SignalDefinition[] = [];
  private strongThreshold = 70;
  private moderateThreshold = 50;
  private weakThreshold = 30;

  private constructor() {}

  /**
   * Create a new ScoreBuilder instance
   */
  static create(): ScoreBuilder {
    return new ScoreBuilder();
  }

  /**
   * Set custom thresholds for strength classification
   */
  setThresholds(strong: number, moderate: number, weak: number): this {
    this.strongThreshold = strong;
    this.moderateThreshold = moderate;
    this.weakThreshold = weak;
    return this;
  }

  /**
   * Add a custom signal definition
   */
  addSignal(signal: SignalDefinition): this {
    this.signals.push(signal);
    return this;
  }

  /**
   * Add multiple signals at once
   */
  addSignals(signals: SignalDefinition[]): this {
    this.signals.push(...signals);
    return this;
  }

  // ============================================================================
  // Momentum Signals
  // ============================================================================

  /**
   * Add RSI oversold signal
   * @param threshold - RSI threshold (default: 30)
   * @param weight - Signal weight (default: 2.0)
   * @param period - RSI period (default: 14)
   */
  addRsiOversold(threshold = 30, weight = 2.0, period = 14): this {
    this.signals.push({
      name: `rsiOversold${threshold}`,
      displayName: `RSI < ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createRsiOversoldEvaluator(threshold, period),
    });
    return this;
  }

  /**
   * Add RSI overbought signal
   * @param threshold - RSI threshold (default: 70)
   * @param weight - Signal weight (default: 2.0)
   * @param period - RSI period (default: 14)
   */
  addRsiOverbought(threshold = 70, weight = 2.0, period = 14): this {
    this.signals.push({
      name: `rsiOverbought${threshold}`,
      displayName: `RSI > ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createRsiOverboughtEvaluator(threshold, period),
    });
    return this;
  }

  /**
   * Add MACD bullish crossover signal
   */
  addMacdBullish(weight = 1.5): this {
    this.signals.push({
      name: "macdBullish",
      displayName: "MACD Bullish",
      weight,
      category: "momentum",
      evaluate: createMacdBullishEvaluator(),
    });
    return this;
  }

  /**
   * Add MACD bearish crossover signal
   */
  addMacdBearish(weight = 1.5): this {
    this.signals.push({
      name: "macdBearish",
      displayName: "MACD Bearish",
      weight,
      category: "momentum",
      evaluate: createMacdBearishEvaluator(),
    });
    return this;
  }

  /**
   * Add Stochastics oversold signal
   */
  addStochOversold(threshold = 20, weight = 1.5): this {
    this.signals.push({
      name: `stochOversold${threshold}`,
      displayName: `Stoch < ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createStochOversoldEvaluator(threshold),
    });
    return this;
  }

  /**
   * Add Stochastics bullish crossover signal
   */
  addStochBullishCross(oversoldThreshold = 20, weight = 2.0): this {
    this.signals.push({
      name: "stochBullishCross",
      displayName: "Stoch Bull Cross",
      weight,
      category: "momentum",
      evaluate: createStochBullishCrossEvaluator(oversoldThreshold),
    });
    return this;
  }

  // ============================================================================
  // Trend Signals
  // ============================================================================

  /**
   * Add Perfect Order bullish signal
   */
  addPerfectOrderBullish(weight = 3.0): this {
    this.signals.push({
      name: "poBullish",
      displayName: "Perfect Order (Bull)",
      weight,
      category: "trend",
      evaluate: createPerfectOrderBullishEvaluator(),
    });
    return this;
  }

  /**
   * Add PO+ Confirmation signal
   */
  addPOConfirmation(weight = 3.0): this {
    this.signals.push({
      name: "poConfirmation",
      displayName: "PO+ Confirmation",
      weight,
      category: "trend",
      evaluate: createPOConfirmationEvaluator(),
    });
    return this;
  }

  /**
   * Add pullback entry signal
   * @param maPeriod - MA period for pullback (default: 20)
   * @param weight - Signal weight (default: 2.0)
   */
  addPullbackEntry(maPeriod = 20, weight = 2.0): this {
    this.signals.push({
      name: `pullback${maPeriod}`,
      displayName: `Pullback to ${maPeriod}MA`,
      weight,
      category: "trend",
      evaluate: createPullbackEntryEvaluator(maPeriod),
    });
    return this;
  }

  /**
   * Add golden cross signal
   */
  addGoldenCross(shortPeriod = 50, longPeriod = 200, weight = 2.5): this {
    this.signals.push({
      name: "goldenCross",
      displayName: `Golden Cross (${shortPeriod}/${longPeriod})`,
      weight,
      category: "trend",
      evaluate: createGoldenCrossEvaluator(shortPeriod, longPeriod),
    });
    return this;
  }

  /**
   * Add price above EMA signal
   */
  addPriceAboveEma(period = 20, weight = 1.0): this {
    this.signals.push({
      name: `priceAboveEma${period}`,
      displayName: `Price > EMA${period}`,
      weight,
      category: "trend",
      evaluate: createPriceAboveEmaEvaluator(period),
    });
    return this;
  }

  // ============================================================================
  // Volume Signals
  // ============================================================================

  /**
   * Add volume spike signal
   */
  addVolumeSpike(threshold = 1.5, weight = 1.5): this {
    this.signals.push({
      name: "volumeSpike",
      displayName: "Volume Spike",
      weight,
      category: "volume",
      evaluate: createVolumeSpikeEvaluator(threshold),
    });
    return this;
  }

  /**
   * Add volume anomaly signal
   */
  addVolumeAnomaly(zThreshold = 2, weight = 2.0): this {
    this.signals.push({
      name: "volumeAnomaly",
      displayName: `Volume Anomaly (${zThreshold}σ)`,
      weight,
      category: "volume",
      evaluate: createVolumeAnomalyEvaluator(zThreshold),
    });
    return this;
  }

  /**
   * Add bullish volume trend signal
   */
  addBullishVolumeTrend(weight = 1.5): this {
    this.signals.push({
      name: "bullishVolumeTrend",
      displayName: "Bullish Volume",
      weight,
      category: "volume",
      evaluate: createBullishVolumeTrendEvaluator(),
    });
    return this;
  }

  /**
   * Add CMF positive signal
   */
  addCmfPositive(threshold = 0.1, weight = 1.5): this {
    this.signals.push({
      name: "cmfPositive",
      displayName: `CMF > ${threshold}`,
      weight,
      category: "volume",
      evaluate: createCmfPositiveEvaluator(threshold),
    });
    return this;
  }

  // ============================================================================
  // Build
  // ============================================================================

  /**
   * Build the final scoring configuration
   */
  build(): ScoringConfig {
    return {
      signals: [...this.signals],
      strongThreshold: this.strongThreshold,
      moderateThreshold: this.moderateThreshold,
      weakThreshold: this.weakThreshold,
    };
  }

  /**
   * Get the current signal count
   */
  get signalCount(): number {
    return this.signals.length;
  }

  /**
   * Get the maximum possible score
   */
  get maxScore(): number {
    return this.signals.reduce((sum, s) => sum + s.weight, 0);
  }
}
