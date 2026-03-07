/**
 * Batch Signal Processing Adapter
 *
 * Processes an array of trade signals through a SignalManager,
 * simulating bar-by-bar processing for backtest use cases.
 *
 * @example
 * ```ts
 * const allSignals = convertedSignals; // TradeSignal[] sorted by time
 * const filtered = processSignalsBatch(allSignals, {
 *   cooldown: { bars: 5 },
 *   expiry: { bars: 20 },
 * });
 * ```
 */

import type { TradeSignal } from "../../types/trade-signal";
import { createSignalManager } from "./signal-manager";
import type { SignalManagerOptions } from "./types";

/**
 * Process an array of signals through a SignalManager in batch mode
 *
 * Groups signals by time and processes each group as a bar.
 * Returns only the signals that passed through deduplication and lifecycle checks.
 *
 * @param signals - Array of trade signals, should be sorted by time
 * @param options - SignalManager options
 * @returns Filtered array of activated trade signals
 *
 * @example
 * ```ts
 * const crossSignals = validateCrossSignals(candles)
 *   .map(s => fromCrossSignal(s, candles[s.secondIdx].close));
 *
 * const filtered = processSignalsBatch(crossSignals, {
 *   cooldown: { bars: 10 },
 * });
 * // filtered contains only non-duplicate signals
 * ```
 */
export function processSignalsBatch(
  signals: TradeSignal[],
  options?: SignalManagerOptions,
): TradeSignal[] {
  if (signals.length === 0) return [];

  const manager = createSignalManager(options);

  // Group signals by time
  const groups = new Map<number, TradeSignal[]>();
  for (const signal of signals) {
    const existing = groups.get(signal.time);
    if (existing) {
      existing.push(signal);
    } else {
      groups.set(signal.time, [signal]);
    }
  }

  // Sort by time and process each group
  const sortedTimes = [...groups.keys()].sort((a, b) => a - b);
  const result: TradeSignal[] = [];

  for (const time of sortedTimes) {
    const group = groups.get(time)!;
    const activated = manager.onBar(group, time);
    result.push(...activated);
  }

  return result;
}
