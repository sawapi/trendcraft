/**
 * File-based historical data cache
 *
 * Caches Alpaca bar data to reduce API calls and speed up development.
 * Cache key: {symbol}_{timeframe}_{start}_{end}
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import type { NormalizedCandle } from "trendcraft";
import type { AlpacaEnv } from "../config/env.js";
import type { FetchBarsOptions } from "./historical.js";
import { fetchHistoricalBars } from "./historical.js";

const CACHE_DIR = resolve(import.meta.dirname, "../../data/cache");

function getCacheKey(opts: FetchBarsOptions): string {
  const end = opts.end ?? "latest";
  const limit = opts.limit ?? "all";
  return `${opts.symbol}_${opts.timeframe}_${opts.start}_${end}_${limit}`;
}

function getCachePath(key: string): string {
  return resolve(CACHE_DIR, `${key}.json`);
}

/**
 * Fetch historical bars with file-based caching
 */
export async function fetchCachedBars(
  env: AlpacaEnv,
  opts: FetchBarsOptions,
): Promise<NormalizedCandle[]> {
  mkdirSync(CACHE_DIR, { recursive: true });

  const key = getCacheKey(opts);
  const path = getCachePath(key);

  // Check cache
  if (existsSync(path)) {
    try {
      const cached = JSON.parse(readFileSync(path, "utf-8")) as {
        cachedAt: number;
        candles: NormalizedCandle[];
      };

      // Cache valid for 24 hours (or indefinitely for historical data with fixed end date)
      const maxAge = opts.end ? Number.POSITIVE_INFINITY : 24 * 60 * 60 * 1000;
      if (Date.now() - cached.cachedAt < maxAge) {
        console.log(
          `[CACHE] Hit: ${opts.symbol} ${opts.timeframe} (${cached.candles.length} candles)`,
        );
        return cached.candles;
      }
    } catch {
      // Corrupted cache file, re-fetch
    }
  }

  // Fetch from API
  const candles = await fetchHistoricalBars(env, opts);

  // Save to cache
  try {
    writeFileSync(path, JSON.stringify({ cachedAt: Date.now(), candles }, null, 2), "utf-8");
    console.log(`[CACHE] Saved: ${opts.symbol} ${opts.timeframe} (${candles.length} candles)`);
  } catch (err) {
    console.warn(`[CACHE] Failed to save: ${err}`);
  }

  return candles;
}

/**
 * Clear all cached data
 */
export function clearCache(): void {
  if (!existsSync(CACHE_DIR)) return;

  const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    unlinkSync(resolve(CACHE_DIR, file));
  }
  console.log(`[CACHE] Cleared ${files.length} cached file(s)`);
}
