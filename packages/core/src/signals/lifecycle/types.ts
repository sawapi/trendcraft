/**
 * Signal Lifecycle Management Types
 *
 * Types for deduplication, cooldown, debounce, and expiry of trade signals.
 */

import type { TradeSignal } from "../../types/trade-signal";

/**
 * Signal lifecycle state
 */
export type SignalState = "PENDING" | "ACTIVE" | "EXPIRED" | "FILLED" | "CANCELLED";

/**
 * A signal wrapped with lifecycle metadata
 */
export type ManagedSignal = {
  /** The original trade signal */
  signal: TradeSignal;
  /** Current lifecycle state */
  state: SignalState;
  /** Time when the signal was first seen (epoch ms) */
  firstSeen: number;
  /** Time when the signal became ACTIVE (epoch ms) */
  activatedAt: number | null;
  /** Bar count when the signal was first seen */
  firstSeenBar: number;
  /** Bar count when the signal became ACTIVE */
  activatedAtBar: number | null;
  /** Consecutive bar count (for debounce) */
  consecutiveCount: number;
};

/**
 * Cooldown configuration
 *
 * Prevents the same signal from firing again within a cooldown period.
 *
 * @example
 * ```ts
 * // Suppress duplicate signals for 5 bars
 * const cooldown: CooldownConfig = { bars: 5 };
 *
 * // Suppress for 1 hour
 * const cooldown: CooldownConfig = { ms: 3600000 };
 * ```
 */
export type CooldownConfig = {
  /** Cooldown period in bars */
  bars?: number;
  /** Cooldown period in milliseconds */
  ms?: number;
};

/**
 * Debounce configuration
 *
 * Requires a signal to appear for N consecutive bars before activating.
 *
 * @example
 * ```ts
 * // Require 3 consecutive bars of the same signal
 * const debounce: DebounceConfig = { bars: 3 };
 * ```
 */
export type DebounceConfig = {
  /** Number of consecutive bars required */
  bars: number;
};

/**
 * Expiry configuration
 *
 * Automatically expires ACTIVE signals after a time-to-live period.
 *
 * @example
 * ```ts
 * // Expire after 10 bars
 * const expiry: ExpiryConfig = { bars: 10 };
 *
 * // Expire after 30 minutes
 * const expiry: ExpiryConfig = { ms: 1800000 };
 * ```
 */
export type ExpiryConfig = {
  /** Expiry in bars */
  bars?: number;
  /** Expiry in milliseconds */
  ms?: number;
};

/**
 * Custom key function for determining signal identity.
 * Signals with the same key are considered duplicates.
 */
export type SignalKeyFn = (signal: TradeSignal) => string;

/**
 * Options for creating a SignalManager
 *
 * @example
 * ```ts
 * const options: SignalManagerOptions = {
 *   cooldown: { bars: 5 },
 *   debounce: { bars: 2 },
 *   expiry: { bars: 10 },
 * };
 * ```
 */
export type SignalManagerOptions = {
  /** Cooldown configuration */
  cooldown?: CooldownConfig;
  /** Debounce configuration */
  debounce?: DebounceConfig;
  /** Expiry configuration */
  expiry?: ExpiryConfig;
  /** Custom function to generate signal identity key */
  signalKey?: SignalKeyFn;
};

/**
 * Internal state for serialization
 */
export type SignalManagerState = {
  /** All tracked managed signals */
  signals: ManagedSignal[];
  /** Current bar count */
  barCount: number;
  /** Last bar time */
  lastTime: number;
  /** Cooldown tracking: key -> last activation bar */
  cooldownMap: Record<string, { bar: number; time: number }>;
};

/**
 * Signal manager for deduplication and lifecycle management
 */
export type SignalManager = {
  /** Process incoming signals for a bar, returns newly activated signals */
  onBar(incomingSignals: TradeSignal[], time: number): TradeSignal[];
  /** Mark a signal as filled */
  fill(signalId: string): void;
  /** Cancel a signal */
  cancel(signalId: string): void;
  /** Get managed signals, optionally filtered by state */
  getSignals(state?: SignalState): ManagedSignal[];
  /** Get count of ACTIVE signals */
  getActiveCount(): number;
  /** Serialize internal state */
  getState(): SignalManagerState;
};
