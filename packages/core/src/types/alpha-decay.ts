/**
 * Alpha Decay / Signal Degradation Monitor types
 *
 * Types for tracking whether a strategy's predictive power
 * degrades over time using rolling IC, hit rate, and CUSUM.
 */

/** Single observation for decay analysis */
export type DecayObservation = {
  time: number;
  /** Signal value (predicted direction or magnitude) */
  signal: number;
  /** Actual forward return */
  forwardReturn: number;
};

/** Rolling IC data point */
export type RollingICPoint = {
  time: number;
  /** Information Coefficient (rank correlation between signal and forward return) */
  ic: number;
  /** P-value for the IC (significance) */
  pValue: number;
  /** Number of observations in the window */
  sampleSize: number;
};

/** Hit rate data point */
export type HitRatePoint = {
  time: number;
  /** Hit rate (% of correct direction predictions) */
  hitRate: number;
  /** Number of observations */
  sampleSize: number;
};

/** CUSUM structural break detection result */
export type CusumBreak = {
  /** Time when structural break was detected */
  time: number;
  /** Bar index of the break */
  index: number;
  /** CUSUM statistic value at break */
  cusumValue: number;
  /** Direction of break: "degradation" or "improvement" */
  direction: "degradation" | "improvement";
};

/** Overall decay assessment */
export type DecayAssessment = {
  /** Current regime: healthy, warning, degraded, critical */
  status: "healthy" | "warning" | "degraded" | "critical";
  /** Human-readable explanation */
  reason: string;
  /** Current rolling IC (latest window) */
  currentIC: number;
  /** Current hit rate (latest window) */
  currentHitRate: number;
  /** Trend of IC over time (slope of linear regression on IC) */
  icTrend: number;
  /** Estimated half-life in bars (how many bars until IC halves). Null if IC is stable/increasing */
  halfLife: number | null;
  /** Structural breaks detected */
  breaks: CusumBreak[];
};

/** Alpha decay monitor result */
export type AlphaDecayResult = {
  /** Rolling IC series */
  rollingIC: RollingICPoint[];
  /** Rolling hit rate series */
  rollingHitRate: HitRatePoint[];
  /** CUSUM chart values (for plotting) */
  cusumSeries: Array<{ time: number; value: number }>;
  /** Detected structural breaks */
  breaks: CusumBreak[];
  /** Overall assessment */
  assessment: DecayAssessment;
};

/** Options for alpha decay analysis */
export type AlphaDecayOptions = {
  /** Rolling window size for IC/hit rate (default: 60) */
  window?: number;
  /** Forward return lookback in bars (default: 1) */
  forwardBars?: number;
  /** CUSUM threshold for break detection (default: 4.0, in std deviations) */
  cusumThreshold?: number;
  /** Minimum observations required (default: 30) */
  minObservations?: number;
};
