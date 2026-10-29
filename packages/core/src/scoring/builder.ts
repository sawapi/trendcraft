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
  createPerfectOrderBullishEvaluator,
  createPOConfirmationEvaluator,
  createPriceAboveEmaEvaluator,
  createPullbackEntryEvaluator,
  createRsiOverboughtEvaluator,
  createRsiOversoldEvaluator,
  createStochBullishCrossEvaluator,
  createStochOversoldEvaluator,
  createVolumeAnomalyEvaluator,
  createVolumeSpikeEvaluator,
} from "./signals";
import { assertScoreThresholds, assertSignalWeight } from "./validate";

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

  /** Append a signal after checking its weight. */
  private add(signal: SignalDefinition): void {
    assertSignalWeight(`ScoreBuilder signal "${signal.name}" weight`, signal.weight);
    this.signals.push(signal);
  }

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
    assertScoreThresholds("ScoreBuilder.setThresholds", strong, moderate, weak);
    this.strongThreshold = strong;
    this.moderateThreshold = moderate;
    this.weakThreshold = weak;
    return this;
  }

  /**
   * Add a custom signal definition
   */
  addSignal(signal: SignalDefinition): this {
    this.add(signal);
    return this;
  }

  /**
   * Add multiple signals at once
   */
  addSignals(signals: SignalDefinition[]): this {
    for (const signal of signals) this.add(signal);
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
    this.add({
      name: `rsiOversold${threshold}`,
      displayName: `RSI < ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createRsiOversoldEvaluator(threshold, period),
      requiredIndicators: period === 14 ? ["rsi14"] : undefined,
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
    this.add({
      name: `rsiOverbought${threshold}`,
      displayName: `RSI > ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createRsiOverboughtEvaluator(threshold, period),
      requiredIndicators: period === 14 ? ["rsi14"] : undefined,
    });
    return this;
  }

  /**
   * Add MACD bullish crossover signal
   */
  addMacdBullish(weight = 1.5): this {
    this.add({
      name: "macdBullish",
      displayName: "MACD Bullish",
      weight,
      category: "momentum",
      evaluate: createMacdBullishEvaluator(),
      requiredIndicators: ["macd"],
    });
    return this;
  }

  /**
   * Add MACD bearish crossover signal
   */
  addMacdBearish(weight = 1.5): this {
    this.add({
      name: "macdBearish",
      displayName: "MACD Bearish",
      weight,
      category: "momentum",
      evaluate: createMacdBearishEvaluator(),
      requiredIndicators: ["macd"],
    });
    return this;
  }

  /**
   * Add Stochastics oversold signal
   */
  addStochOversold(threshold = 20, weight = 1.5): this {
    this.add({
      name: `stochOversold${threshold}`,
      displayName: `Stoch < ${threshold}`,
      weight,
      category: "momentum",
      evaluate: createStochOversoldEvaluator(threshold),
      requiredIndicators: ["stoch"],
    });
    return this;
  }

  /**
   * Add Stochastics bullish crossover signal
   */
  addStochBullishCross(oversoldThreshold = 20, weight = 2.0): this {
    this.add({
      name: "stochBullishCross",
      displayName: "Stoch Bull Cross",
      weight,
      category: "momentum",
      evaluate: createStochBullishCrossEvaluator(oversoldThreshold),
      requiredIndicators: ["stoch"],
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
    this.add({
      name: "poBullish",
      displayName: "Perfect Order (Bull)",
      weight,
      category: "trend",
      evaluate: createPerfectOrderBullishEvaluator(),
      requiredIndicators: ["perfectOrder"],
    });
    return this;
  }

  /**
   * Add PO+ Confirmation signal
   */
  addPOConfirmation(weight = 3.0): this {
    this.add({
      name: "poConfirmation",
      displayName: "PO+ Confirmation",
      weight,
      category: "trend",
      evaluate: createPOConfirmationEvaluator(),
      requiredIndicators: ["perfectOrderEnhanced"],
    });
    return this;
  }

  /**
   * Add pullback entry signal
   * @param maPeriod - MA period for pullback (default: 20)
   * @param weight - Signal weight (default: 2.0)
   */
  addPullbackEntry(maPeriod = 20, weight = 2.0): this {
    this.add({
      name: `pullback${maPeriod}`,
      displayName: `Pullback to ${maPeriod}MA`,
      weight,
      category: "trend",
      evaluate: createPullbackEntryEvaluator(maPeriod),
      requiredIndicators: ["sma"],
    });
    return this;
  }

  /**
   * Add golden cross signal
   */
  addGoldenCross(shortPeriod = 50, longPeriod = 200, weight = 2.5): this {
    this.add({
      name: "goldenCross",
      displayName: `Golden Cross (${shortPeriod}/${longPeriod})`,
      weight,
      category: "trend",
      evaluate: createGoldenCrossEvaluator(shortPeriod, longPeriod),
      requiredIndicators: ["sma"],
    });
    return this;
  }

  /**
   * Add price above EMA signal
   */
  addPriceAboveEma(period = 20, weight = 1.0): this {
    this.add({
      name: `priceAboveEma${period}`,
      displayName: `Price > EMA${period}`,
      weight,
      category: "trend",
      evaluate: createPriceAboveEmaEvaluator(period),
      requiredIndicators: ["ema"],
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
    this.add({
      name: "volumeSpike",
      displayName: "Volume Spike",
      weight,
      category: "volume",
      evaluate: createVolumeSpikeEvaluator(threshold),
      requiredIndicators: ["volumeMa20"],
    });
    return this;
  }

  /**
   * Add volume anomaly signal
   */
  addVolumeAnomaly(zThreshold = 2, weight = 2.0): this {
    this.add({
      name: "volumeAnomaly",
      displayName: `Volume Anomaly (${zThreshold}σ)`,
      weight,
      category: "volume",
      evaluate: createVolumeAnomalyEvaluator(zThreshold),
      requiredIndicators: ["volumeAnomaly"],
    });
    return this;
  }

  /**
   * Add bullish volume trend signal
   */
  addBullishVolumeTrend(weight = 1.5): this {
    this.add({
      name: "bullishVolumeTrend",
      displayName: "Bullish Volume",
      weight,
      category: "volume",
      evaluate: createBullishVolumeTrendEvaluator(),
      requiredIndicators: ["volumeTrend"],
    });
    return this;
  }

  /**
   * Add CMF positive signal
   */
  addCmfPositive(threshold = 0.1, weight = 1.5): this {
    this.add({
      name: "cmfPositive",
      displayName: `CMF > ${threshold}`,
      weight,
      category: "volume",
      evaluate: createCmfPositiveEvaluator(threshold),
      requiredIndicators: ["cmf20"],
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
