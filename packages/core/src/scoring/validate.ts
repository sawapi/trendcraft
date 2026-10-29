/**
 * Scoring Configuration Validation
 *
 * Checks shared by the score calculator, `ScoreBuilder` and the score
 * conditions, so a bad weight or threshold is rejected the same way wherever
 * it enters.
 */

import type { ScoringConfig } from "../types";
import { assertInRange, assertNonNegative } from "../utils/validate-number";

/**
 * Assert that a signal weight is a finite number no smaller than zero.
 *
 * The score is `Σ value × weight / Σ weight`. A negative weight flipped the
 * signal's direction, and `NaN` turned every score into `NaN`. Zero is kept:
 * it switches a signal off without removing it.
 *
 * @param label - Human-readable name, used verbatim in the message
 * @param weight - The weight to check
 * @throws Error if `weight` is not finite or is negative
 */
export function assertSignalWeight(label: string, weight: number): void {
  assertNonNegative(label, weight);
}

/**
 * Assert that the strength thresholds lie in [0, 100] and are ordered
 * `strong >= moderate >= weak`.
 *
 * The strength label is the first threshold the score reaches, checked from
 * strong down, so out-of-order thresholds made a band unreachable.
 *
 * @param label - Human-readable name, used verbatim in the message
 * @throws Error if a threshold is outside [0, 100] or they are out of order
 */
export function assertScoreThresholds(
  label: string,
  strong: number,
  moderate: number,
  weak: number,
): void {
  assertInRange(`${label} strongThreshold`, strong, 0, 100);
  assertInRange(`${label} moderateThreshold`, moderate, 0, 100);
  assertInRange(`${label} weakThreshold`, weak, 0, 100);
  if (!(strong >= moderate && moderate >= weak)) {
    throw new Error(
      `${label} thresholds must satisfy strongThreshold >= moderateThreshold >= weakThreshold`,
    );
  }
}

/**
 * Assert that every signal weight and the strength thresholds of a scoring
 * configuration are valid.
 *
 * @param label - Function name, used verbatim in the message
 * @param config - The scoring configuration
 * @throws Error naming the first invalid weight or threshold
 */
export function assertScoringConfig(label: string, config: ScoringConfig): void {
  config.signals.forEach((signal, i) => {
    assertSignalWeight(`${label} signals[${i}] ("${signal.name}") weight`, signal.weight);
  });
  assertScoreThresholds(
    label,
    config.strongThreshold ?? 70,
    config.moderateThreshold ?? 50,
    config.weakThreshold ?? 30,
  );
}
