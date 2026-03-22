/**
 * Signal Lifecycle Module
 *
 * Deduplication, cooldown, debounce, and expiry management for trade signals.
 */

// Types
export type {
  SignalState,
  ManagedSignal,
  CooldownConfig,
  DebounceConfig,
  ExpiryConfig,
  SignalKeyFn,
  SignalManagerOptions,
  SignalManagerState,
  SignalManager,
} from "./types";

// Functions
export { createSignalManager } from "./signal-manager";
export { processSignalsBatch } from "./batch-adapter";
