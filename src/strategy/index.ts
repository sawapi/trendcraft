/**
 * Strategy Module
 *
 * Provides standard types and factory functions for defining
 * trading strategies that work across streaming and backtest contexts.
 */

export type { StrategyDefinition, SessionOverrides } from "./types";
export { createSessionFromStrategy } from "./factory";
