/**
 * Centralized timer intervals for the live trading system
 */

export const INTERVALS = {
  /** Heartbeat write interval (dead-man's switch) */
  heartbeatMs: 5 * 60 * 1000,
  /** Agent state persistence interval */
  stateSaveMs: 5 * 60 * 1000,
  /** Leaderboard print interval */
  leaderboardMs: 60 * 60 * 1000,
  /** Position reconciliation interval */
  reconcileMs: 15 * 60 * 1000,
  /** Verbose ticker summary interval */
  verboseMs: 30 * 1000,
  /** Stale heartbeat threshold (triggers recovery) */
  staleHeartbeatMs: 10 * 60 * 1000,
} as const;
