/**
 * Perfect Order detection for trading signals
 *
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 *
 * @module signals/perfect-order
 */

// Re-export types
export type {
  PerfectOrderType,
  SlopeDirection,
  PerfectOrderState,
  PerfectOrderValue,
  PerfectOrderValueEnhanced,
  PerfectOrderOptions,
  PerfectOrderOptionsEnhanced,
} from "./types";

// Re-export core function
export { perfectOrder } from "./core";

// Re-export enhanced function
export { perfectOrderEnhanced } from "./enhanced";
