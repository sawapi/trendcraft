/**
 * Position Manager Module
 *
 * Provides integrated position tracking, P&L calculation,
 * and account management for streaming trading sessions.
 */

export { createManagedSession } from "./managed-session";

// Functions
export { createPositionTracker } from "./position-tracker";
// Types
export type {
  AccountState,
  ClosedTradeResult,
  FillRecord,
  ManagedEvent,
  ManagedPosition,
  ManagedSession,
  ManagedSessionState,
  OpenPositionOptions,
  PartialFillResult,
  PositionEvent,
  PositionManagerOptions,
  PositionSizingConfig,
  PositionTracker,
  PositionTrackerOptions,
  PositionTrackerState,
  UpdatePriceResult,
} from "./types";
