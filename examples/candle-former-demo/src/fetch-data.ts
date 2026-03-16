/**
 * Fetch historical candle data from Alpaca API
 *
 * Usage: pnpm fetch [symbol] [months]
 *
 * Requires ALPACA_API_KEY and ALPACA_API_SECRET in .env
 * (copy from examples/alpaca-demo/.env or create your own)
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import type { NormalizedCandle } from "trendcraft";

// Load .env from alpaca-demo (shared credentials)
config({ path: resolve(import.meta.dirname, "../../alpaca-demo/.env") });
// Also try local .env
config({ path: resolve(import.meta.dirname, "../.env") });

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type HistoricalBarsResponse = {
  bars: AlpacaBar[];
  next_page_token: string | null;
};

async function fetchBars(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<NormalizedCandle[]> {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;
  const dataUrl = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing ALPACA_API_KEY or ALPACA_API_SECRET.\n" +
        "Create a .env file or ensure examples/alpaca-demo/.env exists.",
    );
  }

  const headers = {
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": apiSecret,
  };

  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  console.log(`Fetching ${symbol} bars from ${startDate} to ${endDate}...`);

  do {
    const params = new URLSearchParams({
      timeframe: "1Day",
      start: startDate,
      end: endDate,
      limit: "10000",
      feed: "iex",
      adjustment: "split",
    });
    if (pageToken) params.set("page_token", pageToken);

    const url = `${dataUrl}/v2/stocks/${symbol}/bars?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alpaca API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as HistoricalBarsResponse;
    allBars.push(...data.bars);
    pageToken = data.next_page_token;
  } while (pageToken);

  console.log(`Fetched ${allBars.length} bars.`);

  return allBars.map((bar) => ({
    time: new Date(bar.t).getTime(),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().split("T")[0];
}

async function main() {
  const args = process.argv.slice(2);

  // Last arg may be months if it's a number
  let months = 12;
  let symbols: string[];
  if (args.length > 1 && /^\d+$/.test(args[args.length - 1])) {
    const last = args.pop();
    months = Number.parseInt(last ?? "12", 10);
    symbols = args;
  } else {
    symbols = args;
  }
  if (symbols.length === 0) symbols = ["AAPL"];

  const startDate = monthsAgo(months);
  const endDate = new Date().toISOString().split("T")[0];

  for (const symbol of symbols) {
    const candles = await fetchBars(symbol, startDate, endDate);
    const outPath = resolve(import.meta.dirname, `../data/candles-${symbol.toLowerCase()}.json`);
    writeFileSync(outPath, JSON.stringify(candles, null, 2));
    console.log(`Saved ${candles.length} candles to ${outPath}`);
  }
}

main().catch(console.error);
