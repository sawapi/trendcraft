/**
 * Guard module type definitions
 *
 * Types for risk management (circuit breaker) and session time management
 * in real-time day trading.
 */

import type { NormalizedCandle } from "../../types";
import type {
  IndicatorSnapshot,
  SessionState,
  TradingSession,
} from "../types";

// ============================================
// RiskGuard Types (Circuit Breaker)
// ============================================

/**
 * Configuration for RiskGuard
 *
 * @example
 * ```ts
 * const options: RiskGuardOptions = {
 *   maxDailyLoss: -50000,
 *   maxDailyTrades: 20,
 *   maxConsecutiveLosses: 3,
 *   cooldownMs: 30 * 60_000,
 *   resetTimeOffsetMs: 0,
 * };
 * ```
 */
export type RiskGuardOptions = {
  /** Maximum daily loss (absolute value, e.g., -5000). Trading blocked when dailyPnl <= this value */
  maxDailyLoss?: number;
  /** Maximum number of trades per day */
  maxDailyTrades?: number;
  /** Maximum consecutive losing trades before blocking */
  maxConsecutiveLosses?: number;
  /** Cooldown period in ms after hitting consecutive loss limit */
  cooldownMs?: number;
  /** Daily reset time as offset from UTC midnight in ms (e.g., JST 9:00 AM = 0) */
  resetTimeOffsetMs?: number;
};

/**
 * Serializable state for RiskGuard
 */
export type RiskGuardState = {
  dailyPnl: number;
  dailyTradeCount: number;
  consecutiveLosses: number;
  lastResetDay: number;
  cooldownUntil: number;
};

/**
 * Result of a RiskGuard check
 */
export type RiskGuardCheckResult = {
  allowed: boolean;
  reason?: string;
};

/**
 * Risk management guard that enforces daily loss limits, trade limits,
 * and consecutive loss cooldowns
 */
export type RiskGuard = {
  /** Check if trading is currently allowed */
  check(time: number): RiskGuardCheckResult;
  /** Report a completed trade result */
  reportTrade(pnl: number, time: number): void;
  /** Reset all counters */
  reset(): void;
  /** Serialize internal state */
  getState(): RiskGuardState;
};

// ============================================
// TimeGuard Types
// ============================================

/**
 * A trading time window (offset from local midnight in ms)
 *
 * @example
 * ```ts
 * // 9:00 AM - 11:30 AM
 * const morning: TradingWindow = {
 *   startMs: 9 * 3600_000,
 *   endMs: 11.5 * 3600_000,
 * };
 * ```
 */
export type TradingWindow = {
  /** Window start as offset from local midnight in ms */
  startMs: number;
  /** Window end as offset from local midnight in ms */
  endMs: number;
};

/**
 * A blackout period during which trading is not allowed (absolute timestamps)
 *
 * @example
 * ```ts
 * // Block trading during FOMC announcement
 * const fomc: BlackoutPeriod = {
 *   startTime: Date.parse('2024-01-31T19:00:00Z'),
 *   endTime: Date.parse('2024-01-31T19:30:00Z'),
 *   reason: 'FOMC announcement',
 * };
 * ```
 */
export type BlackoutPeriod = {
  /** Blackout start (epoch ms) */
  startTime: number;
  /** Blackout end (epoch ms) */
  endTime: number;
  /** Optional reason for the blackout */
  reason?: string;
};

/**
 * Configuration for TimeGuard
 *
 * @example
 * ```ts
 * const options: TimeGuardOptions = {
 *   tradingWindows: [
 *     { startMs: 9 * 3600_000, endMs: 11.5 * 3600_000 },
 *     { startMs: 12.5 * 3600_000, endMs: 15 * 3600_000 },
 *   ],
 *   timezoneOffsetMs: 9 * 3600_000, // JST
 *   forceCloseBeforeEndMs: 5 * 60_000,
 * };
 * ```
 */
export type TimeGuardOptions = {
  /** Trading time windows (local time offsets from midnight) */
  tradingWindows: TradingWindow[];
  /** Force-close positions N ms before each window ends */
  forceCloseBeforeEndMs?: number;
  /** Timezone offset from UTC in ms (e.g., JST = 9 * 3600_000) */
  timezoneOffsetMs?: number;
  /** Absolute blackout periods (e.g., economic announcements) */
  blackoutPeriods?: BlackoutPeriod[];
};

/**
 * Result of a TimeGuard check
 */
export type TimeGuardCheckResult = {
  allowed: boolean;
  shouldForceClose: boolean;
  reason?: string;
};

/**
 * Serializable state for TimeGuard
 */
export type TimeGuardState = {
  blackoutPeriods: BlackoutPeriod[];
};

/**
 * Time-based trading guard that enforces trading windows and blackout periods
 */
export type TimeGuard = {
  /** Check if trading is allowed at the given time */
  check(time: number): TimeGuardCheckResult;
  /** Add a blackout period dynamically (e.g., before economic data releases) */
  addBlackout(period: BlackoutPeriod): void;
  /** Serialize internal state */
  getState(): TimeGuardState;
};

// ============================================
// GuardedSession Types
// ============================================

/**
 * Configuration for guard options in a GuardedSession
 */
export type GuardedSessionOptions = {
  /** RiskGuard configuration (omit to disable) */
  riskGuard?: RiskGuardOptions;
  /** TimeGuard configuration (omit to disable) */
  timeGuard?: TimeGuardOptions;
};

/**
 * Serializable state for GuardedSession
 */
export type GuardedSessionState = {
  sessionState: SessionState;
  riskGuardState?: RiskGuardState;
  timeGuardState?: TimeGuardState;
};

/**
 * Blocked event — emitted when an entry signal is blocked by a guard
 */
export type BlockedEvent = {
  type: "blocked";
  reason: string;
  candle: NormalizedCandle;
};

/**
 * Force-close event — emitted when positions should be closed (e.g., near window end)
 */
export type ForceCloseEvent = {
  type: "force-close";
  reason: string;
  candle: NormalizedCandle;
  snapshot: IndicatorSnapshot;
};

/**
 * A TradingSession wrapped with risk and time guards
 */
export type GuardedTradingSession = Omit<TradingSession, "getState"> & {
  /** RiskGuard instance (null if not configured) */
  riskGuard: RiskGuard | null;
  /** TimeGuard instance (null if not configured) */
  timeGuard: TimeGuard | null;
  /** Serialize full guarded session state */
  getState(): GuardedSessionState;
};
