/**
 * Signal Scoring, Volatility Regime, Scaled Entry, and Fundamental Metrics type definitions for TrendCraft
 */

import type { NormalizedCandle } from "./candle";
import type { MtfContext } from "./backtest";

// ============================================================================
// Signal Scoring Types
// ============================================================================

/**
 * Pre-computed indicator data for performance optimization
 * Used by signal evaluators to avoid re-calculating indicators on each bar
 */
export type PrecomputedIndicators = {
  /** RSI values (period: 14) */
  rsi14?: (number | null)[];
  /** MACD values (12, 26, 9) */
  macd?: { macd: number | null; signal: number | null; histogram: number | null }[];
  /** Stochastics values (k: 14, d: 3) */
  stoch?: { k: number | null; d: number | null }[];
  /** SMA values by period */
  sma?: Map<number, (number | null)[]>;
  /** EMA values by period */
  ema?: Map<number, (number | null)[]>;
  /** Volume MA values (period: 20) */
  volumeMa20?: (number | null)[];
  /** Volume anomaly data */
  volumeAnomaly?: ({ ratio: number; level: string; isAnomaly: boolean; zScore: number | null } | null)[];
  /** Volume trend data */
  volumeTrend?: ({
    isConfirmed: boolean;
    priceTrend: string;
    volumeTrend: string;
    confidence: number;
    hasDivergence: boolean;
  } | null)[];
  /** CMF values (period: 20) */
  cmf20?: (number | null)[];
  /** Perfect Order data */
  perfectOrder?: ({ type: string; strength: number } | null)[];
  /** Perfect Order Enhanced data */
  perfectOrderEnhanced?: ({
    state: string;
    isConfirmed: boolean;
    confirmationFormed: boolean;
  } | null)[];
};

/**
 * Individual signal evaluator function
 * Returns a score between 0 and 1 indicating signal strength
 */
export type SignalEvaluator = (
  candles: NormalizedCandle[],
  index: number,
  context?: MtfContext,
  precomputed?: PrecomputedIndicators,
) => number;

/**
 * Signal definition with name and weight
 */
export type SignalDefinition = {
  /** Unique identifier for the signal */
  name: string;
  /** Display name for reporting */
  displayName: string;
  /** Weight for scoring (higher = more important) */
  weight: number;
  /** Signal evaluator function */
  evaluate: SignalEvaluator;
  /** Optional category for grouping */
  category?: "momentum" | "trend" | "volume" | "volatility" | "mtf";
  /** Required pre-computed indicators for this signal */
  requiredIndicators?: (keyof PrecomputedIndicators)[];
};

/**
 * Result of scoring all signals
 */
export type ScoreResult = {
  /** Raw weighted sum of all signals */
  rawScore: number;
  /** Normalized score (0-100) */
  normalizedScore: number;
  /** Maximum possible score */
  maxScore: number;
  /** Signal strength classification */
  strength: "strong" | "moderate" | "weak" | "none";
  /** Number of active signals */
  activeSignals: number;
  /** Total number of signals */
  totalSignals: number;
};

/**
 * Detailed breakdown of individual signal contributions
 */
export type SignalContribution = {
  /** Signal name */
  name: string;
  /** Display name */
  displayName: string;
  /** Raw score from evaluator (0-1) */
  rawValue: number;
  /** Weighted score contribution */
  score: number;
  /** Weight used */
  weight: number;
  /** Whether signal is active (rawValue > 0) */
  isActive: boolean;
  /** Category of the signal */
  category?: string;
};

/**
 * Full score breakdown with all signal contributions
 */
export type ScoreBreakdown = ScoreResult & {
  /** Individual signal contributions */
  contributions: SignalContribution[];
};

/**
 * Configuration for the scoring system
 */
export type ScoringConfig = {
  /** Array of signal definitions */
  signals: SignalDefinition[];
  /** Threshold for "strong" strength (default: 70) */
  strongThreshold?: number;
  /** Threshold for "moderate" strength (default: 50) */
  moderateThreshold?: number;
  /** Threshold for "weak" strength (default: 30) */
  weakThreshold?: number;
};

/**
 * Preset strategy names
 */
export type ScoringPreset = "momentum" | "meanReversion" | "trendFollowing" | "balanced" | "aggressive" | "conservative";

// ============================================================================
// Volatility Regime Types
// ============================================================================

/**
 * Volatility regime classification
 */
export type VolatilityRegime = "low" | "normal" | "high" | "extreme";

/**
 * Options for volatility regime calculation
 */
export type VolatilityRegimeOptions = {
  /** ATR period (default: 14) */
  atrPeriod?: number;
  /** Bollinger Bands period (default: 20) */
  bbPeriod?: number;
  /** Lookback period for percentile calculation (default: 100) */
  lookbackPeriod?: number;
  /** Thresholds for regime classification (percentiles) */
  thresholds?: {
    /** Low volatility threshold (default: 25) */
    low?: number;
    /** High volatility threshold (default: 75) */
    high?: number;
    /** Extreme volatility threshold (default: 95) */
    extreme?: number;
  };
};

/**
 * Volatility regime calculation result
 */
export type VolatilityRegimeValue = {
  /** Current volatility regime */
  regime: VolatilityRegime;
  /** ATR percentile (0-100) relative to lookback period */
  atrPercentile: number | null;
  /** Bollinger bandwidth percentile (0-100) relative to lookback period */
  bandwidthPercentile: number | null;
  /** Historical volatility (annualized standard deviation of returns) */
  historicalVol: number | null;
  /** Current ATR value */
  atr: number | null;
  /** Current Bollinger bandwidth */
  bandwidth: number | null;
  /** Regime confidence score (0-1) based on indicator agreement */
  confidence: number;
};

// ============================================================================
// Scaled Entry Types
// ============================================================================

/**
 * Scaled entry strategy type
 */
export type ScaledEntryStrategy = "equal" | "pyramid" | "reverse-pyramid";

/**
 * Scaled entry interval type
 */
export type ScaledEntryIntervalType = "signal" | "price";

/**
 * Configuration for scaled/split entry
 */
export type ScaledEntryConfig = {
  /** Number of entry tranches (default: 3) */
  tranches: number;
  /** Entry allocation strategy */
  strategy: ScaledEntryStrategy;
  /** Entry interval type */
  intervalType: ScaledEntryIntervalType;
  /** Price interval in percent (for 'price' type, e.g., -2 = buy 2% lower each time) */
  priceInterval?: number;
};

// ============================================================================
// Fundamental Metrics Types
// ============================================================================

/**
 * Fundamental metrics for a specific time point
 * Used for PER/PBR-based condition evaluation in backtesting
 */
export type FundamentalMetrics = {
  /** Timestamp (epoch milliseconds) */
  time: number;
  /** Price-to-Earnings Ratio (株価収益率) */
  per?: number | null;
  /** Price-to-Book Ratio (株価純資産倍率) */
  pbr?: number | null;
};
