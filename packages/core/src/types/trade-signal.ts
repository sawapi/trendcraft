/**
 * Unified Trade Signal Types
 *
 * Provides a standardized signal format that automated trading scripts
 * can consume regardless of the original signal source.
 */

/**
 * Trade action to take
 */
export type TradeAction = "BUY" | "SELL" | "CLOSE";

/**
 * Position direction
 */
export type TradeDirection = "LONG" | "SHORT";

/**
 * Reason/source for a trade signal
 */
export type SignalReason = {
  /** Signal source (e.g., "cross", "divergence", "pattern") */
  source: string;
  /** Signal name (e.g., "goldenCross", "rsiDivergence") */
  name: string;
  /** Additional detail */
  detail?: string;
};

/**
 * Price levels associated with a trade signal
 */
export type PriceLevels = {
  /** Suggested entry price */
  entry: number;
  /** Suggested stop loss price */
  stopLoss?: number;
  /** Suggested take profit price */
  takeProfit?: number;
};

/**
 * Unified trade signal format
 *
 * A standardized representation of any trading signal detected by TrendCraft.
 * Designed for consumption by automated trading scripts.
 *
 * @example
 * ```ts
 * const signal: TradeSignal = {
 *   id: 'cross-1703500800000',
 *   time: 1703500800000,
 *   action: 'BUY',
 *   direction: 'LONG',
 *   confidence: 75,
 *   reasons: [{ source: 'cross', name: 'goldenCross' }],
 * };
 * ```
 */
export type TradeSignal = {
  /** Unique signal identifier */
  id: string;
  /** Signal timestamp (epoch ms) */
  time: number;
  /** Recommended action */
  action: TradeAction;
  /** Position direction */
  direction: TradeDirection;
  /** Confidence score (0-100) */
  confidence: number;
  /** Suggested price levels */
  prices?: PriceLevels;
  /** Reasons that generated this signal */
  reasons: SignalReason[];
  /** Timeframe identifier (e.g., "1d", "4h") */
  timeframe?: string;
  /** Arbitrary metadata */
  metadata?: Record<string, unknown>;
};
