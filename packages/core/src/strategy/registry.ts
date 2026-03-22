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
 * import { ConditionRegistry } from "trendcraft";
 *
 * const registry = new ConditionRegistry();
 * registry.register({
 *   name: "goldenCross",
 *   displayName: "Golden Cross",
 *   category: "trend",
 *   params: {
 *     shortPeriod: { type: "number", default: 5, min: 1 },
 *     longPeriod: { type: "number", default: 25, min: 1 },
 *   },
 *   create: (p) => goldenCross(
 *     (p.shortPeriod as number) ?? 5,
 *     (p.longPeriod as number) ?? 25,
 *   ),
 * });
 *
 * const condition = registry.hydrate({ name: "goldenCross", params: { shortPeriod: 10 } });
 * ```
 */

import type { ConditionCategory, ConditionRegistryEntry, ConditionSpec } from "./types";

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
