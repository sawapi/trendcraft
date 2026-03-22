/**
 * Cross-Asset Correlation types
 */

/** Rolling correlation data point */
export type CorrelationPoint = {
  time: number;
  /** Pearson correlation coefficient (-1 to 1) */
  pearson: number;
  /** Spearman rank correlation coefficient (-1 to 1) */
  spearman: number;
};

/** Correlation regime */
export type CorrelationRegime =
  | "strong_positive"
  | "positive"
  | "neutral"
  | "negative"
  | "strong_negative";

/** Correlation regime data point */
export type CorrelationRegimePoint = {
  time: number;
  regime: CorrelationRegime;
  /** Correlation value that determined the regime */
  correlation: number;
  /** Duration of current regime in bars */
  regimeDuration: number;
};

/** Lead-lag analysis result */
export type LeadLagResult = {
  /** Optimal lag (positive = A leads B, negative = B leads A) */
  optimalLag: number;
  /** Cross-correlation at each lag */
  crossCorrelation: Array<{ lag: number; correlation: number }>;
  /** Maximum absolute correlation found */
  maxCorrelation: number;
  /** Assessment */
  assessment: string;
};

/** Intermarket divergence signal */
export type DivergencePoint = {
  time: number;
  /** Type of divergence */
  type: "bullish" | "bearish";
  /** Return of asset A over lookback */
  returnA: number;
  /** Return of asset B over lookback */
  returnB: number;
  /** Spread between returns */
  returnSpread: number;
  /** Significance (z-score of the divergence) */
  significance: number;
};

/** Full correlation analysis result */
export type CorrelationAnalysisResult = {
  /** Rolling correlation series */
  rollingCorrelation: CorrelationPoint[];
  /** Correlation regime series */
  regimes: CorrelationRegimePoint[];
  /** Lead-lag analysis */
  leadLag: LeadLagResult;
  /** Intermarket divergence signals */
  divergences: DivergencePoint[];
  /** Summary statistics */
  summary: {
    /** Average correlation */
    avgCorrelation: number;
    /** Correlation stability (1 - CV of rolling correlation) */
    stability: number;
    /** Current regime */
    currentRegime: CorrelationRegime;
    /** Most common regime */
    dominantRegime: CorrelationRegime;
  };
};

/** Options for correlation analysis */
export type CorrelationAnalysisOptions = {
  /** Rolling window for correlation (default: 60) */
  window?: number;
  /** Correlation regime thresholds */
  regimeThresholds?: {
    strongPositive?: number; // default: 0.7
    positive?: number; // default: 0.3
    negative?: number; // default: -0.3
    strongNegative?: number; // default: -0.7
  };
  /** Maximum lag for lead-lag analysis (default: 10) */
  maxLag?: number;
  /** Lookback for divergence detection (default: 20) */
  divergenceLookback?: number;
  /** Z-score threshold for significant divergence (default: 2.0) */
  divergenceThreshold?: number;
};
