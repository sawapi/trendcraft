/**
 * Strategy Factory
 *
 * Creates streaming sessions from strategy definitions.
 *
 * @example
 * ```ts
 * import { createSessionFromStrategy } from "trendcraft";
 *
 * const session = createSessionFromStrategy(strategy, {
 *   capital: 500_000,
 * });
 *
 * const events = session.onTrade({ time: Date.now(), price: 150, volume: 100 });
 * ```
 */

import { createManagedSession } from "../streaming/position-manager/managed-session";
import type { ManagedSession } from "../streaming/position-manager/types";
import type { SessionOverrides, StrategyDefinition } from "./types";

/**
 * Create a ManagedSession from a StrategyDefinition.
 *
 * Wires up pipeline, guards, and position management from
 * the strategy's declarative configuration.
 *
 * @param strategy - Strategy definition
 * @param overrides - Optional overrides for capital, sizing, etc.
 * @returns A fully configured ManagedSession
 *
 * @example
 * ```ts
 * import { createSessionFromStrategy, type StrategyDefinition } from "trendcraft";
 *
 * const strategy: StrategyDefinition = {
 *   id: "my-strategy",
 *   name: "My Strategy",
 *   intervalMs: 60_000,
 *   symbols: ["AAPL"],
 *   pipeline: { indicators: [...], entry: rsiBelow(30), exit: rsiAbove(70) },
 *   position: { capital: 100_000, stopLoss: 2 },
 * };
 *
 * const session = createSessionFromStrategy(strategy);
 * ```
 */
export function createSessionFromStrategy(
  strategy: StrategyDefinition,
  overrides?: SessionOverrides,
): ManagedSession {
  const positionOptions = {
    ...strategy.position,
    ...(overrides?.capital !== undefined ? { capital: overrides.capital } : {}),
    ...(overrides?.sizing !== undefined ? { sizing: overrides.sizing } : {}),
    ...(overrides?.stopLoss !== undefined ? { stopLoss: overrides.stopLoss } : {}),
    ...(overrides?.takeProfit !== undefined ? { takeProfit: overrides.takeProfit } : {}),
  };

  return createManagedSession(
    {
      intervalMs: strategy.intervalMs,
      pipeline: strategy.pipeline,
      warmUp: overrides?.warmUp,
    },
    strategy.guards ?? {},
    positionOptions,
    overrides?.fromState,
  );
}
