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

/** Extracted financial metrics for a single company */
export type CompanyFundamentals = {
  ticker: string;
  cik: number;
  lastFiled: string; // Most recent filing date (for diff update)
  // Latest annual values
  revenue: number | null;
  revenuePrior: number | null; // Prior year (for growth calc)
  netIncome: number | null;
  netIncomePrior: number | null;
  operatingIncome: number | null;
  operatingIncomePrior: number | null;
  grossProfit: number | null;
  eps: number | null;
  epsPrior: number | null;
  sharesOutstanding: number | null;
  stockholdersEquity: number | null;
  longTermDebt: number | null;
  cash: number | null;
  currentAssets: number | null;
  currentLiabilities: number | null;
};

/** Computed ratios (calculated at scan time with live price) */
export type FundamentalRatios = {
  per: number | null; // Price / EPS
  pbr: number | null; // MarketCap / Equity
  psr: number | null; // MarketCap / Revenue
  revenueGrowth: number | null; // (rev - revPrior) / revPrior
  epsGrowth: number | null;
  opIncomeGrowth: number | null;
  grossMargin: number | null; // grossProfit / revenue
  opMargin: number | null; // opIncome / revenue
  roe: number | null; // netIncome / equity
  debtToEquity: number | null; // debt / equity
  currentRatio: number | null; // currentAssets / currentLiabilities
};

/** Persisted fundamentals cache */
export type FundamentalsCache = {
  builtAt: number;
  version: number;
  entries: CompanyFundamentals[];
};

/** Fundamental filter options for scanner */
export type FundamentalFilters = {
  maxPer?: number;
  maxPbr?: number;
  maxPsr?: number;
  minRevenueGrowth?: number; // percentage
  minEpsGrowth?: number;
  minGrossMargin?: number;
  minOpMargin?: number;
  minRoe?: number;
  maxDeRatio?: number;
};
