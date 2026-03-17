/**
 * Trading configuration file loader
 *
 * Supports a JSON config file (default: data/trading.json) that can be
 * overridden by CLI arguments. This enables reproducible, version-controlled
 * trading setups.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLogger } from "../util/logger.js";
import type { LogLevel } from "../util/logger.js";

const log = createLogger("CONFIG");

const DATA_DIR = resolve(import.meta.dirname, "../../data");
const DEFAULT_CONFIG_PATH = resolve(DATA_DIR, "trading.json");

/**
 * Trading configuration — all fields are optional.
 * CLI arguments override config file values.
 */
export type TradingConfig = {
  /** Strategy IDs to use (e.g., ["rsi-mean-reversion", "macd-trend"]) */
  strategies?: string[];
  /** Symbols to trade (e.g., ["AAPL", "MSFT"]) */
  symbols?: string[];
  /** Capital per agent in dollars */
  capital?: number;
  /** Dry run mode — no real orders */
  dryRun?: boolean;
  /** Use all available strategies */
  all?: boolean;
  /** Auto-scan configuration */
  autoScan?: {
    enabled: boolean;
    universe?: string;
    top?: number;
    sector?: string;
    industry?: string;
    exclude?: string;
  };
  /** Verbose ticker output */
  verbose?: boolean;
  /** Log level override */
  logLevel?: LogLevel;
  /** JSON log output */
  logJson?: boolean;
  /** Review configuration */
  review?: {
    enabled?: boolean;
    intraEnabled?: boolean;
    intraInterval?: number;
  };
  /** Webhook notification configuration */
  webhook?: {
    url: string;
    events?: string[];
  };
};

/**
 * Load trading config from a JSON file.
 *
 * @param path - Path to config file. Defaults to data/trading.json.
 * @returns Parsed config or null if file not found.
 */
export function loadTradingConfig(path?: string): TradingConfig | null {
  const configPath = path ?? DEFAULT_CONFIG_PATH;
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw) as TradingConfig;
    log.info(`Loaded config from ${configPath}`);
    return config;
  } catch (err) {
    log.error(`Failed to parse config ${configPath}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Merge config file values with CLI options.
 * CLI options take precedence over config file values.
 */
export function mergeConfigWithOpts(
  config: TradingConfig | null,
  cliOpts: Record<string, unknown>,
): Record<string, unknown> {
  if (!config) return cliOpts;

  const merged: Record<string, unknown> = {};

  // Config base values — only set if CLI didn't provide them
  if (config.strategies && !cliOpts.strategy && !cliOpts.all) {
    merged.strategy = config.strategies.join(",");
  }
  if (config.symbols && !cliOpts.symbol && !cliOpts.symbols) {
    merged.symbols = config.symbols.join(",");
  }
  if (config.capital != null && cliOpts.capital === "100000") {
    merged.capital = String(config.capital);
  }
  if (config.dryRun != null && cliOpts.dryRun === undefined) {
    merged.dryRun = config.dryRun;
  }
  if (config.all != null && !cliOpts.all && !cliOpts.strategy) {
    merged.all = config.all;
  }
  if (config.verbose != null && cliOpts.verbose === undefined) {
    merged.verbose = config.verbose;
  }

  // Auto-scan
  if (config.autoScan?.enabled && !cliOpts.autoScan) {
    merged.autoScan = true;
    if (config.autoScan.universe) merged.universe = config.autoScan.universe;
    if (config.autoScan.top) merged.top = String(config.autoScan.top);
    if (config.autoScan.sector) merged.sector = config.autoScan.sector;
    if (config.autoScan.industry) merged.industry = config.autoScan.industry;
    if (config.autoScan.exclude) merged.exclude = config.autoScan.exclude;
  }

  // Review
  if (config.review) {
    if (config.review.enabled === false && cliOpts.noAutoReview === undefined) {
      merged.noAutoReview = true;
    }
    if (config.review.intraEnabled === false && cliOpts.noIntraReview === undefined) {
      merged.noIntraReview = true;
    }
    if (config.review.intraInterval && cliOpts.intraInterval === "30") {
      merged.intraInterval = String(config.review.intraInterval);
    }
  }

  // CLI overrides everything
  return { ...merged, ...cliOpts };
}

/** Default config path for external use */
export const DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_PATH;

/**
 * Generate a default trading.json template
 */
export function generateDefaultConfig(): TradingConfig {
  return {
    strategies: ["rsi-mean-reversion", "macd-trend"],
    symbols: ["AAPL", "SPY", "MSFT"],
    capital: 100000,
    dryRun: true,
    verbose: false,
    logLevel: "info",
    review: {
      enabled: true,
      intraEnabled: true,
      intraInterval: 30,
    },
  };
}
