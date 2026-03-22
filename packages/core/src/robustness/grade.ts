/**
 * Robustness grading utility
 *
 * Converts a numeric score (0-100) to a letter grade.
 */

import type { RobustnessGrade } from "../types/robustness";

/**
 * Convert a numeric score (0-100) to a letter grade.
 *
 * @param score Numeric score between 0 and 100
 * @returns Letter grade from A+ to F
 *
 * @example
 * ```ts
 * scoreToGrade(92); // "A+"
 * scoreToGrade(75); // "B+"
 * scoreToGrade(30); // "D"
 * ```
 */
export function scoreToGrade(score: number): RobustnessGrade {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C+";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  return "F";
}
