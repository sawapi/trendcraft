/**
 * Pre-defined symbol universes for scanning
 *
 * Static lists of tradable symbols organized by market-cap tier.
 * Supports dynamic SEC EDGAR universe with sector filtering.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSecUniverse, warnIfStale } from "../sec/index.js";
import type { IndustryId, SectorId } from "../sec/index.js";

const DEFAULT_EXCLUDE_FILE = resolve(import.meta.dirname, "../../data/exclude-symbols.txt");

/** Static universe IDs (pre-defined symbol lists) */
export type StaticUniverseId = "mega30" | "sp100";

/** All universe IDs including dynamic SEC universe */
export type UniverseId = StaticUniverseId | "sec";

/** Mega-cap stocks + major ETFs (30 symbols) */
const MEGA30: string[] = [
  // Mega-cap stocks (20)
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "BRK.B",
  "AVGO",
  "JPM",
  "LLY",
  "V",
  "UNH",
  "MA",
  "COST",
  "HD",
  "PG",
  "JNJ",
  "ABBV",
  "CRM",
  // Major ETFs (10)
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "XLF",
  "XLK",
  "XLE",
  "XLV",
  "GLD",
  "TLT",
];

/** S&P 100 equivalent — mega30 + 70 additional large-caps */
const SP100: string[] = [
  ...MEGA30,
  // Additional large-caps (70)
  "NFLX",
  "AMD",
  "INTC",
  "ADBE",
  "CSCO",
  "PEP",
  "TMO",
  "CMCSA",
  "ABT",
  "MRK",
  "ACN",
  "ORCL",
  "DHR",
  "PM",
  "TXN",
  "MCD",
  "WMT",
  "NEE",
  "LIN",
  "RTX",
  "LOW",
  "HON",
  "UPS",
  "MS",
  "GS",
  "BMY",
  "AMGN",
  "SBUX",
  "MDT",
  "BLK",
  "CVX",
  "XOM",
  "COP",
  "SLB",
  "EOG",
  "GILD",
  "ISRG",
  "VRTX",
  "REGN",
  "ZTS",
  "ADP",
  "LRCX",
  "KLAC",
  "SNPS",
  "CDNS",
  "AMAT",
  "MU",
  "MRVL",
  "PANW",
  "CRWD",
  "NOW",
  "SNOW",
  "UBER",
  "ABNB",
  "SQ",
  "PYPL",
  "COIN",
  "SHOP",
  "MELI",
  "SE",
  "BA",
  "CAT",
  "DE",
  "GE",
  "MMM",
  "F",
  "GM",
  "DAL",
  "LUV",
  "UAL",
];

export const UNIVERSES: Record<StaticUniverseId, string[]> = {
  mega30: MEGA30,
  sp100: SP100,
};

/**
 * Get symbol list by universe ID.
 * For "sec", loads from the cached SEC universe file.
 */
export function getUniverse(id: string, sector?: string, industry?: string): string[] | null {
  if (id === "sec") {
    return getSecSymbols(sector as SectorId | undefined, industry as IndustryId | undefined);
  }
  return UNIVERSES[id as StaticUniverseId] ?? null;
}

/**
 * Get SEC universe symbols, optionally filtered by sector and/or industry.
 * Returns null if the cache file does not exist.
 */
function getSecSymbols(sector?: SectorId, industry?: IndustryId): string[] | null {
  const data = loadSecUniverse();
  if (!data) {
    console.error("SEC universe cache not found. Run 'update-universe' first.");
    return null;
  }
  warnIfStale();

  let entries = data.entries;
  if (sector) {
    entries = entries.filter((e) => e.sector === sector);
  }
  if (industry) {
    entries = entries.filter((e) => e.industry === industry);
  }
  return entries.map((e) => e.ticker);
}

/**
 * Get SEC symbols filtered by sector (convenience export).
 */
export function getSecSymbolsBySector(sector: SectorId): string[] | null {
  return getSecSymbols(sector);
}

/**
 * Load excluded symbols from a text file.
 * Format: one symbol per line, # for comments, blank lines ignored.
 *
 * @param filePath - Path to exclude file. Defaults to data/exclude-symbols.txt.
 * @returns Set of uppercase symbols to exclude (empty set if file not found).
 */
export function loadExcludeList(filePath?: string): Set<string> {
  const path = filePath ?? DEFAULT_EXCLUDE_FILE;
  if (!existsSync(path)) return new Set();

  const lines = readFileSync(path, "utf-8").split("\n");
  const symbols = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      symbols.add(trimmed.toUpperCase());
    }
  }

  if (symbols.size > 0) {
    console.log(`Excluding ${symbols.size} symbols from ${path}`);
  }
  return symbols;
}

/**
 * Apply exclude list to a symbol array.
 */
export function applyExcludeList(symbols: string[], excludeFile?: string): string[] {
  const excluded = loadExcludeList(excludeFile);
  if (excluded.size === 0) return symbols;
  return symbols.filter((s) => !excluded.has(s.toUpperCase()));
}

/**
 * Get all available universe IDs
 */
export function getUniverseIds(): UniverseId[] {
  return [...(Object.keys(UNIVERSES) as UniverseId[]), "sec"];
}
