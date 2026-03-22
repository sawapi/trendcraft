/**
 * Pairs Trading / Cointegration types
 */

/** Cointegration test result */
export type CointegrationResult = {
  /** Whether the pair is cointegrated at the given significance level */
  isCointegrated: boolean;
  /** ADF test statistic */
  adfStatistic: number;
  /** Critical values at different significance levels */
  criticalValues: {
    "1%": number;
    "5%": number;
    "10%": number;
  };
  /** P-value (approximate) */
  pValue: number;
  /** Hedge ratio (beta coefficient from OLS regression) */
  hedgeRatio: number;
  /** Regression intercept */
  intercept: number;
  /** R-squared of the regression */
  rSquared: number;
  /** Significance level used for isCointegrated determination */
  significanceLevel: number;
};

/** Spread series data point */
export type SpreadPoint = {
  time: number;
  /** Raw spread value */
  spread: number;
  /** Z-score of the spread */
  zScore: number;
  /** Mean of the spread (rolling or full-sample) */
  mean: number;
  /** Standard deviation */
  stdDev: number;
};

/** Mean reversion analysis result */
export type MeanReversionResult = {
  /** Half-life in bars (time for spread to revert halfway to mean) */
  halfLife: number;
  /** Speed of mean reversion (lambda coefficient from AR(1) model) */
  lambda: number;
  /** Is mean-reverting (halfLife > 0 and < reasonable threshold) */
  isMeanReverting: boolean;
  /** Hurst exponent estimate */
  hurstExponent: number;
};

/** Pairs trading signal */
export type PairsSignal = {
  time: number;
  /** Signal type */
  type: "open_long" | "open_short" | "close" | "none";
  /** Z-score at signal time */
  zScore: number;
  /** Spread value */
  spread: number;
};

/** Options for pairs analysis */
export type PairsAnalysisOptions = {
  /** Significance level for cointegration test (default: 0.05) */
  significanceLevel?: number;
  /** Rolling window for z-score calculation (default: 0, meaning full sample) */
  rollingWindow?: number;
  /** Z-score threshold to open position (default: 2.0) */
  entryThreshold?: number;
  /** Z-score threshold to close position (default: 0.5) */
  exitThreshold?: number;
  /** Maximum half-life to consider mean-reverting (default: 100 bars) */
  maxHalfLife?: number;
};

/** Full pairs analysis result */
export type PairsAnalysisResult = {
  /** Cointegration test */
  cointegration: CointegrationResult;
  /** Mean reversion analysis */
  meanReversion: MeanReversionResult;
  /** Spread series with z-scores */
  spreadSeries: SpreadPoint[];
  /** Generated trading signals */
  signals: PairsSignal[];
  /** Overall assessment */
  assessment: {
    /** Is this a viable pair? */
    isViable: boolean;
    /** Reason */
    reason: string;
    /** Recommended position sizing factor (0-1, based on confidence) */
    confidenceFactor: number;
  };
};
