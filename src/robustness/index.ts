/**
 * Strategy Robustness Score
 *
 * Provides composite robustness grading (A+ to F) for backtest strategies.
 * Evaluates Monte Carlo survival, parameter sensitivity, walk-forward
 * efficiency, and regime consistency.
 */

export { quickRobustnessScore } from "./quick";
export { calculateRobustnessScore } from "./full";
export { scoreToGrade } from "./grade";
