/**
 * Signal Scoring Calculator
 *
 * Core engine for calculating composite scores from multiple signals.
 * Combines weighted signals into a normalized 0-100 score.
 */

import {
  cmf,
  ema,
  macd,
  rsi,
  sma,
  stochastics,
  volumeAnomaly,
  volumeMa,
  volumeTrend,
} from "../indicators";
import { perfectOrder, perfectOrderEnhanced } from "../signals";
import type {
  MtfContext,
  NormalizedCandle,
  PrecomputedIndicators,
  ScoreBreakdown,
  ScoreResult,
  ScoringConfig,
  SignalContribution,
  SignalDefinition,
} from "../types";

/**
 * Pre-compute all required indicators for the scoring configuration
 * This runs once per series instead of once per bar, reducing O(n²) to O(n)
 */
function precomputeIndicators(
  candles: NormalizedCandle[],
  config: ScoringConfig,
): PrecomputedIndicators {
  const required = new Set<keyof PrecomputedIndicators>();

  // Collect all required indicators from signals
  for (const signal of config.signals) {
    if (signal.requiredIndicators) {
      for (const ind of signal.requiredIndicators) {
        required.add(ind);
      }
    }
  }

  const result: PrecomputedIndicators = {};

  if (required.has("rsi14")) {
    const series = rsi(candles, { period: 14 });
    result.rsi14 = series.map((s) => s.value);
  }

  if (required.has("macd")) {
    const series = macd(candles, { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    result.macd = series.map((s) => s.value);
  }

  if (required.has("stoch")) {
    const series = stochastics(candles, { kPeriod: 14, dPeriod: 3 });
    result.stoch = series.map((s) => s.value);
  }

  if (required.has("sma")) {
    // Pre-compute common SMA periods used in evaluators
    const periods = [5, 20, 50, 60, 200];
    result.sma = new Map();
    for (const period of periods) {
      const series = sma(candles, { period });
      result.sma.set(
        period,
        series.map((s) => s.value),
      );
    }
  }

  if (required.has("ema")) {
    // Pre-compute common EMA periods
    const periods = [20];
    result.ema = new Map();
    for (const period of periods) {
      const series = ema(candles, { period });
      result.ema.set(
        period,
        series.map((s) => s.value),
      );
    }
  }

  if (required.has("volumeMa20")) {
    const series = volumeMa(candles, { period: 20 });
    result.volumeMa20 = series.map((s) => s.value);
  }

  if (required.has("volumeAnomaly")) {
    const series = volumeAnomaly(candles, { period: 20, zScoreThreshold: 2 });
    result.volumeAnomaly = series.map((s) => ({
      ratio: s.value.ratio,
      level: s.value.level ?? "normal",
      isAnomaly: s.value.isAnomaly,
      zScore: s.value.zScore,
    }));
  }

  if (required.has("volumeTrend")) {
    const series = volumeTrend(candles, { maPeriod: 20 });
    result.volumeTrend = series.map((s) => ({
      isConfirmed: s.value.isConfirmed,
      priceTrend: s.value.priceTrend,
      volumeTrend: s.value.volumeTrend,
      confidence: s.value.confidence,
      hasDivergence: s.value.hasDivergence,
    }));
  }

  if (required.has("cmf20")) {
    const series = cmf(candles, { period: 20 });
    result.cmf20 = series.map((s) => s.value);
  }

  if (required.has("perfectOrder")) {
    const series = perfectOrder(candles, { periods: [5, 20, 60] });
    result.perfectOrder = series.map((s) => ({
      type: s.value.type,
      strength: s.value.strength,
    }));
  }

  if (required.has("perfectOrderEnhanced")) {
    const series = perfectOrderEnhanced(candles, {
      periods: [5, 20, 60],
      enhanced: true,
      slopeLookback: 3,
    });
    result.perfectOrderEnhanced = series.map((s) => ({
      state: s.value.state,
      isConfirmed: s.value.isConfirmed,
      confirmationFormed: s.value.confirmationFormed ?? false,
    }));
  }

  return result;
}

/**
 * Calculate composite score from all signals
 *
 * @param candles - Normalized candle data
 * @param index - Current candle index
 * @param config - Scoring configuration
 * @param context - Optional MTF context
 * @param precomputed - Optional pre-computed indicator data for performance
 * @returns Score result
 *
 * @example
 * ```ts
 * const config: ScoringConfig = {
 *   signals: [
 *     { name: "rsi", displayName: "RSI Oversold", weight: 2, evaluate: rsiOversoldEvaluator },
 *     { name: "macd", displayName: "MACD Bullish", weight: 1.5, evaluate: macdBullishEvaluator },
 *   ],
 * };
 *
 * const result = calculateScore(candles, candles.length - 1, config);
 * console.log(`Score: ${result.normalizedScore}/100 (${result.strength})`);
 * ```
 */
export function calculateScore(
  candles: NormalizedCandle[],
  index: number,
  config: ScoringConfig,
  context?: MtfContext,
  precomputed?: PrecomputedIndicators,
): ScoreResult {
  const { signals } = config;
  const strongThreshold = config.strongThreshold ?? 70;
  const moderateThreshold = config.moderateThreshold ?? 50;
  const weakThreshold = config.weakThreshold ?? 30;

  if (signals.length === 0) {
    return {
      rawScore: 0,
      normalizedScore: 0,
      maxScore: 0,
      strength: "none",
      activeSignals: 0,
      totalSignals: 0,
    };
  }

  let rawScore = 0;
  let maxScore = 0;
  let activeSignals = 0;

  for (const signal of signals) {
    const value = evaluateSignal(signal, candles, index, context, precomputed);
    const weightedScore = value * signal.weight;

    rawScore += weightedScore;
    maxScore += signal.weight;

    if (value > 0) {
      activeSignals++;
    }
  }

  const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;

  const strength = getStrength(normalizedScore, strongThreshold, moderateThreshold, weakThreshold);

  return {
    rawScore,
    normalizedScore,
    maxScore,
    strength,
    activeSignals,
    totalSignals: signals.length,
  };
}

/**
 * Calculate score with detailed breakdown of each signal's contribution
 *
 * @param candles - Normalized candle data
 * @param index - Current candle index
 * @param config - Scoring configuration
 * @param context - Optional MTF context
 * @param precomputed - Optional pre-computed indicator data for performance
 * @returns Score breakdown with contributions
 */
export function calculateScoreBreakdown(
  candles: NormalizedCandle[],
  index: number,
  config: ScoringConfig,
  context?: MtfContext,
  precomputed?: PrecomputedIndicators,
): ScoreBreakdown {
  const { signals } = config;
  const strongThreshold = config.strongThreshold ?? 70;
  const moderateThreshold = config.moderateThreshold ?? 50;
  const weakThreshold = config.weakThreshold ?? 30;

  const contributions: SignalContribution[] = [];
  let rawScore = 0;
  let maxScore = 0;
  let activeSignals = 0;

  for (const signal of signals) {
    const rawValue = evaluateSignal(signal, candles, index, context, precomputed);
    const weightedScore = rawValue * signal.weight;

    contributions.push({
      name: signal.name,
      displayName: signal.displayName,
      rawValue,
      score: weightedScore,
      weight: signal.weight,
      isActive: rawValue > 0,
      category: signal.category,
    });

    rawScore += weightedScore;
    maxScore += signal.weight;

    if (rawValue > 0) {
      activeSignals++;
    }
  }

  const normalizedScore = maxScore > 0 ? (rawScore / maxScore) * 100 : 0;
  const strength = getStrength(normalizedScore, strongThreshold, moderateThreshold, weakThreshold);

  return {
    rawScore,
    normalizedScore,
    maxScore,
    strength,
    activeSignals,
    totalSignals: signals.length,
    contributions,
  };
}

/**
 * Safely evaluate a signal, catching any errors
 */
function evaluateSignal(
  signal: SignalDefinition,
  candles: NormalizedCandle[],
  index: number,
  context?: MtfContext,
  precomputed?: PrecomputedIndicators,
): number {
  try {
    const value = signal.evaluate(candles, index, context, precomputed);
    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, value));
  } catch {
    // If evaluation fails, return 0
    return 0;
  }
}

/**
 * Determine signal strength from normalized score
 */
function getStrength(
  score: number,
  strongThreshold: number,
  moderateThreshold: number,
  weakThreshold: number,
): ScoreResult["strength"] {
  if (score >= strongThreshold) return "strong";
  if (score >= moderateThreshold) return "moderate";
  if (score >= weakThreshold) return "weak";
  return "none";
}

/**
 * Calculate scores for a series of candles
 *
 * Useful for backtesting or charting score over time.
 * Uses pre-computed indicators for O(n) performance instead of O(n²).
 *
 * @param candles - Normalized candle data
 * @param config - Scoring configuration
 * @param startIndex - Start index (default: 0)
 * @param context - Optional MTF context
 * @returns Array of score results with timestamps
 */
export function calculateScoreSeries(
  candles: NormalizedCandle[],
  config: ScoringConfig,
  startIndex = 0,
  context?: MtfContext,
): Array<{ time: number; score: ScoreResult }> {
  const results: Array<{ time: number; score: ScoreResult }> = [];

  // Pre-compute all required indicators once (O(n))
  const precomputed = precomputeIndicators(candles, config);

  for (let i = startIndex; i < candles.length; i++) {
    results.push({
      time: candles[i].time,
      score: calculateScore(candles, i, config, context, precomputed),
    });
  }

  return results;
}

/**
 * Check if score is above a threshold
 *
 * Convenience function for creating backtest conditions.
 *
 * @param candles - Normalized candle data
 * @param index - Current candle index
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration
 * @param context - Optional MTF context
 * @returns Whether score is above threshold
 */
export function isScoreAbove(
  candles: NormalizedCandle[],
  index: number,
  threshold: number,
  config: ScoringConfig,
  context?: MtfContext,
): boolean {
  const result = calculateScore(candles, index, config, context);
  return result.normalizedScore >= threshold;
}

/**
 * Check if score is below a threshold
 *
 * @param candles - Normalized candle data
 * @param index - Current candle index
 * @param threshold - Score threshold (0-100)
 * @param config - Scoring configuration
 * @param context - Optional MTF context
 * @returns Whether score is below threshold
 */
export function isScoreBelow(
  candles: NormalizedCandle[],
  index: number,
  threshold: number,
  config: ScoringConfig,
  context?: MtfContext,
): boolean {
  const result = calculateScore(candles, index, config, context);
  return result.normalizedScore <= threshold;
}
