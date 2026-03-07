/**
 * Strategy factory — creates ManagedSession from StrategyDefinition
 */

import { streaming, type NormalizedCandle } from "trendcraft";
import type { StrategyDefinition } from "./types.js";

export type CreateSessionOptions = {
  strategy: StrategyDefinition;
  capital?: number;
  warmUp?: NormalizedCandle[];
  fromState?: streaming.ManagedSessionState;
};

/**
 * Create a ManagedSession from a StrategyDefinition
 */
export function createSessionFromStrategy(
  opts: CreateSessionOptions,
): streaming.ManagedSession {
  const { strategy, capital, warmUp, fromState } = opts;

  const sessionOptions: streaming.SessionOptions = {
    intervalMs: strategy.intervalMs,
    pipeline: strategy.pipeline,
    warmUp,
  };

  const positionOptions: streaming.PositionManagerOptions = {
    ...strategy.position,
    ...(capital !== undefined ? { capital } : {}),
  };

  return streaming.createManagedSession(
    sessionOptions,
    strategy.guards,
    positionOptions,
    fromState,
  );
}
