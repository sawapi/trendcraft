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
 * Create a Proxy-based indicators object that integrates with IndicatorCache.
 *
 * When a condition reads `indicators[key]`, the Proxy first checks the local object,
 * then the shared cache. When a condition writes `indicators[key] = value`,
 * the value is stored both locally and in the shared cache.
 *
 * @param candles - Candle array (used as cache identity key)
 * @param cache - Shared IndicatorCache instance (optional)
 * @returns Proxied indicators object
 */
export function createCachedIndicators(
  candles: object,
  cache?: IndicatorCache,
): Record<string, unknown> {
  const local: Record<string, unknown> = {};

  if (!cache) return local;

  return new Proxy(local, {
    get(target, prop: string) {
      // Check local first
      if (prop in target) return target[prop];

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
      cache.set(prop, candles, value);
      return true;
    },
  });
}
