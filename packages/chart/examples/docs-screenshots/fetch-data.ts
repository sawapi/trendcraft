/**
 * Pull historical bars from Alpaca's market-data API and write them to
 * data/<symbol>-<timeframe>.json (default: data/nvda-1day.json, which the
 * scenes import). Self-contained: reads ALPACA_API_KEY / ALPACA_API_SECRET
 * from the environment or from .env next to this file (gitignored).
 *
 * Usage:
 *   pnpm fetch-data                           # default: NVDA 1Day 2022-01-01 → today
 *   pnpm fetch-data NVDA 1Day 2022-01-01
 *   pnpm fetch-data SPY 1Day 2020-01-01 2026-03-13
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number };
type AlpacaBarsResponse = { bars?: AlpacaBar[] | null; next_page_token?: string | null };

const DATA_URL = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

// ---- Credentials: environment first, then ./.env ----
const envPath = resolve(__dirname, ".env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const apiKey = process.env.ALPACA_API_KEY;
const apiSecret = process.env.ALPACA_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error(
    `Missing ALPACA_API_KEY / ALPACA_API_SECRET. Set them in the environment or in ${envPath} (see .env.example).`,
  );
  process.exit(1);
}

const symbol = (process.argv[2] ?? "NVDA").toUpperCase();
const timeframe = process.argv[3] ?? "1Day";
const start = process.argv[4] ?? "2022-01-01";
const end = process.argv[5] ?? new Date().toISOString().slice(0, 10);

/** Fetch every page of bars for the range (IEX feed, split-adjusted). */
async function fetchBars(): Promise<Candle[]> {
  const out: Candle[] = [];
  let pageToken: string | null = null;
  do {
    const params = new URLSearchParams({
      timeframe,
      start,
      end,
      limit: "10000",
      feed: "iex",
      adjustment: "split",
    });
    if (pageToken) params.set("page_token", pageToken);

    const res = await fetch(`${DATA_URL}/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`, {
      headers: { "APCA-API-KEY-ID": apiKey ?? "", "APCA-API-SECRET-KEY": apiSecret ?? "" },
    });
    if (res.status === 401 || res.status === 403) {
      // Don't echo the body: auth error pages can quote part of the key.
      throw new Error(`Alpaca API ${res.status}: check ALPACA_API_KEY / ALPACA_API_SECRET`);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Alpaca API ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as AlpacaBarsResponse;
    for (const bar of data.bars ?? []) {
      out.push({
        time: new Date(bar.t).getTime(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
      });
    }
    pageToken = data.next_page_token ?? null;
  } while (pageToken);
  return out;
}

/** Reject data the scenes would silently mis-render: disorder, duplicates, impossible OHLC. */
function validate(candles: Candle[]): void {
  if (candles.length === 0) throw new Error(`No bars returned for ${symbol} ${timeframe}`);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const day = new Date(c.time).toISOString();
    if (i > 0 && c.time <= candles[i - 1].time) {
      throw new Error(`Bars out of order or duplicated at ${day}`);
    }
    const values = [c.open, c.high, c.low, c.close, c.volume];
    if (!values.every(Number.isFinite)) throw new Error(`Non-finite value at ${day}`);
    if (c.high < Math.max(c.open, c.close) || c.low > Math.min(c.open, c.close) || c.volume < 0) {
      throw new Error(`Inconsistent OHLCV at ${day}`);
    }
  }
}

console.log(`Fetching ${symbol} ${timeframe} from ${start} to ${end}...`);
const candles = await fetchBars();
validate(candles);

const dataDir = resolve(__dirname, "data");
mkdirSync(dataDir, { recursive: true });
const outfile = resolve(dataDir, `${symbol.toLowerCase()}-${timeframe.toLowerCase()}.json`);
writeFileSync(outfile, JSON.stringify(candles, null, 2));

console.log(`Wrote ${candles.length} candles → ${outfile}`);
console.log(`First: ${new Date(candles[0].time).toISOString().slice(0, 10)}`);
console.log(`Last:  ${new Date(candles[candles.length - 1].time).toISOString().slice(0, 10)}`);
