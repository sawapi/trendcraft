/**
 * Types for SEC EDGAR universe data
 */

/** Raw entry from SEC company_tickers_exchange.json */
export type SecTickerEntry = {
  cik: number;
  name: string;
  ticker: string;
  exchange: string;
};

/** Sector classification derived from SIC codes */
export type SectorId =
  | "technology"
  | "healthcare"
  | "finance"
  | "energy"
  | "consumer"
  | "industrials"
  | "real-estate"
  | "utilities"
  | "communications"
  | "materials"
  | "other";

/** Industry classification derived from SIC 4-digit codes */
export type IndustryId =
  // Technology
  | "software"
  | "semiconductors"
  | "it-services"
  | "computer-hardware"
  | "electronic-equipment"
  // Healthcare
  | "pharmaceuticals"
  | "biotechnology"
  | "medical-devices"
  | "health-services"
  // Finance
  | "banking"
  | "investment-services"
  | "insurance"
  | "asset-management"
  | "holding-companies"
  // Energy
  | "oil-gas"
  | "mining"
  | "energy-services"
  // Consumer
  | "retail"
  | "food-beverage"
  | "restaurants"
  | "consumer-products"
  | "wholesale"
  // Industrials
  | "aerospace-defense"
  | "automotive"
  | "machinery"
  | "construction"
  | "transportation"
  // Communications
  | "telecom"
  | "media"
  // Real Estate
  | "reits"
  | "real-estate-services"
  // Utilities
  | "electric-utilities"
  | "gas-utilities"
  | "water-utilities"
  // Materials
  | "chemicals"
  | "metals-mining"
  | "forest-products"
  // Other
  | "other";

/** A single entry in the cached SEC universe */
export type SecUniverseEntry = {
  ticker: string;
  name: string;
  cik: number;
  exchange: string;
  sic: number | null;
  sector: SectorId | null;
  industry: IndustryId | null;
};

/** Persisted SEC universe cache file format */
export type SecUniverseData = {
  builtAt: number;
  version: number;
  entries: SecUniverseEntry[];
};

/** Options for buildSecUniverse */
export type BuildOptions = {
  force?: boolean;
  noAlpacaFilter?: boolean;
  onProgress?: (done: number, total: number) => void;
};
