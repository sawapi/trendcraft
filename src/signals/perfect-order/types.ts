import type { PriceSource } from "../../types";

/**
 * Perfect order type (legacy)
 */
export type PerfectOrderType = "bullish" | "bearish" | "none";

/**
 * Slope direction for MA trend analysis
 */
export type SlopeDirection = "UP" | "DOWN" | "FLAT";

/**
 * Enhanced perfect order state (7 states)
 */
export type PerfectOrderState =
  | "BULLISH_PO"      // Confirmed bullish perfect order
  | "BEARISH_PO"      // Confirmed bearish perfect order
  | "COLLAPSED"       // MA convergence (energy accumulation)
  | "PRE_BULLISH_PO"  // Forming bullish (not yet confirmed)
  | "PRE_BEARISH_PO"  // Forming bearish (not yet confirmed)
  | "PO_BREAKDOWN"    // Perfect order breaking down
  | "NEUTRAL_MIXED";  // No clear pattern

/**
 * Perfect order result for each candle
 */
export type PerfectOrderValue = {
  /** Current perfect order state */
  type: PerfectOrderType;
  /** True when perfect order just formed on this candle */
  formed: boolean;
  /** True when perfect order just collapsed on this candle */
  collapsed: boolean;
  /** Trend strength score (0-100, 0 when type is 'none') */
  strength: number;
  /** MA values in order (short to long) */
  maValues: (number | null)[];
};

/**
 * Enhanced perfect order result with additional fields
 */
export type PerfectOrderValueEnhanced = PerfectOrderValue & {
  /** Enhanced state (7 states) */
  state: PerfectOrderState;
  /** Confidence score (0-1) */
  confidence: number;
  /** Slope direction for each MA (short to long) */
  slopes: SlopeDirection[];
  /** Number of consecutive bars in current state */
  persistCount: number;
  /** True when persistCount >= persistBars */
  isConfirmed: boolean;
  /** True when state just became confirmed (event flag - fires once) */
  confirmationFormed: boolean;
  /** True when PO_BREAKDOWN just detected (event flag - fires once) */
  breakdownDetected: boolean;
  /** True when COLLAPSED just detected (event flag - fires once) */
  collapseDetected: boolean;
  /** True when PO has been confirmed since the last breakdown (continuous state flag) */
  hasConfirmedSinceBreakdown: boolean;
  /** True when pullback buy signal fires - only once per pullback cycle (event flag) */
  pullbackBuySignal: boolean;
};

/**
 * Options for perfect order detection
 */
export type PerfectOrderOptions = {
  /** MA periods (default: [5, 25, 75] - Japanese stock standard) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Price source (default: 'close') */
  source?: PriceSource;
  /** Hysteresis margin for price position check (default: 0.01 = 1%) */
  hysteresisMargin?: number;
};

/**
 * Enhanced options for perfect order detection
 */
export type PerfectOrderOptionsEnhanced = PerfectOrderOptions & {
  /** Enable enhanced mode with slope/persistence/collapse detection (default: false) */
  enhanced: true;
  /** Lookback period for slope calculation (default: 3) */
  slopeLookback?: number;
  /** Number of consecutive bars required for confirmation (default: 3) */
  persistBars?: number;
  /** Threshold for MA convergence detection as ratio (default: 0.003 = 0.3%) */
  collapseEps?: number;
  /** Threshold for flat slope detection as ratio per bar (default: 0.001 = 0.1%) */
  flatEps?: number;
};

/** Default hysteresis margin (1%) */
export const DEFAULT_HYSTERESIS_MARGIN = 0.01;

/** Default values for enhanced options */
export const ENHANCED_DEFAULTS = {
  slopeLookback: 3,
  persistBars: 3,
  collapseEps: 0.003,  // 0.3%
  flatEps: 0.001,      // 0.1% per bar
};
