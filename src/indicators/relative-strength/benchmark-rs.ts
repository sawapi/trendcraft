/**
 * Benchmark Relative Strength (RS)
 *
 * Compares a stock's performance against a market benchmark (e.g., S&P 500, Nikkei 225).
 * Useful for swing traders to identify stocks outperforming the market.
 */

import { sma } from "../moving-average/sma";
import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Relative Strength value
 */
export interface RSValue {
  /** Raw RS ratio (stock performance / benchmark performance) */
  rs: number;
  /** RS Rating: percentile rank 0-100 (100 = strongest) */
  rsRating: number | null;
  /** RS trend direction */
  trend: "up" | "down" | "flat";
  /** Mansfield RS: deviation from SMA of RS line */
  mansfieldRS: number | null;
  /** Performance vs benchmark (positive = outperforming) */
  outperformance: number;
}

/**
 * Options for benchmark RS calculation
 */
export interface BenchmarkRSOptions {
  /** Period for performance calculation (default: 52 for weekly, 252 for daily) */
  period?: number;
  /** Period for RS SMA (for Mansfield RS calculation, default: 52) */
  smaPeriod?: number;
  /** Lookback for percentile ranking (default: 252) */
  rankingLookback?: number;
  /** Threshold for flat trend detection (default: 0.01 = 1%) */
  flatThreshold?: number;
}

/**
 * Calculate Benchmark Relative Strength
 *
 * RS = (Stock Price / Stock Price N days ago) / (Benchmark / Benchmark N days ago)
 *
 * @param candles - Stock price data
 * @param benchmark - Benchmark (index) price data
 * @param options - Calculation options
 * @returns Series of RS values
 *
 * @example
 * ```ts
 * import { benchmarkRS } from 'trendcraft';
 *
 * // Compare stock against market index
 * const rs = benchmarkRS(stockCandles, sp500Candles, { period: 52 });
 *
 * // Find outperforming stocks
 * const latest = rs[rs.length - 1];
 * if (latest.value.rsRating > 80 && latest.value.trend === 'up') {
 *   console.log('Strong relative strength!');
 * }
 * ```
 */
export function benchmarkRS(
  candles: Candle[] | NormalizedCandle[],
  benchmark: Candle[] | NormalizedCandle[],
  options: BenchmarkRSOptions = {},
): Series<RSValue> {
  const {
    period = 52,
    smaPeriod = 52,
    rankingLookback = 252,
    flatThreshold = 0.01,
  } = options;

  if (period < 1) {
    throw new Error("RS period must be at least 1");
  }

  const stockNorm = isNormalized(candles) ? candles : normalizeCandles(candles);
  const benchNorm = isNormalized(benchmark)
    ? benchmark
    : normalizeCandles(benchmark);

  // Align data by timestamp
  const alignedData = alignByTime(stockNorm, benchNorm);

  if (alignedData.length <= period) {
    return [];
  }

  // Calculate raw RS line
  const rsLine: { time: number; rs: number }[] = [];

  for (let i = period; i < alignedData.length; i++) {
    const current = alignedData[i];
    const past = alignedData[i - period];

    const stockReturn = current.stockClose / past.stockClose;
    const benchReturn = current.benchClose / past.benchClose;

    const rs = benchReturn !== 0 ? stockReturn / benchReturn : 1;

    rsLine.push({
      time: current.time,
      rs,
    });
  }

  // Calculate RS SMA for Mansfield RS
  const rsAsCandles = rsLine.map((r) => ({
    time: r.time,
    open: r.rs,
    high: r.rs,
    low: r.rs,
    close: r.rs,
    volume: 0,
  }));

  const rsSma = sma(rsAsCandles, { period: smaPeriod });

  // Build result series
  const results: Series<RSValue> = [];
  const rsValues: number[] = [];

  for (let i = 0; i < rsLine.length; i++) {
    const { time, rs } = rsLine[i];

    // Track RS values for percentile ranking
    rsValues.push(rs);

    // Calculate RS Rating (percentile rank)
    let rsRating: number | null = null;
    if (rsValues.length >= Math.min(rankingLookback, 20)) {
      const lookback = Math.min(rsValues.length, rankingLookback);
      const recentValues = rsValues.slice(-lookback);
      const sortedValues = [...recentValues].sort((a, b) => a - b);
      const rank = sortedValues.findIndex((v) => v >= rs);
      rsRating = Math.round((rank / (sortedValues.length - 1)) * 100);
    }

    // Calculate Mansfield RS (deviation from SMA)
    let mansfieldRS: number | null = null;
    const smaValue = rsSma[i]?.value;
    if (smaValue !== null && smaValue !== undefined && smaValue !== 0) {
      mansfieldRS = ((rs - smaValue) / smaValue) * 100;
    }

    // Determine trend
    let trend: "up" | "down" | "flat" = "flat";
    if (i >= 1) {
      const prevRS = rsLine[i - 1].rs;
      const change = (rs - prevRS) / prevRS;
      if (change > flatThreshold) {
        trend = "up";
      } else if (change < -flatThreshold) {
        trend = "down";
      }
    }

    // Calculate outperformance (how much stock beat benchmark)
    const outperformance = (rs - 1) * 100;

    results.push({
      time,
      value: {
        rs,
        rsRating,
        trend,
        mansfieldRS,
        outperformance,
      },
    });
  }

  return results;
}

/**
 * Align stock and benchmark data by timestamp
 */
function alignByTime(
  stock: NormalizedCandle[],
  benchmark: NormalizedCandle[],
): { time: number; stockClose: number; benchClose: number }[] {
  const benchMap = new Map<number, number>();
  for (const b of benchmark) {
    benchMap.set(b.time, b.close);
  }

  const aligned: { time: number; stockClose: number; benchClose: number }[] =
    [];

  for (const s of stock) {
    const benchClose = benchMap.get(s.time);
    if (benchClose !== undefined) {
      aligned.push({
        time: s.time,
        stockClose: s.close,
        benchClose,
      });
    }
  }

  return aligned;
}

/**
 * Calculate RS Rating only (simplified version)
 *
 * @param candles - Stock price data
 * @param benchmark - Benchmark price data
 * @param period - Performance period
 * @returns RS Rating (0-100) or null if insufficient data
 */
export function calculateRSRating(
  candles: Candle[] | NormalizedCandle[],
  benchmark: Candle[] | NormalizedCandle[],
  period = 52,
): number | null {
  const rs = benchmarkRS(candles, benchmark, { period });
  if (rs.length === 0) return null;
  return rs[rs.length - 1].value.rsRating;
}

/**
 * Check if stock is outperforming benchmark
 *
 * @param candles - Stock price data
 * @param benchmark - Benchmark price data
 * @param period - Performance period
 * @param minOutperformance - Minimum outperformance % (default: 0)
 * @returns true if outperforming by at least minOutperformance %
 */
export function isOutperforming(
  candles: Candle[] | NormalizedCandle[],
  benchmark: Candle[] | NormalizedCandle[],
  period = 52,
  minOutperformance = 0,
): boolean {
  const rs = benchmarkRS(candles, benchmark, { period });
  if (rs.length === 0) return false;
  return rs[rs.length - 1].value.outperformance >= minOutperformance;
}
