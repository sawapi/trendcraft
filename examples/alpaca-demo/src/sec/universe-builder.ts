/**
 * SEC Universe Builder
 *
 * Builds and caches a ticker→sector mapping by:
 * 1. Fetching SEC company_tickers_exchange.json (all tickers)
 * 2. Filtering to Alpaca-tradable symbols
 * 3. Fetching individual SIC codes from SEC submissions API
 * 4. Mapping SIC → sector
 *
 * Results are cached to data/sec-universe.json.
 * Supports resume: previously fetched SIC entries are preserved.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AlpacaEnv } from "../config/env.js";
import { fetchTradableSymbols } from "./alpaca-assets.js";
import { fetchCompanySic, fetchTickerList } from "./fetcher.js";
import { sicToIndustry, sicToSector } from "./sic-sectors.js";
import type { BuildOptions, SecUniverseData, SecUniverseEntry } from "./types.js";

const CACHE_VERSION = 1;
const CACHE_FILE = resolve(import.meta.dirname, "../../data/sec-universe.json");

/** Staleness threshold for cache warnings (30 days) */
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Load cached SEC universe data from disk.
 * Returns null if cache file does not exist.
 */
export function loadSecUniverse(): SecUniverseData | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    const data = JSON.parse(raw) as SecUniverseData;
    // Backfill industry field for caches created before industry support
    for (const entry of data.entries) {
      if (entry.industry === undefined && entry.sic != null) {
        entry.industry = sicToIndustry(entry.sic);
      }
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the age of the cached universe in milliseconds.
 * Returns null if no cache exists.
 */
export function getSecUniverseAge(): number | null {
  const data = loadSecUniverse();
  if (!data) return null;
  return Date.now() - data.builtAt;
}

/** Check if cache is stale (>30 days old) and print warning */
export function warnIfStale(): void {
  const age = getSecUniverseAge();
  if (age != null && age > STALE_THRESHOLD_MS) {
    const days = Math.floor(age / (24 * 60 * 60 * 1000));
    console.warn(
      `\u26a0 SEC universe cache is ${days} days old. Run 'update-universe' to refresh.`,
    );
  }
}

function saveCache(data: SecUniverseData): void {
  const dir = resolve(CACHE_FILE, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

/**
 * Build SEC universe with SIC sector mapping.
 *
 * @param env - Alpaca environment (used for tradable filter)
 * @param opts - Build options
 */
export async function buildSecUniverse(
  env: AlpacaEnv | null,
  opts: BuildOptions = {},
): Promise<SecUniverseData> {
  const { force = false, noAlpacaFilter = false, onProgress } = opts;

  // 1. Load existing cache for resume
  const existing = force ? null : loadSecUniverse();
  const existingMap = new Map<string, SecUniverseEntry>();
  if (existing) {
    for (const e of existing.entries) {
      existingMap.set(e.ticker, e);
    }
  }

  // 2. Fetch SEC ticker list
  console.log("Fetching SEC ticker list...");
  const allTickers = await fetchTickerList();
  console.log(`  ${allTickers.length} tickers from SEC`);

  // 3. Optionally filter by Alpaca tradable symbols
  let tradableSet: Set<string> | null = null;
  if (!noAlpacaFilter && env) {
    console.log("Fetching Alpaca tradable assets...");
    tradableSet = await fetchTradableSymbols(env);
    console.log(`  ${tradableSet.size} tradable symbols from Alpaca`);
  }

  // 4. Build intersection
  const candidates = allTickers.filter((t) => {
    if (tradableSet && !tradableSet.has(t.ticker)) return false;
    return true;
  });
  console.log(`  ${candidates.length} symbols to process`);

  // 5. Fetch SIC codes (with resume support)
  const entries: SecUniverseEntry[] = [];
  let sicFetched = 0;
  let sicSkipped = 0;
  const total = candidates.length;

  for (let i = 0; i < candidates.length; i++) {
    const t = candidates[i];

    // Check if we already have SIC for this ticker (resume)
    const cached = existingMap.get(t.ticker);
    if (cached && cached.sic != null) {
      entries.push(cached);
      sicSkipped++;
      continue;
    }

    // Fetch SIC from SEC
    const sic = await fetchCompanySic(t.cik);
    const sector = sic != null ? sicToSector(sic) : null;
    const industry = sic != null ? sicToIndustry(sic) : null;
    entries.push({
      ticker: t.ticker,
      name: t.name,
      cik: t.cik,
      exchange: t.exchange,
      sic,
      sector,
      industry,
    });
    sicFetched++;

    // Progress callback
    if (onProgress) onProgress(i + 1, total);

    // Periodic save (every 500 fetches) for crash resilience
    if (sicFetched > 0 && sicFetched % 500 === 0) {
      saveCache({ builtAt: Date.now(), version: CACHE_VERSION, entries: [...entries] });
      console.log(`  [checkpoint] saved ${entries.length} entries`);
    }
  }

  // 6. Final save
  const result: SecUniverseData = {
    builtAt: Date.now(),
    version: CACHE_VERSION,
    entries,
  };
  saveCache(result);

  console.log(`Done: ${entries.length} entries (${sicFetched} fetched, ${sicSkipped} from cache)`);

  return result;
}
