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
  /** Additional backtest options (capital is excluded — specify it at runBacktest call site) */
  backtestOptions?: Omit<Partial<BacktestOptions>, "capital">;

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
  /** Restore from a previously saved session state */
  fromState?: import("../streaming/position-manager/types").ManagedSessionState;
};

// ============================================
// Strategy JSON Serialization Types
// ============================================

/**
 * Parameter definition for a condition parameter (lightweight, no external deps)
 */
export type ParamDef = {
  /** Parameter type */
  type: "number" | "string" | "boolean";
  /** Default value */
  default?: unknown;
  /** Human-readable description */
  description?: string;
  /** Minimum value (for numbers) */
  min?: number;
  /** Maximum value (for numbers) */
  max?: number;
  /** Allowed values */
  enum?: unknown[];
  /** Whether this parameter is required (default: false) */
  required?: boolean;
};

/**
 * Schema for a condition's parameters
 */
export type ConditionParamSchema = Record<string, ParamDef>;

/**
 * Condition category for organizing conditions in UI/docs
 */
export type ConditionCategory =
  | "trend"
  | "momentum"
  | "volume"
  | "volatility"
  | "pattern"
  | "smc"
  | "range"
  | "fundamental";

/**
 * Registry entry for a single condition
 */
export type ConditionRegistryEntry<T = unknown> = {
  /** Unique condition name (used in JSON specs) */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Category for grouping */
  category?: ConditionCategory;
  /** Parameter schema */
  params: ConditionParamSchema;
  /** Factory function that creates a condition from parameters */
  create: (params: Record<string, unknown>) => T;
  /** Whether this is a filter condition (vs. entry/exit signal) */
  isFilter?: boolean;
};

/**
 * JSON-serializable condition specification
 *
 * Can be either a leaf condition (with name + params)
 * or a combinator (and/or/not) with nested conditions.
 *
 * @example
 * ```ts
 * // Leaf condition
 * const spec: ConditionSpec = { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } };
 *
 * // Combinator
 * const spec: ConditionSpec = {
 *   op: "and",
 *   conditions: [
 *     { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
 *     { name: "rsiBelow", params: { threshold: 30 } },
 *   ],
 * };
 * ```
 */
export type ConditionSpec =
  | { name: string; params?: Record<string, unknown> }
  | { op: "and" | "or" | "not"; conditions: ConditionSpec[] };

/**
 * JSON-serializable strategy definition
 *
 * This is the serializable counterpart of StrategyDefinition.
 * It uses ConditionSpec (declarative JSON) instead of function references.
 *
 * @example
 * ```ts
 * const strategy: StrategyJSON = {
 *   $schema: "trendcraft/strategy",
 *   version: 1,
 *   id: "my-strategy",
 *   name: "Golden Cross + RSI",
 *   entry: { op: "and", conditions: [
 *     { name: "goldenCross", params: { shortPeriod: 5, longPeriod: 25 } },
 *     { name: "rsiBelow", params: { threshold: 30 } },
 *   ]},
 *   exit: { name: "rsiAbove", params: { threshold: 70 } },
 * };
 * ```
 */
export type StrategyJSON = {
  /** Schema identifier */
  $schema: "trendcraft/strategy";
  /** Schema version */
  version: 1;
  /** Unique strategy identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Optional description */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Entry condition specification */
  entry: ConditionSpec;
  /** Exit condition specification */
  exit: ConditionSpec;
  /** Backtest configuration */
  backtest?: {
    capital?: number;
    direction?: "long" | "short";
    stopLoss?: number;
    takeProfit?: number;
    trailingStop?: number;
    commission?: number;
    commissionRate?: number;
    slippage?: number;
    fillMode?: "same-bar-close" | "next-bar-open";
  };
  /** Custom metadata */
  metadata?: Record<string, unknown>;
};
