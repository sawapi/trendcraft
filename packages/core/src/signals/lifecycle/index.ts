/**
 * Signal Lifecycle Module
 *
 * Deduplication, cooldown, debounce, and expiry management for trade signals.
 */

export { processSignalsBatch } from "./batch-adapter";

// Functions
export { createSignalManager } from "./signal-manager";
// Types
export type {
  CooldownConfig,
  DebounceConfig,
  ExpiryConfig,
  ManagedSignal,
  SignalKeyFn,
  SignalManager,
  SignalManagerOptions,
  SignalManagerState,
  SignalState,
} from "./types";
