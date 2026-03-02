/**
 * Guards Module
 *
 * Risk management and time-based trading controls for streaming sessions.
 * Provides circuit breaker (RiskGuard) and session time management (TimeGuard)
 * that wrap a TradingSession to enforce trading discipline.
 */

// Types
export type {
  RiskGuardOptions,
  RiskGuardState,
  RiskGuardCheckResult,
  RiskGuard,
  TradingWindow,
  BlackoutPeriod,
  TimeGuardOptions,
  TimeGuardState,
  TimeGuardCheckResult,
  TimeGuard,
  GuardedSessionOptions,
  GuardedSessionState,
  BlockedEvent,
  ForceCloseEvent,
  GuardedTradingSession,
} from "./types";

// Implementations
export { createRiskGuard } from "./risk-guard";
export { createTimeGuard } from "./time-guard";
export { createGuardedSession } from "./guarded-session";
