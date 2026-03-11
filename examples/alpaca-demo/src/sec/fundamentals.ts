/**
 * SEC EDGAR Company Facts API client
 *
 * Fetches XBRL financial data from the companyfacts endpoint and extracts
 * key metrics (revenue, EPS, margins, etc.) for fundamental screening.
 *
 * API: data.sec.gov/api/xbrl/companyfacts/CIK{padded}.json
 * Response: ~4MB per company (all XBRL concepts); we extract only needed metrics.
 */

import type { CompanyFundamentals, FundamentalRatios } from "./types.js";

const SEC_BASE = "https://data.sec.gov";

/** Minimum delay between SEC API requests (ms) */
const MIN_DELAY_MS = 100;

let lastRequestTime = 0;

function getSecUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua) {
    throw new Error(
      "SEC_USER_AGENT is required. Set it in .env (e.g., SEC_USER_AGENT=YourName your@email.com).",
    );
  }
  return ua;
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const userAgent = getSecUserAgent();

  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();

  let retries = 0;
  const maxRetries = 3;

  while (true) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    });

    if (res.status === 429) {
      retries++;
      if (retries > maxRetries) {
        throw new Error(`SEC API rate limit exceeded after ${maxRetries} retries: ${url}`);
      }
      const backoff = 2 ** retries * 1000;
      console.warn(`SEC 429 — backing off ${backoff}ms (attempt ${retries}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    if (!res.ok) {
      throw new Error(`SEC API error ${res.status}: ${url}`);
    }

    return res;
  }
}

// --- XBRL response types ---

type XbrlUnit = {
  end: string;
  val: number;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
  frame?: string;
};

type XbrlConcept = {
  label: string;
  description: string;
  units: Record<string, XbrlUnit[]>;
};

type CompanyFactsResponse = {
  cik: number;
  entityName: string;
  facts: {
    "us-gaap"?: Record<string, XbrlConcept>;
    dei?: Record<string, XbrlConcept>;
  };
};

/**
 * Fetch company facts (all XBRL data) for a single CIK.
 */
export async function fetchCompanyFacts(cik: number): Promise<CompanyFactsResponse | null> {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `${SEC_BASE}/api/xbrl/companyfacts/CIK${paddedCik}.json`;

  try {
    const res = await rateLimitedFetch(url);
    return (await res.json()) as CompanyFactsResponse;
  } catch {
    return null;
  }
}

/**
 * Get annual values for a XBRL concept, sorted by fiscal year descending.
 * Filters for 10-K filings with fp=FY (annual reports).
 */
function getAnnualValues(
  facts: CompanyFactsResponse["facts"],
  namespace: "us-gaap" | "dei",
  conceptNames: string[],
): XbrlUnit[] {
  const ns = facts[namespace];
  if (!ns) return [];

  for (const name of conceptNames) {
    const concept = ns[name];
    if (!concept) continue;

    // Try USD, then USD/shares (for EPS), then shares
    const units = concept.units.USD ?? concept.units["USD/shares"] ?? concept.units.shares ?? [];
    const annual = units.filter((u) => u.form === "10-K" && u.fp === "FY");

    if (annual.length > 0) {
      // Sort by fiscal year descending, then by filed date descending
      return annual.sort((a, b) => {
        if (b.fy !== a.fy) return b.fy - a.fy;
        return b.filed.localeCompare(a.filed);
      });
    }
  }

  return [];
}

/**
 * Get the latest value and prior-year value for a concept.
 * Returns [latest, prior] — either may be null.
 */
function getLatestTwo(
  facts: CompanyFactsResponse["facts"],
  conceptNames: string[],
): [number | null, number | null] {
  const values = getAnnualValues(facts, "us-gaap", conceptNames);
  if (values.length === 0) return [null, null];

  // Deduplicate by fiscal year (keep most recently filed per year)
  const byYear = new Map<number, XbrlUnit>();
  for (const v of values) {
    if (!byYear.has(v.fy)) {
      byYear.set(v.fy, v);
    }
  }

  const sorted = [...byYear.values()].sort((a, b) => b.fy - a.fy);
  const latest = sorted[0]?.val ?? null;
  const prior = sorted[1]?.val ?? null;
  return [latest, prior];
}

/**
 * Get the single latest annual value for a concept.
 */
function getLatest(
  facts: CompanyFactsResponse["facts"],
  conceptNames: string[],
  namespace: "us-gaap" | "dei" = "us-gaap",
): number | null {
  const values = getAnnualValues(facts, namespace, conceptNames);
  if (values.length === 0) return null;
  return values[0].val;
}

/** Revenue concept names in priority order */
const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
];

/**
 * Extract CompanyFundamentals from raw company facts JSON.
 */
export function extractFundamentals(
  ticker: string,
  cik: number,
  facts: CompanyFactsResponse,
): CompanyFundamentals {
  const f = facts.facts;

  // Find most recent filing date across all data
  let lastFiled = "";
  for (const ns of [f["us-gaap"], f.dei]) {
    if (!ns) continue;
    for (const concept of Object.values(ns)) {
      for (const units of Object.values(concept.units)) {
        for (const u of units) {
          if (u.form === "10-K" && u.filed > lastFiled) {
            lastFiled = u.filed;
          }
        }
      }
    }
  }

  const [revenue, revenuePrior] = getLatestTwo(f, REVENUE_CONCEPTS);
  const [netIncome, netIncomePrior] = getLatestTwo(f, ["NetIncomeLoss"]);
  const [operatingIncome, operatingIncomePrior] = getLatestTwo(f, ["OperatingIncomeLoss"]);
  const [eps, epsPrior] = getLatestTwo(f, ["EarningsPerShareDiluted", "EarningsPerShareBasic"]);

  const grossProfit = getLatest(f, ["GrossProfit"]);
  const stockholdersEquity = getLatest(f, [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ]);
  const longTermDebt = getLatest(f, ["LongTermDebt", "LongTermDebtNoncurrent"]);
  const cash = getLatest(f, [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsAndShortTermInvestments",
  ]);
  const currentAssets = getLatest(f, ["AssetsCurrent"]);
  const currentLiabilities = getLatest(f, ["LiabilitiesCurrent"]);

  // Shares outstanding — check DEI namespace first, then us-gaap
  const sharesOutstanding =
    getLatest(f, ["EntityCommonStockSharesOutstanding"], "dei") ??
    getLatest(f, [
      "CommonStockSharesOutstanding",
      "WeightedAverageNumberOfDilutedSharesOutstanding",
    ]);

  return {
    ticker,
    cik,
    lastFiled: lastFiled || "unknown",
    revenue,
    revenuePrior,
    netIncome,
    netIncomePrior,
    operatingIncome,
    operatingIncomePrior,
    grossProfit,
    eps,
    epsPrior,
    sharesOutstanding,
    stockholdersEquity,
    longTermDebt,
    cash,
    currentAssets,
    currentLiabilities,
  };
}

/** Safe division helper — returns null if divisor is zero/null */
function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return numerator / denominator;
}

/** Safe growth rate — returns percentage */
function safeGrowth(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

/**
 * Compute fundamental ratios from cached data and current price.
 *
 * @param fund - Cached company fundamentals
 * @param price - Current stock price
 */
export function computeRatios(fund: CompanyFundamentals, price: number): FundamentalRatios {
  const shares = fund.sharesOutstanding;
  const marketCap = shares != null ? price * shares : null;

  return {
    per: safeDivide(price, fund.eps),
    pbr: safeDivide(marketCap, fund.stockholdersEquity),
    psr: safeDivide(marketCap, fund.revenue),
    revenueGrowth: safeGrowth(fund.revenue, fund.revenuePrior),
    epsGrowth: safeGrowth(fund.eps, fund.epsPrior),
    opIncomeGrowth: safeGrowth(fund.operatingIncome, fund.operatingIncomePrior),
    grossMargin: fund.revenue
      ? safeDivide(fund.grossProfit, fund.revenue)
        ? (safeDivide(fund.grossProfit, fund.revenue) as number) * 100
        : null
      : null,
    opMargin: fund.revenue
      ? safeDivide(fund.operatingIncome, fund.revenue)
        ? (safeDivide(fund.operatingIncome, fund.revenue) as number) * 100
        : null
      : null,
    roe: fund.stockholdersEquity
      ? safeDivide(fund.netIncome, fund.stockholdersEquity)
        ? (safeDivide(fund.netIncome, fund.stockholdersEquity) as number) * 100
        : null
      : null,
    debtToEquity: safeDivide(fund.longTermDebt, fund.stockholdersEquity),
    currentRatio: safeDivide(fund.currentAssets, fund.currentLiabilities),
  };
}
