/**
 * Strategy Robustness Score types
 */

/** Individual robustness dimension score */
export type DimensionScore = {
  /** Dimension name */
  name: string;
  /** Score 0-100 */
  score: number;
  /** Weight in composite (0-1) */
  weight: number;
  /** Human-readable description */
  detail: string;
};

/** Robustness grade */
export type RobustnessGrade = "A+" | "A" | "B+" | "B" | "C+" | "C" | "D" | "F";

/** Full robustness score result */
export type RobustnessResult = {
  /** Composite score 0-100 */
  compositeScore: number;
  /** Letter grade */
  grade: RobustnessGrade;
  /** Individual dimension scores */
  dimensions: {
    monteCarlo: DimensionScore;
    parameterSensitivity: DimensionScore;
    walkForward: DimensionScore;
    regimeConsistency: DimensionScore;
  };
  /** Overall assessment */
  assessment: string;
  /** Specific recommendations for improvement */
  recommendations: string[];
};

/** Options for robustness analysis */
export type RobustnessOptions = {
  /** Number of Monte Carlo simulations (default: 500) */
  monteCarloSimulations?: number;
  /** Parameter perturbation range in percent (default: 20) */
  perturbationPercent?: number;
  /** Number of perturbation samples (default: 10) */
  perturbationSamples?: number;
  /** Walk-Forward window size in candles (default: 252) */
  walkForwardWindowSize?: number;
  /** Walk-Forward step size in candles (default: 63) */
  walkForwardStepSize?: number;
  /** Walk-Forward test size in candles (default: 63) */
  walkForwardTestSize?: number;
  /** Weights for each dimension (default: equal) */
  weights?: {
    monteCarlo?: number;
    parameterSensitivity?: number;
    walkForward?: number;
    regimeConsistency?: number;
  };
  /** Random seed for reproducibility */
  seed?: number;
  /** Progress callback */
  progressCallback?: (phase: string, progress: number) => void;
};

/** Simplified options for when walk-forward / parameter sweep aren't feasible */
export type QuickRobustnessOptions = {
  /** Number of Monte Carlo simulations (default: 300) */
  monteCarloSimulations?: number;
  /** Random seed for reproducibility */
  seed?: number;
};

/** Quick robustness result (from backtest result only) */
export type QuickRobustnessResult = {
  /** Composite score 0-100 */
  compositeScore: number;
  /** Letter grade */
  grade: RobustnessGrade;
  /** Dimensions that could be computed */
  dimensions: {
    monteCarlo: DimensionScore;
    tradeConsistency: DimensionScore;
    drawdownResilience: DimensionScore;
  };
  /** Assessment */
  assessment: string;
  /** Recommendations */
  recommendations: string[];
};
