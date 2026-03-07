/**
 * Signal Manager - Deduplication and Lifecycle Management
 *
 * Manages signal lifecycle with cooldown, debounce, and expiry features
 * to prevent duplicate signal firing and manage signal validity.
 *
 * @example
 * ```ts
 * const manager = createSignalManager({
 *   cooldown: { bars: 5 },
 *   debounce: { bars: 2 },
 *   expiry: { bars: 10 },
 * });
 *
 * // On each bar, pass incoming signals
 * const activated = manager.onBar(newSignals, candle.time);
 * for (const signal of activated) {
 *   // Execute trade...
 *   manager.fill(signal.id);
 * }
 * ```
 */

import type { TradeSignal } from "../../types/trade-signal";
import type {
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

/**
 * Default signal key: action + direction + sorted reason names
 */
function defaultSignalKey(signal: TradeSignal): string {
  const reasons = signal.reasons
    .map((r) => `${r.source}:${r.name}`)
    .sort()
    .join(",");
  return `${signal.action}|${signal.direction}|${reasons}`;
}

/**
 * Create a new SignalManager instance
 *
 * @param options - Manager configuration
 * @param fromState - Optional saved state to restore from
 * @returns SignalManager instance
 *
 * @example
 * ```ts
 * const manager = createSignalManager({
 *   cooldown: { bars: 3 },
 *   expiry: { bars: 20 },
 * });
 *
 * // Process signals each bar
 * const newSignals = manager.onBar(incomingSignals, Date.now());
 * ```
 */
export function createSignalManager(
  options: SignalManagerOptions = {},
  fromState?: SignalManagerState,
): SignalManager {
  const cooldown: CooldownConfig | undefined = options.cooldown;
  const debounce: DebounceConfig | undefined = options.debounce;
  const expiry: ExpiryConfig | undefined = options.expiry;
  const signalKey: SignalKeyFn = options.signalKey ?? defaultSignalKey;

  // Mutable state
  let signals: ManagedSignal[] = fromState?.signals ? [...fromState.signals] : [];
  let barCount = fromState?.barCount ?? 0;
  let lastTime = fromState?.lastTime ?? 0;
  const cooldownMap: Map<string, { bar: number; time: number }> = new Map(
    fromState?.cooldownMap
      ? Object.entries(fromState.cooldownMap)
      : [],
  );

  // Pending signals waiting for debounce confirmation
  const pendingMap = new Map<string, ManagedSignal>();

  // Initialize pending map from existing PENDING signals
  for (const ms of signals) {
    if (ms.state === "PENDING") {
      const key = signalKey(ms.signal);
      pendingMap.set(key, ms);
    }
  }

  function isInCooldown(key: string, currentBar: number, currentTime: number): boolean {
    if (!cooldown) return false;
    const last = cooldownMap.get(key);
    if (!last) return false;

    if (cooldown.bars !== undefined && currentBar - last.bar < cooldown.bars) {
      return true;
    }
    if (cooldown.ms !== undefined && currentTime - last.time < cooldown.ms) {
      return true;
    }
    return false;
  }

  function isExpired(ms: ManagedSignal, currentBar: number, currentTime: number): boolean {
    if (!expiry || ms.state !== "ACTIVE" || ms.activatedAtBar === null) return false;

    if (expiry.bars !== undefined && currentBar - ms.activatedAtBar >= expiry.bars) {
      return true;
    }
    if (expiry.ms !== undefined && ms.activatedAt !== null && currentTime - ms.activatedAt >= expiry.ms) {
      return true;
    }
    return false;
  }

  function findManagedSignal(signalId: string): ManagedSignal | undefined {
    return signals.find((ms) => ms.signal.id === signalId);
  }

  return {
    onBar(incomingSignals: TradeSignal[], time: number): TradeSignal[] {
      barCount++;
      lastTime = time;

      // Expire old ACTIVE signals
      for (const ms of signals) {
        if (ms.state === "ACTIVE" && isExpired(ms, barCount, time)) {
          ms.state = "EXPIRED";
        }
      }

      // Track which pending keys were seen this bar
      const seenKeys = new Set<string>();

      const activated: TradeSignal[] = [];

      for (const signal of incomingSignals) {
        const key = signalKey(signal);
        seenKeys.add(key);

        // Check cooldown
        if (isInCooldown(key, barCount, time)) {
          continue;
        }

        // Check debounce
        if (debounce) {
          const existing = pendingMap.get(key);
          if (existing) {
            existing.consecutiveCount++;
            existing.signal = signal; // Update to latest

            if (existing.consecutiveCount >= debounce.bars) {
              // Debounce satisfied -> activate
              existing.state = "ACTIVE";
              existing.activatedAt = time;
              existing.activatedAtBar = barCount;
              pendingMap.delete(key);
              cooldownMap.set(key, { bar: barCount, time });
              activated.push(signal);
            }
          } else {
            // New pending signal
            const managed: ManagedSignal = {
              signal,
              state: "PENDING",
              firstSeen: time,
              activatedAt: null,
              firstSeenBar: barCount,
              activatedAtBar: null,
              consecutiveCount: 1,
            };
            signals.push(managed);
            pendingMap.set(key, managed);

            // If debounce is 1, activate immediately
            if (debounce.bars <= 1) {
              managed.state = "ACTIVE";
              managed.activatedAt = time;
              managed.activatedAtBar = barCount;
              pendingMap.delete(key);
              cooldownMap.set(key, { bar: barCount, time });
              activated.push(signal);
            }
          }
        } else {
          // No debounce -> activate immediately
          const managed: ManagedSignal = {
            signal,
            state: "ACTIVE",
            firstSeen: time,
            activatedAt: time,
            firstSeenBar: barCount,
            activatedAtBar: barCount,
            consecutiveCount: 1,
          };
          signals.push(managed);
          cooldownMap.set(key, { bar: barCount, time });
          activated.push(signal);
        }
      }

      // Reset consecutive count for pending signals not seen this bar
      if (debounce) {
        for (const [key, ms] of pendingMap.entries()) {
          if (!seenKeys.has(key)) {
            ms.consecutiveCount = 0;
            ms.state = "EXPIRED";
            pendingMap.delete(key);
          }
        }
      }

      return activated;
    },

    fill(signalId: string): void {
      const ms = findManagedSignal(signalId);
      if (ms && ms.state === "ACTIVE") {
        ms.state = "FILLED";
      }
    },

    cancel(signalId: string): void {
      const ms = findManagedSignal(signalId);
      if (ms && (ms.state === "ACTIVE" || ms.state === "PENDING")) {
        ms.state = "CANCELLED";
        const key = signalKey(ms.signal);
        pendingMap.delete(key);
      }
    },

    getSignals(state?: SignalState): ManagedSignal[] {
      if (!state) return [...signals];
      return signals.filter((ms) => ms.state === state);
    },

    getActiveCount(): number {
      return signals.filter((ms) => ms.state === "ACTIVE").length;
    },

    getState(): SignalManagerState {
      const cooldownObj: Record<string, { bar: number; time: number }> = {};
      for (const [key, value] of cooldownMap.entries()) {
        cooldownObj[key] = value;
      }

      return {
        signals: [...signals],
        barCount,
        lastTime,
        cooldownMap: cooldownObj,
      };
    },
  };
}
