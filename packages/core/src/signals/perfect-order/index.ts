/**
 * Perfect Order detection for trading signals
 *
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 *
 * @module signals/perfect-order
 */

// Re-export core function
export { perfectOrder } from "./core";
// Re-export enhanced function
export { perfectOrderEnhanced } from "./enhanced";
// Re-export types
export type {
  PerfectOrderOptions,
  PerfectOrderOptionsEnhanced,
  PerfectOrderState,
  PerfectOrderType,
  PerfectOrderValue,
  PerfectOrderValueEnhanced,
  SlopeDirection,
} from "./types";
