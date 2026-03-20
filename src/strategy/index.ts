/**
 * Strategy Module
 *
 * Provides standard types and factory functions for defining
 * trading strategies that work across streaming and backtest contexts.
 *
 * Includes JSON serialization layer for strategy portability:
 * - ConditionSpec: Declarative JSON condition representation
 * - ConditionRegistry: Central registry for condition name → factory mapping
 * - StrategyJSON: Version-stamped strategy schema
 * - Hydration/Serialization/Validation utilities
 */

// Existing exports
export type { StrategyDefinition, SessionOverrides } from "./types";
export { createSessionFromStrategy } from "./factory";

// New: Strategy JSON Serialization types
export type {
  ConditionSpec,
  StrategyJSON,
  ParamDef,
  ConditionParamSchema,
  ConditionCategory,
  ConditionRegistryEntry,
} from "./types";

// New: Registry
export { ConditionRegistry } from "./registry";
export { backtestRegistry } from "./registry-backtest";
export { streamingRegistry } from "./registry-streaming";

// New: Hydration
export { hydrateCondition, loadStrategy } from "./hydrate";

// New: Serialization
export { serializeStrategy, parseStrategy } from "./serialize";

// New: Validation
export { validateConditionSpec, validateStrategyJSON } from "./validate";
export type { ValidationResult } from "./validate";
