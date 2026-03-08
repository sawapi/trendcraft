/**
 * Strategy Definition Types
 *
 * Standard type for defining a complete trading strategy that can be used
 * in both live streaming and backtesting contexts.
 *
 * @example
 * ```ts
 * import { type StrategyDefinition, createSessionFromStrategy } from "trendcraft";
 * import * as inc from "trendcraft/incremental";
 *
 * const strategy: StrategyDefinition = {
 *   id: "rsi-mean-reversion",
 *   name: "RSI Mean Reversion",
 *   description: "Buy oversold, sell overbought",
 *   intervalMs: 60_000,
 *   symbols: ["AAPL", "MSFT"],
 *   pipeline: {
 *     indicators: [{ name: "rsi", create: () => inc.createRsi({ period: 14 }) }],
 *     entry: streaming.rsiBelow(30),
 *     exit: streaming.rsiAbove(70),
 *   },
 *   guards: { riskGuard: { maxDailyLoss: -5000 } },
 *   position: { capital: 100_000, stopLoss: 2 },
 * };
 *
 * const session = createSessionFromStrategy(strategy);
 * ```
 */

import type { SignalManagerOptions } from "../signals/lifecycle/types";
import type { RiskGuardOptions, TimeGuardOptions } from "../streaming/guards/types";
import type {
  PositionManagerOptions,
  PositionSizingConfig,
} from "../streaming/position-manager/types";
import type { PipelineOptions, StreamingCondition } from "../streaming/types";
import type { BacktestOptions, Condition } from "../types";

/**
 * Complete strategy definition for both live and backtest use
 */
export type StrategyDefinition = {
  /** Unique strategy identifier */
  id: string;
  /** Human-readable strategy name */
  name: string;
  /** Optional description */
  description?: string;
  /** Candle interval in milliseconds */
  intervalMs: number;
  /** Target symbols/instruments */
  symbols: string[];

  // ---- Streaming (live) configuration ----

  /** Pipeline configuration (indicators + streaming conditions) */
  pipeline: PipelineOptions;
  /** Guard configuration */
  guards?: {
    riskGuard?: RiskGuardOptions;
    timeGuard?: TimeGuardOptions;
  };
  /** Position management configuration */
  position: PositionManagerOptions;
  /** Signal lifecycle configuration */
  signalLifecycle?: SignalManagerOptions;

  // ---- Backtest configuration ----

  /** Entry condition for backtesting */
  backtestEntry?: Condition;
  /** Exit condition for backtesting */
  backtestExit?: Condition;
  /** Additional backtest options */
  backtestOptions?: Partial<BacktestOptions>;

  // ---- Metadata ----

  /** Strategy version for tracking changes */
  version?: string;
  /** Strategy tags for categorization */
  tags?: string[];
  /** Custom metadata */
  metadata?: Record<string, unknown>;
};

/**
 * Overrides when creating a session from a strategy
 */
export type SessionOverrides = {
  /** Override initial capital */
  capital?: number;
  /** Override position sizing */
  sizing?: PositionSizingConfig;
  /** Override stop loss */
  stopLoss?: number;
  /** Override take profit */
  takeProfit?: number;
  /** Historical candles for warming up indicators */
  warmUp?: import("../types").NormalizedCandle[];
};
