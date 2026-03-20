/**
 * Hydration — Convert ConditionSpec JSON into executable Conditions
 *
 * @example
 * ```ts
 * import { hydrateCondition, loadStrategy, backtestRegistry } from "trendcraft";
 * import { and, or, not } from "trendcraft";
 *
 * // Hydrate a single condition
 * const condition = hydrateCondition(
 *   { name: "goldenCross", params: { shortPeriod: 10 } },
 *   backtestRegistry,
 * );
 *
 * // Load a full strategy
 * const { entry, exit, backtestOptions } = loadStrategy(strategyJson, backtestRegistry);
 * const result = runBacktest(candles, entry, exit, backtestOptions);
 * ```
 */

import { and, not, or } from "../backtest/conditions/core";
import type { BacktestOptions, Condition } from "../types";
import type { ConditionRegistry } from "./registry";
import type { ConditionSpec, StrategyJSON } from "./types";

/**
 * Hydrate a ConditionSpec into an executable backtest Condition.
 *
 * Recursively resolves combinators (and/or/not) and leaf conditions
 * via the provided registry.
 *
 * @param spec - The condition specification (JSON-safe)
 * @param registry - Registry to look up condition factories
 * @returns Executable Condition
 * @throws Error if a condition name is not found in the registry
 *
 * @example
 * ```ts
 * const condition = hydrateCondition(
 *   { op: "and", conditions: [
 *     { name: "goldenCross" },
 *     { name: "rsiBelow", params: { threshold: 30 } },
 *   ]},
 *   backtestRegistry,
 * );
 * ```
 */
export function hydrateCondition(
  spec: ConditionSpec,
  registry: ConditionRegistry<Condition>,
): Condition {
  return registry.hydrate(spec, { and, or, not });
}

/**
 * Load a StrategyJSON into executable conditions and backtest options.
 *
 * @param strategy - The strategy JSON object
 * @param registry - Condition registry (defaults to backtestRegistry)
 * @returns Object with hydrated entry/exit conditions and backtest options
 *
 * @example
 * ```ts
 * const { entry, exit, backtestOptions, metadata } = loadStrategy(json, backtestRegistry);
 * const result = runBacktest(candles, entry, exit, { capital: 1_000_000, ...backtestOptions });
 * ```
 */
export function loadStrategy(
  strategy: StrategyJSON,
  registry: ConditionRegistry<Condition>,
): {
  entry: Condition;
  exit: Condition;
  backtestOptions: Partial<BacktestOptions>;
  metadata?: Record<string, unknown>;
} {
  const entry = hydrateCondition(strategy.entry, registry);
  const exit = hydrateCondition(strategy.exit, registry);

  const backtestOptions: Partial<BacktestOptions> = {};
  if (strategy.backtest) {
    const b = strategy.backtest;
    if (b.capital !== undefined) backtestOptions.capital = b.capital;
    if (b.direction !== undefined) backtestOptions.direction = b.direction;
    if (b.stopLoss !== undefined) backtestOptions.stopLoss = b.stopLoss;
    if (b.takeProfit !== undefined) backtestOptions.takeProfit = b.takeProfit;
    if (b.trailingStop !== undefined) backtestOptions.trailingStop = b.trailingStop;
    if (b.commission !== undefined) backtestOptions.commission = b.commission;
    if (b.commissionRate !== undefined) backtestOptions.commissionRate = b.commissionRate;
    if (b.slippage !== undefined) backtestOptions.slippage = b.slippage;
    if (b.fillMode !== undefined) backtestOptions.fillMode = b.fillMode;
  }

  return { entry, exit, backtestOptions, metadata: strategy.metadata };
}
