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

export { createSessionFromStrategy } from "./factory";
// New: Hydration
export { hydrateCondition, loadStrategy } from "./hydrate";
// New: Registry
export { ConditionRegistry } from "./registry";
export { backtestRegistry } from "./registry-backtest";
export { streamingRegistry } from "./registry-streaming";
// New: Serialization
export { parseStrategy, parseStrategySafe, serializeStrategy } from "./serialize";
export type { Tunable } from "./tunables";
// Strategy tunables — enumerate numeric registry-declared params for
// optimization / range editors. Mirrors the introspection surface
// exposed by TA-Lib / freqtrade / Pine Script.
export { listTunables } from "./tunables";
// Existing exports
// New: Strategy JSON Serialization types
export type {
  ConditionCategory,
  ConditionParamSchema,
  ConditionRegistryEntry,
  ConditionSpec,
  ParamDef,
  SessionOverrides,
  StrategyDefinition,
  StrategyJSON,
} from "./types";
export type { ValidationResult } from "./validate";
// New: Validation
export { validateConditionSpec, validateStrategyJSON } from "./validate";
export type { LeafInfo, ParsedLeafPath } from "./walker";
// New: Walker — pure utilities for inspecting / rewriting StrategyJSON shapes
export { applyParamOverrides, flattenStrategyLeaves, parseLeafPath } from "./walker";
