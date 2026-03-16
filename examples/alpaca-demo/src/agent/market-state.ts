/**
 * MarketState — tracks benchmark (SPY/QQQ) daily metrics for market filters
 *
 * Maintains real-time daily change %, trend direction, and volatility regime
 * for benchmark symbols. Strategies can reference this to conditionally
 * enable/disable entries based on broad market conditions.
 */

import type { MarketFilter } from "../strategy/template.js";

export type BenchmarkSnapshot = {
  symbol: string;
  /** First trade price of the day (proxy for open) */
  openPrice: number;
  /** Latest trade price */
  lastPrice: number;
  /** Daily change % = (last - open) / open * 100 */
  dailyChangePercent: number;
  /** Trend direction (from daily review market context, if available) */
  trendDirection?: "bullish" | "bearish" | "sideways";
  /** Volatility regime (from daily review market context, if available) */
  volatilityRegime?: "low" | "normal" | "high";
  /** Cumulative trade count for the session */
  tradeCount: number;
  /** Cumulative volume for the session */
  volume: number;
  /** Last updated timestamp */
  updatedAt: number;
};

export type MarketState = {
  /** Update with a new trade for a benchmark symbol */
  onTrade(symbol: string, price: number, timestamp: number, volume?: number): void;
  /** Set regime info (from daily review or startup) */
  setRegime(
    symbol: string,
    trend?: "bullish" | "bearish" | "sideways",
    volatility?: "low" | "normal" | "high",
  ): void;
  /** Get snapshot for a symbol */
  getSnapshot(symbol: string): BenchmarkSnapshot | undefined;
  /** Get all snapshots (for ticker display) */
  getAllSnapshots(): BenchmarkSnapshot[];
  /** Check if a market filter passes */
  checkFilter(filter: MarketFilter): { allowed: boolean; reason?: string };
  /** Reset daily state (call at market open) */
  resetDay(): void;
};

export function createMarketState(): MarketState {
  const snapshots = new Map<string, BenchmarkSnapshot>();

  return {
    onTrade(symbol, price, timestamp, volume) {
      const existing = snapshots.get(symbol);
      if (!existing) {
        snapshots.set(symbol, {
          symbol,
          openPrice: price,
          lastPrice: price,
          dailyChangePercent: 0,
          tradeCount: 1,
          volume: volume ?? 0,
          updatedAt: timestamp,
        });
      } else {
        existing.lastPrice = price;
        existing.dailyChangePercent = ((price - existing.openPrice) / existing.openPrice) * 100;
        existing.tradeCount++;
        existing.volume += volume ?? 0;
        existing.updatedAt = timestamp;
      }
    },

    setRegime(symbol, trend, volatility) {
      const existing = snapshots.get(symbol);
      if (existing) {
        if (trend) existing.trendDirection = trend;
        if (volatility) existing.volatilityRegime = volatility;
      }
    },

    getSnapshot(symbol) {
      return snapshots.get(symbol);
    },

    getAllSnapshots() {
      return Array.from(snapshots.values());
    },

    checkFilter(filter) {
      const symbol = filter.symbol ?? "SPY";
      const snap = snapshots.get(symbol);

      if (!snap) {
        // No data yet — allow trading (don't block on missing data)
        return { allowed: true };
      }

      if (filter.maxDailyChange != null && snap.dailyChangePercent > filter.maxDailyChange) {
        return {
          allowed: false,
          reason: `${symbol} daily change ${snap.dailyChangePercent.toFixed(2)}% > max ${filter.maxDailyChange}%`,
        };
      }

      if (filter.minDailyChange != null && snap.dailyChangePercent < filter.minDailyChange) {
        return {
          allowed: false,
          reason: `${symbol} daily change ${snap.dailyChangePercent.toFixed(2)}% < min ${filter.minDailyChange}%`,
        };
      }

      if (filter.allowedTrends && snap.trendDirection) {
        if (!filter.allowedTrends.includes(snap.trendDirection)) {
          return {
            allowed: false,
            reason: `${symbol} trend "${snap.trendDirection}" not in allowed [${filter.allowedTrends.join(", ")}]`,
          };
        }
      }

      if (filter.allowedVolatility && snap.volatilityRegime) {
        if (!filter.allowedVolatility.includes(snap.volatilityRegime)) {
          return {
            allowed: false,
            reason: `${symbol} volatility "${snap.volatilityRegime}" not in allowed [${filter.allowedVolatility.join(", ")}]`,
          };
        }
      }

      return { allowed: true };
    },

    resetDay() {
      snapshots.clear();
    },
  };
}
