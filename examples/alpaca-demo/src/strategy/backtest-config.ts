/**
 * Backtest config resolver — determines timeframe and period per strategy
 *
 * Uses strategy metadata if available, otherwise infers from intervalMs.
 */

import type { StrategyDefinition } from "trendcraft";
import type { AlpacaTimeframe } from "../alpaca/historical.js";

export type BacktestDataConfig = {
  timeframe: AlpacaTimeframe;
  periodDays: number;
};

/**
 * Resolve the backtest data config for a strategy.
 *
 * Priority: metadata > intervalMs-based inference
 */
export function resolveBacktestConfig(strategy: StrategyDefinition): BacktestDataConfig {
  const meta = strategy.metadata as
    | { backtestTimeframe?: AlpacaTimeframe; backtestPeriodDays?: number }
    | undefined;

  if (meta?.backtestTimeframe && meta?.backtestPeriodDays) {
    return { timeframe: meta.backtestTimeframe, periodDays: meta.backtestPeriodDays };
  }

  // Infer from intervalMs
  const ms = strategy.intervalMs;
  if (ms <= 60_000) {
    return { timeframe: "5Min", periodDays: 5 };
  }
  if (ms <= 3_600_000) {
    return { timeframe: "1Hour", periodDays: 90 };
  }
  return { timeframe: "1Day", periodDays: 180 };
}

/**
 * Group key for a BacktestDataConfig
 */
function configKey(config: BacktestDataConfig): string {
  return `${config.timeframe}:${config.periodDays}`;
}

export type StrategyGroup = {
  config: BacktestDataConfig;
  strategies: StrategyDefinition[];
};

/**
 * Group strategies by their resolved backtest config (timeframe + periodDays).
 *
 * @param strategies - All strategies to group
 * @param overrideConfig - If provided, all strategies use this config (CLI override)
 */
export function groupStrategiesByConfig(
  strategies: StrategyDefinition[],
  overrideConfig?: BacktestDataConfig,
): StrategyGroup[] {
  if (overrideConfig) {
    return [{ config: overrideConfig, strategies }];
  }

  const groups = new Map<string, StrategyGroup>();

  for (const strategy of strategies) {
    const config = resolveBacktestConfig(strategy);
    const key = configKey(config);
    const existing = groups.get(key);
    if (existing) {
      existing.strategies.push(strategy);
    } else {
      groups.set(key, { config, strategies: [strategy] });
    }
  }

  return [...groups.values()];
}
