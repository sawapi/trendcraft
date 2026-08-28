/**
 * ConditionRegistry — Central registry for condition name → factory + schema mapping.
 *
 * Maintains a Map of condition entries that can be used to:
 * - Hydrate ConditionSpec JSON into executable Condition instances
 * - List available conditions (optionally filtered by category)
 * - Validate condition specs against registered schemas
 *
 * @example
 * ```ts
 * import { ConditionRegistry, and, or, not, goldenCrossCondition, type Condition } from "trendcraft";
 *
 * const registry = new ConditionRegistry<Condition>();
 * registry.register({
 *   name: "goldenCross",
 *   displayName: "Golden Cross",
 *   category: "trend",
 *   params: {
 *     shortPeriod: { type: "number", default: 5, min: 1 },
 *     longPeriod: { type: "number", default: 25, min: 1 },
 *   },
 *   create: (p) => goldenCrossCondition(
 *     (p.shortPeriod as number) ?? 5,
 *     (p.longPeriod as number) ?? 25,
 *   ),
 * });
 *
 * const condition = registry.hydrate(
 *   { name: "goldenCross", params: { shortPeriod: 10 } },
 *   { and, or, not },
 * );
 * ```
 */

import type { ConditionCategory, ConditionRegistryEntry, ConditionSpec } from "./types";
import { describeType, isPlainObject } from "./utils";

/**
 * Central condition registry
 */
export class ConditionRegistry<T = unknown> {
  private entries = new Map<string, ConditionRegistryEntry<T>>();

  /**
   * Register a condition entry
   * @throws Error if a condition with the same name is already registered
   */
  register(entry: ConditionRegistryEntry<T>): void {
    if (this.entries.has(entry.name)) {
      throw new Error(`Condition "${entry.name}" is already registered`);
    }
    this.entries.set(entry.name, entry);
  }

  /**
   * Get a registered condition entry by name
   */
  get(name: string): ConditionRegistryEntry<T> | undefined {
    return this.entries.get(name);
  }

  /**
   * Check if a condition is registered
   */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /**
   * List all registered condition entries, optionally filtered by category
   */
  list(category?: ConditionCategory): ConditionRegistryEntry<T>[] {
    const all = [...this.entries.values()];
    if (category === undefined) return all;
    return all.filter((e) => e.category === category);
  }

  /**
   * Get all registered condition names
   */
  names(): string[] {
    return [...this.entries.keys()];
  }

  /**
   * Total number of registered conditions
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Hydrate a ConditionSpec into an executable condition.
   *
   * Recursively resolves combinators (and/or/not) using the provided
   * combinator functions.
   *
   * @param spec - The condition specification to hydrate
   * @param combinators - Functions for creating combined conditions
   * @returns The hydrated condition
   * @throws Error if a condition name is not registered
   */
  hydrate(
    spec: ConditionSpec,
    combinators: {
      and: (...conditions: T[]) => T;
      or: (...conditions: T[]) => T;
      not: (condition: T) => T;
    },
  ): T {
    // Same guard as the validator: `in` throws on a primitive or null, and
    // hydrate is reachable without validation via loadStrategy.
    if (!isPlainObject(spec)) {
      throw new Error(`Invalid condition spec: expected an object, got ${describeType(spec)}`);
    }

    // Combinator node
    if ("op" in spec) {
      const children = spec.conditions.map((c) => this.hydrate(c, combinators));
      switch (spec.op) {
        case "and":
          return combinators.and(...children);
        case "or":
          return combinators.or(...children);
        case "not":
          return combinators.not(children[0]);
      }
    }

    // Leaf node
    const entry = this.entries.get(spec.name);
    if (!entry) {
      throw new Error(`Unknown condition: "${spec.name}"`);
    }

    // A param the entry does not declare is a mistake, not a no-op. Dropping
    // it silently let a strategy tuned against one registry stream against
    // another with the tuning quietly discarded.
    // `key in entry.params` walks Object.prototype, so `toString` and
    // `constructor` would count as declared and be dropped silently — the
    // exact outcome this check exists to prevent.
    if (spec.params !== undefined && !isPlainObject(spec.params)) {
      throw new Error(
        `Invalid params for "${spec.name}": expected an object, got ${describeType(spec.params)}`,
      );
    }
    const undeclared = Object.keys(spec.params ?? {}).filter(
      (key) => !Object.hasOwn(entry.params, key),
    );
    if (undeclared.length > 0) {
      throw new Error(
        `Unknown parameter(s) for "${spec.name}": ${undeclared.join(", ")}. ` +
          `Accepted: ${Object.keys(entry.params).join(", ") || "(none)"}`,
      );
    }

    // Merge defaults with provided params
    const params: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(entry.params)) {
      if (spec.params?.[key] !== undefined) {
        params[key] = spec.params[key];
      } else if (def.default !== undefined) {
        params[key] = def.default;
      }
    }

    return entry.create(params);
  }
}
