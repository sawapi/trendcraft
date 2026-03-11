/**
 * Fundamentals cache management
 *
 * Persists extracted financial metrics to data/sec-fundamentals.json.
 * Supports differential updates: only re-fetches companies with new filings.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AlpacaEnv } from "../config/env.js";
import { extractFundamentals, fetchCompanyFacts } from "./fundamentals.js";
import type { CompanyFundamentals, FundamentalsCache, SecUniverseEntry } from "./types.js";

const CACHE_VERSION = 1;
const CACHE_FILE = resolve(import.meta.dirname, "../../data/sec-fundamentals.json");

/** Checkpoint interval — save every N fetches for crash resilience */
const CHECKPOINT_INTERVAL = 500;

/**
 * Load fundamentals cache from disk.
 * Returns null if file does not exist.
 */
export function loadFundamentalsCache(): FundamentalsCache | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw) as FundamentalsCache;
  } catch {
    return null;
  }
}

/**
 * Save fundamentals cache to disk.
 */
export function saveFundamentalsCache(cache: FundamentalsCache): void {
  const dir = resolve(CACHE_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Fetch the latest filing date from SEC submissions API for diff detection.
 * Returns the most recent filing date string or null.
 */
async function fetchLatestFilingDate(cik: number): Promise<string | null> {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  const ua = process.env.SEC_USER_AGENT;
  if (!ua) return null;

  // Rate limit
  await new Promise((r) => setTimeout(r, 100));

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      filings?: { recent?: { filingDate?: string[] } };
    };
    const dates = data.filings?.recent?.filingDate;
    if (dates && dates.length > 0) return dates[0];
    return null;
  } catch {
    return null;
  }
}

export type BuildFundamentalsOptions = {
  /** Skip diff check — re-fetch all */
  force?: boolean;
  /** Skip submissions API diff check (faster, but fetches all non-cached) */
  skipDiffCheck?: boolean;
  /** Progress callback */
  onProgress?: (done: number, total: number, fetched: number) => void;
};

/**
 * Build or update the fundamentals cache.
 *
 * 1. Load existing cache
 * 2. For each universe entry:
 *    a. If cached and skipDiffCheck: skip
 *    b. If cached: check submissions API for newer filing date
 *    c. If new or updated: fetch companyfacts and extract metrics
 * 3. Save cache with checkpoints every 500 fetches
 *
 * @param universe - SEC universe entries (ticker + CIK list)
 * @param opts - Build options
 */
export async function buildFundamentalsCache(
  universe: SecUniverseEntry[],
  opts: BuildFundamentalsOptions = {},
): Promise<FundamentalsCache> {
  const { force = false, skipDiffCheck = false, onProgress } = opts;

  // Load existing cache
  const existing = force ? null : loadFundamentalsCache();
  const existingMap = new Map<string, CompanyFundamentals>();
  if (existing) {
    for (const e of existing.entries) {
      existingMap.set(e.ticker, e);
    }
  }

  const entries: CompanyFundamentals[] = [];
  let fetched = 0;
  let skipped = 0;
  let errors = 0;
  const total = universe.length;

  for (let i = 0; i < universe.length; i++) {
    const entry = universe[i];
    const cached = existingMap.get(entry.ticker);

    // Decide whether to fetch
    let needsFetch = true;

    if (cached && !force) {
      if (skipDiffCheck || !existingMap.size) {
        // Trust cache, skip
        entries.push(cached);
        skipped++;
        needsFetch = false;
      } else {
        // Check if there are newer filings (only for previously cached entries)
        const latestFiling = await fetchLatestFilingDate(entry.cik);
        if (latestFiling && cached.lastFiled >= latestFiling) {
          entries.push(cached);
          skipped++;
          needsFetch = false;
        }
      }
    }

    if (needsFetch) {
      const facts = await fetchCompanyFacts(entry.cik);
      if (facts) {
        const fund = extractFundamentals(entry.ticker, entry.cik, facts);
        entries.push(fund);
        fetched++;
      } else {
        // Keep cached version if available, otherwise create empty entry
        if (cached) {
          entries.push(cached);
        } else {
          entries.push({
            ticker: entry.ticker,
            cik: entry.cik,
            lastFiled: "unknown",
            revenue: null,
            revenuePrior: null,
            netIncome: null,
            netIncomePrior: null,
            operatingIncome: null,
            operatingIncomePrior: null,
            grossProfit: null,
            eps: null,
            epsPrior: null,
            sharesOutstanding: null,
            stockholdersEquity: null,
            longTermDebt: null,
            cash: null,
            currentAssets: null,
            currentLiabilities: null,
          });
        }
        errors++;
      }
    }

    if (onProgress) onProgress(i + 1, total, fetched);

    // Checkpoint save
    if (fetched > 0 && fetched % CHECKPOINT_INTERVAL === 0) {
      const checkpoint: FundamentalsCache = {
        builtAt: Date.now(),
        version: CACHE_VERSION,
        entries: [...entries],
      };
      saveFundamentalsCache(checkpoint);
      console.log(`  [checkpoint] saved ${entries.length} entries (${fetched} fetched)`);
    }
  }

  // Final save
  const result: FundamentalsCache = {
    builtAt: Date.now(),
    version: CACHE_VERSION,
    entries,
  };
  saveFundamentalsCache(result);

  console.log(
    `Fundamentals: ${entries.length} entries (${fetched} fetched, ${skipped} cached, ${errors} errors)`,
  );

  return result;
}

/**
 * Detect if a cached entry likely has extraction bugs
 * (e.g., has revenue but EPS is null — probably USD/shares unit issue).
 */
function needsRepair(entry: CompanyFundamentals): boolean {
  // Has financial data (revenue or netIncome) but missing EPS → likely extraction bug
  if ((entry.revenue != null || entry.netIncome != null) && entry.eps == null) {
    return true;
  }
  return false;
}

/**
 * Repair fundamentals cache — re-fetch only entries with suspected extraction bugs.
 * Much faster than a full rebuild since it only hits entries that need fixing.
 */
export async function repairFundamentalsCache(
  onProgress?: (done: number, total: number, repaired: number) => void,
): Promise<FundamentalsCache | null> {
  const cache = loadFundamentalsCache();
  if (!cache) {
    console.log("No fundamentals cache to repair.");
    return null;
  }

  // Find entries needing repair
  const repairIndices: number[] = [];
  for (let i = 0; i < cache.entries.length; i++) {
    if (needsRepair(cache.entries[i])) {
      repairIndices.push(i);
    }
  }

  if (repairIndices.length === 0) {
    console.log("No entries need repair.");
    return cache;
  }

  console.log(`Found ${repairIndices.length} entries needing repair...`);

  let repaired = 0;
  for (let j = 0; j < repairIndices.length; j++) {
    const idx = repairIndices[j];
    const entry = cache.entries[idx];

    const facts = await fetchCompanyFacts(entry.cik);
    if (facts) {
      cache.entries[idx] = extractFundamentals(entry.ticker, entry.cik, facts);
      repaired++;
    }

    if (onProgress) onProgress(j + 1, repairIndices.length, repaired);

    // Checkpoint every 200 repairs
    if (repaired > 0 && repaired % 200 === 0) {
      cache.builtAt = Date.now();
      saveFundamentalsCache(cache);
      console.log(`  [checkpoint] repaired ${repaired}/${repairIndices.length}`);
    }
  }

  cache.builtAt = Date.now();
  saveFundamentalsCache(cache);
  console.log(`Repaired ${repaired}/${repairIndices.length} entries.`);

  return cache;
}
