/**
 * Position Manager Module
 *
 * Provides integrated position tracking, P&L calculation,
 * and account management for streaming trading sessions.
 */

// Types
export type {
  ManagedPosition,
  AccountState,
  FillRecord,
  PositionSizingConfig,
  PositionManagerOptions,
  OpenPositionOptions,
  UpdatePriceResult,
  ClosedTradeResult,
  PositionTrackerState,
  PositionTracker,
  PositionTrackerOptions,
  PositionEvent,
  ManagedEvent,
  ManagedSessionState,
  ManagedSession,
} from "./types";

// Functions
export { createPositionTracker } from "./position-tracker";
export { createManagedSession } from "./managed-session";
