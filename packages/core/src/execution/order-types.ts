/**
 * Broker-agnostic Order and Execution Types
 *
 * Standardized types for expressing trade intent and execution results,
 * independent of any specific broker API.
 *
 * @example
 * ```ts
 * import type { OrderIntent, ExecutionResult } from "trendcraft";
 *
 * const order: OrderIntent = {
 *   symbol: "AAPL",
 *   side: "buy",
 *   quantity: 10,
 *   type: "limit",
 *   limitPrice: 150.00,
 *   timeInForce: "day",
 * };
 * ```
 */

/**
 * A broker-agnostic order intent.
 *
 * Represents the desire to place an order without coupling
 * to any specific broker's API shape.
 */
export type OrderIntent = {
  /** Ticker symbol */
  symbol: string;
  /** Order side */
  side: "buy" | "sell";
  /** Number of shares / units */
  quantity: number;
  /** Order type */
  type: "market" | "limit" | "stop" | "stop-limit";
  /** Limit price (required for "limit" and "stop-limit") */
  limitPrice?: number;
  /** Stop / trigger price (required for "stop" and "stop-limit") */
  stopPrice?: number;
  /** Time in force. Default: "day" */
  timeInForce?: "day" | "gtc" | "ioc" | "fok";
  /** Client-generated order ID for idempotency */
  clientOrderId?: string;
};

/**
 * The result of an order execution attempt.
 */
export type ExecutionResult = {
  /** Broker-assigned order ID */
  orderId: string;
  /** Client order ID echoed back (if provided) */
  clientOrderId?: string;
  /** Symbol that was traded */
  symbol: string;
  /** Number of shares actually filled */
  filledQty: number;
  /** Volume-weighted average fill price */
  avgPrice: number;
  /** Current order status */
  status: "filled" | "partial" | "rejected" | "cancelled" | "pending";
  /** ISO-8601 timestamp of the fill (or status update) */
  timestamp: string;
  /** Rejection / cancellation reason (when status is "rejected" or "cancelled") */
  reason?: string;
};

/**
 * A position snapshot from a broker or internal tracker.
 *
 * Used for reconciliation between the internal state and
 * external broker positions.
 */
export type PositionSnapshot = {
  /** Ticker symbol */
  symbol: string;
  /** Signed quantity (positive = long, negative = short) */
  quantity: number;
  /** Average entry price */
  avgEntryPrice: number;
  /** Current market value (quantity * current price) */
  marketValue?: number;
  /** Unrealized P&L */
  unrealizedPnl?: number;
};

/**
 * A discrepancy found during position reconciliation.
 */
export type Discrepancy = {
  /** Ticker symbol */
  symbol: string;
  /** Type of discrepancy */
  type: "missing-internal" | "missing-external" | "quantity-mismatch" | "price-mismatch";
  /** Position as known internally (undefined if missing) */
  internal?: PositionSnapshot;
  /** Position as reported by broker (undefined if missing) */
  external?: PositionSnapshot;
  /** Human-readable description */
  message: string;
};
