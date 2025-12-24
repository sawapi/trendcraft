/**
 * Signal Scoring Calculator
 *
 * Core engine for calculating composite scores from multiple signals.
 * Combines weighted signals into a normalized 0-100 score.
 */

import type {
  MtfContext,
  NormalizedCandle,
  ScoreBreakdown,
  ScoreResult,
  ScoringConfig,
  SignalContribution,
  SignalDefinition,
} from "../types";

/**
 * Calculate composite score from all signals
 *
 * @param candles - Normalized candle data
 * @param index - Current candle index
 * @param config - Scoring configuration
 * @param context - Optional MTF context
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
    const value = evaluateSignal(signal, candles, index, context);
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
 * @returns Score breakdown with contributions
 */
export function calculateScoreBreakdown(
  candles: NormalizedCandle[],
  index: number,
  config: ScoringConfig,
  context?: MtfContext,
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
    const rawValue = evaluateSignal(signal, candles, index, context);
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
): number {
  try {
    const value = signal.evaluate(candles, index, context);
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

  for (let i = startIndex; i < candles.length; i++) {
    results.push({
      time: candles[i].time,
      score: calculateScore(candles, i, config, context),
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
