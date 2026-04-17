/**
 * Pull long-range NVDA bars from Alpaca and write them to data/nvda-daily.json.
 * Reuses alpaca-demo's fetchHistoricalBars directly and parses .env manually
 * (avoids dragging dotenv into this playground).
 *
 * Usage:
 *   npx tsx fetch-data.ts                           # default: NVDA 1Day 2022-01-01 → today
 *   npx tsx fetch-data.ts NVDA 1Day 2022-01-01
 *   npx tsx fetch-data.ts SPY 1Day 2020-01-01 2026-03-13
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type AlpacaTimeframe,
  fetchHistoricalBars,
  today,
} from "../../../core/examples/alpaca-demo/src/alpaca/historical.js";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

// ---- Minimal .env loader (replaces dotenv) ----
const envPath = resolve(__dirname, "../../../core/examples/alpaca-demo/.env");
try {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
    if (match) {
      const [, key, rawValue] = match;
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch (err) {
  console.error(`Could not read ${envPath}:`, err instanceof Error ? err.message : err);
  process.exit(1);
}

const apiKey = process.env.ALPACA_API_KEY;
const apiSecret = process.env.ALPACA_API_SECRET;
if (!apiKey || !apiSecret) {
  console.error("Missing ALPACA_API_KEY / ALPACA_API_SECRET in alpaca-demo's .env");
  process.exit(1);
}

const symbol = process.argv[2] ?? "NVDA";
const timeframe = (process.argv[3] ?? "1Day") as AlpacaTimeframe;
const start = process.argv[4] ?? "2022-01-01";
const end = process.argv[5] ?? today();

const outfile = resolve(
  __dirname,
  "data",
  `${symbol.toLowerCase()}-${timeframe.toLowerCase()}.json`,
);

console.log(`Fetching ${symbol} ${timeframe} from ${start} to ${end}...`);

const candles = await fetchHistoricalBars(
  {
    apiKey,
    apiSecret,
    baseUrl: process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets",
    dataUrl: process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets",
    streamUrl: process.env.ALPACA_STREAM_URL ?? "wss://stream.data.alpaca.markets/v2/iex",
  },
  { symbol, timeframe, start, end },
);

writeFileSync(outfile, JSON.stringify(candles, null, 2));
console.log(`Wrote ${candles.length} candles → ${outfile}`);
console.log(`First: ${new Date(candles[0].time).toISOString().slice(0, 10)}`);
const last = candles[candles.length - 1];
console.log(`Last:  ${new Date(last.time).toISOString().slice(0, 10)}`);
