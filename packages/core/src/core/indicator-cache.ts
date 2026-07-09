/**
 * Indicator Cache
 *
 * Caches indicator computations across multiple backtest runs on the same candle data.
 * Used by optimization functions (grid search, walk-forward, combination search) to avoid
 * redundant indicator recalculations.
 *
 * Uses WeakMap keyed by candle array reference so cached data is automatically
 * garbage-collected when the candle data goes out of scope.
 */

/**
 * Cache for indicator computations
 *
 * @example
 * ```ts
 * const cache = new IndicatorCache();
 * // First backtest: indicators are computed and cached
 * runBacktest(candles, entry, exit, { capital: 100000 }, cache);
 * // Second backtest: cached indicators are reused
 * runBacktest(candles, entry, exit, { capital: 100000 }, cache);
 * ```
 */
export class IndicatorCache {
  private cache = new Map<string, WeakMap<object, unknown>>();

  /**
   * Get a cached indicator value
   * @param key - Indicator cache key (e.g., "sma_25", "rsi_14")
   * @param candles - Candle array reference used as identity key
   * @returns Cached value or undefined
   */
  get<T>(key: string, candles: object): T | undefined {
    const weakMap = this.cache.get(key);
    if (!weakMap) return undefined;
    return weakMap.get(candles) as T | undefined;
  }

  /**
   * Store an indicator value in cache
   * @param key - Indicator cache key
   * @param candles - Candle array reference
   * @param value - Computed indicator value
   */
  set<T>(key: string, candles: object, value: T): void {
    let weakMap = this.cache.get(key);
    if (!weakMap) {
      weakMap = new WeakMap();
      this.cache.set(key, weakMap);
    }
    weakMap.set(candles, value);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of unique indicator keys cached
   */
  get size(): number {
    return this.cache.size;
  }
}

/**
 * Keys with this prefix are run-local by convention: `createCachedIndicators`
 * never reads them from or writes them to the shared {@link IndicatorCache},
 * regardless of the `localOnlyKeys` set. Use it for mutable per-run state a
 * condition keeps on the indicators object — such state is not a pure function
 * of the candle array, so sharing it through the cache would leak one run's
 * end state into the next run on the same candles.
 */
export const RUN_LOCAL_KEY_PREFIX = "__runLocal_";

/**
 * Create a Proxy-based indicators object that integrates with IndicatorCache.
 *
 * When a condition reads `indicators[key]`, the Proxy first checks the local object,
 * then the shared cache. When a condition writes `indicators[key] = value`,
 * the value is stored both locally and in the shared cache.
 *
 * Only values that are a pure function of the candle array may live in the
 * shared cache. Two escape hatches keep everything else run-local:
 * {@link RUN_LOCAL_KEY_PREFIX} (convention, for per-run mutable state) and
 * `localOnlyKeys` (exact names, for per-run inputs like the RS benchmark).
 *
 * @param candles - Candle array (used as cache identity key)
 * @param cache - Shared IndicatorCache instance (optional)
 * @param localOnlyKeys - Keys that are run-local inputs rather than candle-derived
 *   computations (e.g. the RS benchmark). Kept on the local object and never
 *   read from or written to the shared cache — otherwise they would leak into
 *   later runs that reuse the same cache and candles.
 * @returns Proxied indicators object
 */
export function createCachedIndicators(
  candles: object,
  cache?: IndicatorCache,
  localOnlyKeys?: ReadonlySet<string>,
): Record<string, unknown> {
  const local: Record<string, unknown> = {};

  if (!cache) return local;

  const isRunLocal = (prop: string) =>
    prop.startsWith(RUN_LOCAL_KEY_PREFIX) || localOnlyKeys?.has(prop) === true;

  return new Proxy(local, {
    get(target, prop: string) {
      // Check local first
      if (prop in target) return target[prop];

      // Run-local inputs/state are never shared via the cache
      if (isRunLocal(prop)) return undefined;

      // Then check shared cache
      const cached = cache.get(prop, candles);
      if (cached !== undefined) {
        target[prop] = cached;
        return cached;
      }

      return undefined;
    },
    set(target, prop: string, value) {
      target[prop] = value;
      if (!isRunLocal(prop)) {
        cache.set(prop, candles, value);
      }
      return true;
    },
  });
}
