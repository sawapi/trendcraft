/**
 * Pre-market symbol scanner
 *
 * Scans a universe of symbols using trendcraft indicators (ATR%, RSI, volume)
 * to rank and filter candidates for trading.
 */

import type { NormalizedCandle } from "trendcraft";
import { atr, rsi } from "trendcraft";
import { fetchCachedBars } from "../alpaca/cache.js";
import { today } from "../alpaca/historical.js";
import type { AlpacaEnv } from "../config/env.js";
import { loadFundamentalsCache } from "../sec/fundamentals-cache.js";
import { computeRatios } from "../sec/fundamentals.js";
import type { CompanyFundamentals, FundamentalFilters, FundamentalRatios } from "../sec/types.js";
import type { ScanCandidate, ScanResult, ScannerOptions } from "./types.js";

const DEFAULT_OPTIONS: Required<ScannerOptions> = {
  minAtrPercent: 1.0,
  rsiRange: [0, 100],
  minVolumeRatio: 0.5,
  top: 10,
  lookbackDays: 250,
  concurrency: 5,
  fundamentals: undefined as unknown as ScannerOptions["fundamentals"] & {},
};

type AnalysisResult = {
  symbol: string;
  price: number;
  atrPercent: number;
  rsi14: number | null;
  volumeRatio: number;
};

/**
 * Analyze a single symbol's candles for scanning metrics
 */
function analyzeSymbol(symbol: string, candles: NormalizedCandle[]): AnalysisResult | null {
  if (candles.length < 20) return null;

  const lastCandle = candles[candles.length - 1];
  const price = lastCandle.close;

  // ATR% — ATR(14) / close * 100
  const atrSeries = atr(candles, { period: 14 });
  const lastAtr = atrSeries.length > 0 ? atrSeries[atrSeries.length - 1].value : null;
  if (lastAtr == null) return null;
  const atrPercent = (lastAtr / price) * 100;

  // RSI(14)
  const rsiSeries = rsi(candles, { period: 14 });
  const rsi14 = rsiSeries.length > 0 ? rsiSeries[rsiSeries.length - 1].value : null;

  // Volume ratio — current volume / average volume (last 20 bars)
  const volPeriod = Math.min(20, candles.length);
  const recentCandles = candles.slice(-volPeriod);
  const avgVol = recentCandles.reduce((sum, c) => sum + c.volume, 0) / volPeriod;
  const currentVol = lastCandle.volume;
  const volumeRatio = avgVol > 0 ? currentVol / avgVol : 1.0;

  return { symbol, price, atrPercent, rsi14, volumeRatio };
}

/**
 * Calculate composite ranking score (0-100)
 *
 * Weights:
 * - ATR% (moderate volatility preferred): 40%
 * - Volume ratio (higher = more active): 30%
 * - RSI neutrality (closer to 50 = better): 30%
 */
function calculateScore(analysis: AnalysisResult): number {
  // ATR% score: bell curve peaking around 2-3%, penalize extremes
  const idealAtr = 2.5;
  const atrDist = Math.abs(analysis.atrPercent - idealAtr);
  const atrScore = Math.max(0, 100 - atrDist * 20);

  // Volume ratio score: capped at 100
  const volScore = Math.min(100, analysis.volumeRatio * 50);

  // RSI neutrality score: 50 = best, 0/100 = worst
  const rsiVal = analysis.rsi14 ?? 50;
  const rsiDist = Math.abs(rsiVal - 50);
  const rsiScore = Math.max(0, 100 - rsiDist * 2);

  return atrScore * 0.4 + volScore * 0.3 + rsiScore * 0.3;
}

/**
 * Run concurrent tasks with a concurrency limit
 */
async function withConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Scan a universe of symbols and return ranked candidates
 */
export async function scanUniverse(
  env: AlpacaEnv,
  symbols: string[],
  universeName: string,
  opts?: ScannerOptions,
): Promise<ScanResult> {
  const config = { ...DEFAULT_OPTIONS, ...opts };
  const startTime = Date.now();

  // Calculate lookback start date
  const lookbackMs = config.lookbackDays * 24 * 60 * 60 * 1000;
  const startDate = new Date(Date.now() - lookbackMs).toISOString().slice(0, 10);

  console.log(`[SCAN] Scanning ${universeName} (${symbols.length} symbols)...`);

  const skipped: Array<{ symbol: string; reason: string }> = [];
  const candidates: ScanCandidate[] = [];

  type FetchResult = { symbol: string; candles: NormalizedCandle[] | null; error?: string };

  const fetchResults = await withConcurrency<string, FetchResult>(
    symbols,
    config.concurrency,
    async (symbol) => {
      try {
        const candles = await fetchCachedBars(env, {
          symbol,
          timeframe: "1Day",
          start: startDate,
          end: today(),
          limit: config.lookbackDays + 10,
        });
        return { symbol, candles };
      } catch (err) {
        return { symbol, candles: null, error: String(err) };
      }
    },
  );

  for (const result of fetchResults) {
    if (!result.candles) {
      skipped.push({ symbol: result.symbol, reason: result.error ?? "fetch failed" });
      continue;
    }

    const analysis = analyzeSymbol(result.symbol, result.candles);
    if (!analysis) {
      skipped.push({ symbol: result.symbol, reason: "insufficient data" });
      continue;
    }

    // Apply filters
    if (analysis.atrPercent < config.minAtrPercent) {
      skipped.push({
        symbol: result.symbol,
        reason: `ATR% ${analysis.atrPercent.toFixed(1)}% < ${config.minAtrPercent}%`,
      });
      continue;
    }

    if (analysis.volumeRatio < config.minVolumeRatio) {
      skipped.push({
        symbol: result.symbol,
        reason: `vol ratio ${analysis.volumeRatio.toFixed(1)}x < ${config.minVolumeRatio}x`,
      });
      continue;
    }

    if (analysis.rsi14 != null) {
      const [rsiMin, rsiMax] = config.rsiRange;
      if (analysis.rsi14 < rsiMin || analysis.rsi14 > rsiMax) {
        skipped.push({
          symbol: result.symbol,
          reason: `RSI ${analysis.rsi14.toFixed(1)} outside [${rsiMin}, ${rsiMax}]`,
        });
        continue;
      }
    }

    const score = calculateScore(analysis);
    candidates.push({
      symbol: analysis.symbol,
      price: analysis.price,
      atrPercent: analysis.atrPercent,
      rsi14: analysis.rsi14,
      volumeRatio: analysis.volumeRatio,
      score,
    });
  }

  // --- Fundamental filtering ---
  const fundFilters = config.fundamentals;
  const hasFundFilters = fundFilters && Object.keys(fundFilters).length > 0;

  // Load fundamentals cache if filters are present
  let fundMap: Map<string, CompanyFundamentals> | null = null;
  if (hasFundFilters) {
    const cache = loadFundamentalsCache();
    if (cache) {
      fundMap = new Map(cache.entries.map((e) => [e.ticker, e]));
      console.log(`[SCAN] Fundamentals cache loaded (${cache.entries.length} entries)`);
    } else {
      console.warn(
        "[SCAN] No fundamentals cache found. Run 'update-universe --with-fundamentals' first.",
      );
    }
  }

  // Apply fundamental filters and attach ratios
  const filtered: ScanCandidate[] = [];
  for (const c of candidates) {
    const fund = fundMap?.get(c.symbol);
    let ratios: FundamentalRatios | undefined;

    if (fund) {
      ratios = computeRatios(fund, c.price);
    }

    if (hasFundFilters && fundFilters) {
      if (!ratios) {
        skipped.push({ symbol: c.symbol, reason: "no fundamentals data" });
        continue;
      }

      if (!passesFundamentalFilters(ratios, fundFilters)) {
        skipped.push({ symbol: c.symbol, reason: "failed fundamental filter" });
        continue;
      }
    }

    filtered.push({ ...c, ratios });
  }

  // Sort by score descending, take top N
  filtered.sort((a, b) => b.score - a.score);
  const topCandidates = filtered.slice(0, config.top);

  const elapsedMs = Date.now() - startTime;

  return {
    timestamp: Date.now(),
    universe: universeName,
    totalSymbols: symbols.length,
    scannedSymbols: symbols.length - skipped.length,
    skipped,
    candidates: topCandidates,
    elapsedMs,
  };
}

/**
 * Check if computed ratios pass all fundamental filters.
 */
function passesFundamentalFilters(ratios: FundamentalRatios, filters: FundamentalFilters): boolean {
  if (
    filters.maxPer != null &&
    (ratios.per == null || ratios.per > filters.maxPer || ratios.per <= 0)
  ) {
    return false;
  }
  if (
    filters.maxPbr != null &&
    (ratios.pbr == null || ratios.pbr > filters.maxPbr || ratios.pbr <= 0)
  ) {
    return false;
  }
  if (
    filters.maxPsr != null &&
    (ratios.psr == null || ratios.psr > filters.maxPsr || ratios.psr <= 0)
  ) {
    return false;
  }
  if (
    filters.minRevenueGrowth != null &&
    (ratios.revenueGrowth == null || ratios.revenueGrowth < filters.minRevenueGrowth)
  ) {
    return false;
  }
  if (
    filters.minEpsGrowth != null &&
    (ratios.epsGrowth == null || ratios.epsGrowth < filters.minEpsGrowth)
  ) {
    return false;
  }
  if (
    filters.minGrossMargin != null &&
    (ratios.grossMargin == null || ratios.grossMargin < filters.minGrossMargin)
  ) {
    return false;
  }
  if (
    filters.minOpMargin != null &&
    (ratios.opMargin == null || ratios.opMargin < filters.minOpMargin)
  ) {
    return false;
  }
  if (filters.minRoe != null && (ratios.roe == null || ratios.roe < filters.minRoe)) {
    return false;
  }
  if (
    filters.maxDeRatio != null &&
    (ratios.debtToEquity == null || ratios.debtToEquity > filters.maxDeRatio)
  ) {
    return false;
  }
  return true;
}
