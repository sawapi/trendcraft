/**
 * CLI command: scan
 *
 * Scan a universe of symbols and rank candidates by volatility, momentum, and volume.
 */

import { loadEnv } from "../config/env.js";
import { applyExcludeList, getUniverse, getUniverseIds } from "../config/universe.js";
import { scanUniverse } from "../scanner/index.js";
import type { ScannerOptions } from "../scanner/index.js";

export type ScanCommandOptions = {
  universe?: string;
  symbols?: string;
  sector?: string;
  industry?: string;
  exclude?: string;
  top?: string;
  minAtr?: string;
  minVolume?: string;
  rsiMin?: string;
  rsiMax?: string;
  lookback?: string;
  concurrency?: string;
  // Fundamental filters
  maxPer?: string;
  maxPbr?: string;
  maxPsr?: string;
  minRevenueGrowth?: string;
  minEpsGrowth?: string;
  minGrossMargin?: string;
  minOpMargin?: string;
  minRoe?: string;
  maxDeRatio?: string;
};

export async function scanCommand(opts: ScanCommandOptions): Promise<void> {
  const env = loadEnv();

  // Determine symbols
  let symbols: string[];
  let universeName: string;

  if (opts.symbols) {
    symbols = opts.symbols.split(",").map((s) => s.trim().toUpperCase());
    universeName = "custom";
  } else {
    const universeId = opts.universe ?? "mega30";
    const universe = getUniverse(universeId, opts.sector, opts.industry);
    if (!universe) {
      console.error(`Unknown universe: ${universeId}. Available: ${getUniverseIds().join(", ")}`);
      process.exit(1);
    }
    symbols = universe;
    const filterLabel = [opts.sector, opts.industry].filter(Boolean).join("/");
    universeName = filterLabel ? `${universeId}:${filterLabel}` : universeId;
  }

  // Apply exclude list (default: data/exclude-symbols.txt)
  symbols = applyExcludeList(symbols, opts.exclude);

  // Build scanner options
  const scanOpts: ScannerOptions = {
    top: opts.top ? Number.parseInt(opts.top, 10) : 10,
    minAtrPercent: opts.minAtr ? Number.parseFloat(opts.minAtr) : undefined,
    minVolumeRatio: opts.minVolume ? Number.parseFloat(opts.minVolume) : undefined,
    lookbackDays: opts.lookback ? Number.parseInt(opts.lookback, 10) : undefined,
    concurrency: opts.concurrency ? Number.parseInt(opts.concurrency, 10) : undefined,
  };

  if (opts.rsiMin || opts.rsiMax) {
    const min = opts.rsiMin ? Number.parseFloat(opts.rsiMin) : 0;
    const max = opts.rsiMax ? Number.parseFloat(opts.rsiMax) : 100;
    scanOpts.rsiRange = [min, max];
  }

  // Build fundamental filters
  const fundFilters: Record<string, number> = {};
  if (opts.maxPer) fundFilters.maxPer = Number.parseFloat(opts.maxPer);
  if (opts.maxPbr) fundFilters.maxPbr = Number.parseFloat(opts.maxPbr);
  if (opts.maxPsr) fundFilters.maxPsr = Number.parseFloat(opts.maxPsr);
  if (opts.minRevenueGrowth)
    fundFilters.minRevenueGrowth = Number.parseFloat(opts.minRevenueGrowth);
  if (opts.minEpsGrowth) fundFilters.minEpsGrowth = Number.parseFloat(opts.minEpsGrowth);
  if (opts.minGrossMargin) fundFilters.minGrossMargin = Number.parseFloat(opts.minGrossMargin);
  if (opts.minOpMargin) fundFilters.minOpMargin = Number.parseFloat(opts.minOpMargin);
  if (opts.minRoe) fundFilters.minRoe = Number.parseFloat(opts.minRoe);
  if (opts.maxDeRatio) fundFilters.maxDeRatio = Number.parseFloat(opts.maxDeRatio);

  if (Object.keys(fundFilters).length > 0) {
    scanOpts.fundamentals = fundFilters;
  }

  const result = await scanUniverse(env, symbols, universeName, scanOpts);

  // Print results
  const skippedCount = result.skipped.length;
  console.log(
    `\nScanned ${result.scannedSymbols} symbols in ${(result.elapsedMs / 1000).toFixed(1)}s${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`,
  );

  if (result.candidates.length === 0) {
    console.log("\nNo candidates found matching criteria.");
    return;
  }

  // Check if any candidate has fundamental ratios
  const hasFundamentals = result.candidates.some((c) => c.ratios);

  // Table header
  console.log("");
  if (hasFundamentals) {
    console.log("  Rank  Symbol  Price        ATR%    RSI     Score   PER    RevGr%  ROE%");
    console.log(`  ${"\u2500".repeat(69)}`);
  } else {
    console.log("  Rank  Symbol  Price        ATR%    RSI     VolRatio  Score");
    console.log(`  ${"\u2500".repeat(57)}`);
  }

  // Table rows
  for (let i = 0; i < result.candidates.length; i++) {
    const c = result.candidates[i];
    const rank = String(i + 1).padStart(4);
    const sym = c.symbol.padEnd(6);
    const price = `$${c.price.toFixed(2)}`.padStart(10);
    const atrPct = `${c.atrPercent.toFixed(1)}%`.padStart(6);
    const rsiVal = c.rsi14 != null ? c.rsi14.toFixed(1).padStart(6) : "   N/A";

    if (hasFundamentals) {
      const score = c.score.toFixed(1).padStart(6);
      const per = c.ratios?.per != null ? c.ratios.per.toFixed(1).padStart(6) : "   N/A";
      const revGr =
        c.ratios?.revenueGrowth != null ? c.ratios.revenueGrowth.toFixed(1).padStart(7) : "    N/A";
      const roe = c.ratios?.roe != null ? c.ratios.roe.toFixed(1).padStart(6) : "   N/A";

      console.log(
        `  ${rank}   ${sym}  ${price}  ${atrPct}  ${rsiVal}  ${score}  ${per}  ${revGr}  ${roe}`,
      );
    } else {
      const vol = `${c.volumeRatio.toFixed(1)}x`.padStart(8);
      const score = c.score.toFixed(1).padStart(6);
      console.log(`  ${rank}   ${sym}  ${price}  ${atrPct}  ${rsiVal}  ${vol}  ${score}`);
    }
  }

  console.log("");
}
