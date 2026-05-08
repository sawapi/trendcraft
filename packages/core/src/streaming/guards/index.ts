/**
 * Guards Module
 *
 * Risk management and time-based trading controls for streaming sessions.
 * Provides circuit breaker (RiskGuard) and session time management (TimeGuard)
 * that wrap a TradingSession to enforce trading discipline.
 */

export { createGuardedSession } from "./guarded-session";
export { createPortfolioGuard } from "./portfolio-guard";
// Implementations
export { createRiskGuard } from "./risk-guard";
export { createTimeGuard } from "./time-guard";
// Types
export type {
  BlackoutPeriod,
  BlockedEvent,
  ForceCloseEvent,
  GuardedSessionOptions,
  GuardedSessionState,
  GuardedTradingSession,
  PortfolioExposure,
  PortfolioGuard,
  PortfolioGuardCheckResult,
  PortfolioGuardOptions,
  PortfolioGuardState,
  RiskGuard,
  RiskGuardCheckResult,
  RiskGuardOptions,
  RiskGuardState,
  TimeGuard,
  TimeGuardCheckResult,
  TimeGuardOptions,
  TimeGuardState,
  TradingWindow,
} from "./types";
