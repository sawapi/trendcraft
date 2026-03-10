/**
 * SEC EDGAR API client with rate limiting
 *
 * - company_tickers_exchange.json: full ticker→CIK mapping (~50KB)
 * - submissions/CIK{padded}.json: individual company SIC code
 *
 * SEC requires a User-Agent header identifying the requester.
 * Rate limit: 10 requests/sec (enforced via 100ms delay).
 */

import type { SecTickerEntry } from "./types.js";

const SEC_BASE = "https://data.sec.gov";
const SEC_WWW = "https://www.sec.gov";

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

  // Enforce minimum delay between requests
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

/**
 * Fetch the full SEC ticker list (company_tickers_exchange.json).
 * Returns ~10K entries with cik, name, ticker, exchange.
 */
export async function fetchTickerList(): Promise<SecTickerEntry[]> {
  const tickerUrl = `${SEC_WWW}/files/company_tickers_exchange.json`;
  const res = await rateLimitedFetch(tickerUrl);
  const data = (await res.json()) as { fields: string[]; data: (string | number)[][] };

  // data.fields = ["cik", "name", "ticker", "exchange"]
  // data.data = [[cik, name, ticker, exchange], ...]
  return data.data.map((row) => ({
    cik: row[0] as number,
    name: row[1] as string,
    ticker: row[2] as string,
    exchange: row[3] as string,
  }));
}

/**
 * Fetch SIC code for a single company by CIK.
 * Returns the SIC code or null if not available.
 */
export async function fetchCompanySic(cik: number): Promise<number | null> {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `${SEC_BASE}/submissions/CIK${paddedCik}.json`;

  try {
    const res = await rateLimitedFetch(url);
    const data = (await res.json()) as { sic?: string };
    return data.sic ? Number.parseInt(data.sic, 10) : null;
  } catch {
    // Some CIKs may not have submission data
    return null;
  }
}
