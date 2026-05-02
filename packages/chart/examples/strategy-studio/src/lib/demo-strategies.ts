import type { StrategyJSON } from "trendcraft";

/**
 * Three baseline strategies the rotation panel runs against the same candle
 * slice so the user can see meaningful allocation differences without having
 * to compose multiple strategies in StrategyBuilder.
 *
 * All conditions resolve through `backtestRegistry` so the JSON round-trips
 * cleanly through `parseStrategy` / `loadStrategy` (see lib/strategy-state).
 */

export const GOLDEN_CROSS_STRATEGY: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "demo-golden-cross",
  name: "Golden Cross 5/25",
  entry: { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
  exit: { name: "deadCross", params: { shortPeriod: 5, longPeriod: 25 } },
  backtest: { capital: 100_000 },
};

export const MEAN_REVERSION_STRATEGY: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "demo-mean-reversion",
  name: "RSI Mean Reversion",
  entry: { name: "rsiBelow", params: { threshold: 30, period: 14 } },
  exit: { name: "rsiAbove", params: { threshold: 60, period: 14 } },
  backtest: { capital: 100_000 },
};

export const BUY_AND_HOLD_STRATEGY: StrategyJSON = {
  $schema: "trendcraft/strategy",
  version: 1,
  id: "demo-buy-and-hold",
  name: "Buy and Hold",
  entry: { name: "alwaysTrue" },
  exit: { name: "alwaysFalse" },
  backtest: { capital: 100_000 },
};

export const DEMO_STRATEGIES: ReadonlyArray<StrategyJSON> = [
  GOLDEN_CROSS_STRATEGY,
  MEAN_REVERSION_STRATEGY,
  BUY_AND_HOLD_STRATEGY,
];
