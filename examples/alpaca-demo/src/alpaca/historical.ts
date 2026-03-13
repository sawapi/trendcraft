/**
 * Alpaca historical data fetcher
 *
 * Retrieves historical bar data and converts to NormalizedCandle format.
 */

import { type NormalizedCandle, type ValidationResult, validateCandles } from "trendcraft";
import type { AlpacaEnv } from "../config/env.js";

export type AlpacaTimeframe = "1Min" | "5Min" | "15Min" | "30Min" | "1Hour" | "1Day";

export type AlpacaBar = {
  t: string; // timestamp ISO string
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
};

export type HistoricalBarsResponse = {
  bars: AlpacaBar[];
  next_page_token: string | null;
};

export type FetchBarsOptions = {
  symbol: string;
  timeframe: AlpacaTimeframe;
  start: string; // ISO date string
  end?: string;
  limit?: number;
};

/**
 * Fetch historical bars from Alpaca and convert to NormalizedCandle[]
 */
export async function fetchHistoricalBars(
  env: AlpacaEnv,
  opts: FetchBarsOptions,
): Promise<NormalizedCandle[]> {
  const headers = {
    "APCA-API-KEY-ID": env.apiKey,
    "APCA-API-SECRET-KEY": env.apiSecret,
  };

  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeframe: opts.timeframe,
      start: opts.start,
      limit: String(opts.limit ?? 10000),
      feed: "iex",
    });
    if (opts.end) params.set("end", opts.end);
    if (pageToken) params.set("page_token", pageToken);

    const url = `${env.dataUrl}/v2/stocks/${opts.symbol}/bars?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alpaca data API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as HistoricalBarsResponse;
    allBars.push(...data.bars);
    pageToken = data.next_page_token;
  } while (pageToken);

  const candles = allBars.map(barToCandle);

  // Validate data quality
  const validation = validateCandles(candles, {
    gaps: { maxGapMultiplier: 3, skipWeekends: true },
    duplicates: true,
    ohlc: true,
    spikes: { maxPriceChangePercent: 20 },
    autoClean: true,
  });

  if (validation.errors.length > 0) {
    for (const err of validation.errors) {
      console.warn(`[DATA] Error: ${err.message}`);
    }
  }
  if (validation.warnings.length > 0) {
    console.log(
      `[DATA] ${opts.symbol}: ${validation.warnings.length} warning(s) in ${candles.length} candles`,
    );
  }

  return validation.cleanedCandles ?? candles;
}

/**
 * Validate candle data and return the full validation result
 */
export function validateHistoricalBars(candles: NormalizedCandle[]): ValidationResult {
  return validateCandles(candles, {
    gaps: { maxGapMultiplier: 3, skipWeekends: true },
    duplicates: true,
    ohlc: true,
    spikes: { maxPriceChangePercent: 20 },
    autoClean: true,
  });
}

/**
 * Convert an Alpaca bar to NormalizedCandle
 */
function barToCandle(bar: AlpacaBar): NormalizedCandle {
  return {
    time: new Date(bar.t).getTime(),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  };
}

/**
 * Get ISO date string for N months ago
 */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

/**
 * Get ISO date string for N days ago
 */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

/**
 * Get ISO date string for today
 */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}
