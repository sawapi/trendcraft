/**
 * Multi-Symbol Relative Strength Ranking
 *
 * Compare multiple symbols and rank them by relative strength.
 * Useful for sector rotation and finding the strongest stocks.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle } from "../../types";

/**
 * Symbol RS ranking result
 */
export interface SymbolRSRank {
  /** Symbol identifier */
  symbol: string;
  /** RS value (performance ratio) */
  rs: number;
  /** Rank (1 = strongest) */
  rank: number;
  /** Percentile (0-100, 100 = strongest) */
  percentile: number;
  /** Performance % over the period */
  performance: number;
}

/**
 * Options for multi-symbol RS ranking
 */
export interface MultiRSOptions {
  /** Performance calculation period (default: 52) */
  period?: number;
}

/**
 * Rank multiple symbols by relative strength
 *
 * Calculates performance for each symbol and ranks them.
 * Useful for finding the strongest stocks in a sector or watchlist.
 *
 * @param symbolsData - Map of symbol name to candle data
 * @param options - Calculation options
 * @returns Array of ranked symbols (sorted by RS, strongest first)
 *
 * @example
 * ```ts
 * import { rankByRS } from 'trendcraft';
 *
 * const watchlist = new Map([
 *   ['AAPL', aaplCandles],
 *   ['GOOGL', googlCandles],
 *   ['MSFT', msftCandles],
 * ]);
 *
 * const ranked = rankByRS(watchlist, { period: 52 });
 *
 * console.log('Top performer:', ranked[0].symbol);
 * console.log('RS Rank:', ranked[0].rank);
 * ```
 */
export function rankByRS(
  symbolsData: Map<string, Candle[] | NormalizedCandle[]>,
  options: MultiRSOptions = {},
): SymbolRSRank[] {
  const { period = 52 } = options;

  if (period < 1) {
    throw new Error("RS period must be at least 1");
  }

  const results: {
    symbol: string;
    rs: number;
    performance: number;
  }[] = [];

  // Calculate RS for each symbol
  const entries = Array.from(symbolsData.entries());
  for (const [symbol, candles] of entries) {
    const normalized = isNormalized(candles)
      ? candles
      : normalizeCandles(candles);

    if (normalized.length <= period) {
      continue; // Skip if insufficient data
    }

    const current = normalized[normalized.length - 1];
    const past = normalized[normalized.length - 1 - period];

    const performance = ((current.close - past.close) / past.close) * 100;
    const rs = current.close / past.close;

    results.push({
      symbol,
      rs,
      performance,
    });
  }

  if (results.length === 0) {
    return [];
  }

  // Sort by RS (descending)
  results.sort((a, b) => b.rs - a.rs);

  // Assign ranks and percentiles
  const ranked: SymbolRSRank[] = results.map((r, index) => ({
    symbol: r.symbol,
    rs: r.rs,
    rank: index + 1,
    percentile: Math.round(
      ((results.length - index - 1) / (results.length - 1)) * 100,
    ),
    performance: r.performance,
  }));

  return ranked;
}

/**
 * Get top N strongest symbols
 *
 * @param symbolsData - Map of symbol name to candle data
 * @param n - Number of top symbols to return
 * @param options - Calculation options
 * @returns Top N symbols by RS
 */
export function topByRS(
  symbolsData: Map<string, Candle[] | NormalizedCandle[]>,
  n: number,
  options: MultiRSOptions = {},
): SymbolRSRank[] {
  const ranked = rankByRS(symbolsData, options);
  return ranked.slice(0, n);
}

/**
 * Get bottom N weakest symbols
 *
 * @param symbolsData - Map of symbol name to candle data
 * @param n - Number of bottom symbols to return
 * @param options - Calculation options
 * @returns Bottom N symbols by RS
 */
export function bottomByRS(
  symbolsData: Map<string, Candle[] | NormalizedCandle[]>,
  n: number,
  options: MultiRSOptions = {},
): SymbolRSRank[] {
  const ranked = rankByRS(symbolsData, options);
  return ranked.slice(-n).reverse();
}

/**
 * Filter symbols by RS percentile threshold
 *
 * @param symbolsData - Map of symbol name to candle data
 * @param minPercentile - Minimum percentile to include (default: 80)
 * @param options - Calculation options
 * @returns Symbols above the percentile threshold
 */
export function filterByRSPercentile(
  symbolsData: Map<string, Candle[] | NormalizedCandle[]>,
  minPercentile = 80,
  options: MultiRSOptions = {},
): SymbolRSRank[] {
  const ranked = rankByRS(symbolsData, options);
  return ranked.filter((r) => r.percentile >= minPercentile);
}

/**
 * Compare two symbols' relative strength
 *
 * @param symbol1 - First symbol candles
 * @param symbol2 - Second symbol candles
 * @param period - Performance period
 * @returns Positive if symbol1 is stronger, negative if symbol2 is stronger
 */
export function compareRS(
  symbol1: Candle[] | NormalizedCandle[],
  symbol2: Candle[] | NormalizedCandle[],
  period = 52,
): number {
  const norm1 = isNormalized(symbol1) ? symbol1 : normalizeCandles(symbol1);
  const norm2 = isNormalized(symbol2) ? symbol2 : normalizeCandles(symbol2);

  if (norm1.length <= period || norm2.length <= period) {
    return 0;
  }

  const rs1 = norm1[norm1.length - 1].close / norm1[norm1.length - 1 - period].close;
  const rs2 = norm2[norm2.length - 1].close / norm2[norm2.length - 1 - period].close;

  return rs1 - rs2;
}
