/**
 * Strategy definition types
 *
 * A StrategyDefinition provides both streaming (live) and batch (backtest)
 * configurations in a single unified object.
 */

import type { BacktestOptions, Condition, streaming } from "trendcraft";

/**
 * Unified strategy definition for both live and backtest modes
 */
export type StrategyDefinition = {
  /** Unique strategy identifier (e.g., "rsi-mean-reversion") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of the strategy logic */
  description: string;
  /** Candle interval in milliseconds (e.g., 60_000 = 1-minute) */
  intervalMs: number;
  /** Default target symbols */
  symbols: string[];

  /** Streaming pipeline configuration (for live trading) */
  pipeline: streaming.PipelineOptions;
  /** Guard configuration (risk + time management) */
  guards: streaming.GuardedSessionOptions;
  /** Position management configuration */
  position: streaming.PositionManagerOptions;

  /** Backtest-specific adapter */
  backtestAdapter: {
    entryCondition: Condition;
    exitCondition: Condition;
    options: Omit<BacktestOptions, "capital">;
  };
};
