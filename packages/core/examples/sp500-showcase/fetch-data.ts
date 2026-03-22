#!/usr/bin/env npx tsx
/**
 * Fetch historical OHLCV data from Alpaca API and save as CSV
 *
 * Usage:
 *   # Set environment variables (or use alpaca-demo/.env)
 *   export ALPACA_API_KEY=your_key
 *   export ALPACA_API_SECRET=your_secret
 *
 *   npx tsx fetch-data.ts
 *
 * Downloads 10 years of daily data for SPY, QQQ, IWM, DIA and
 * sector ETFs into ./data/ as CSV files.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env: local first, then fall back to alpaca-demo/.env
function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

loadEnvFile(resolve(import.meta.dirname, ".env"));
loadEnvFile(resolve(import.meta.dirname, "../alpaca-demo/.env"));

const DATA_URL = process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets";

function getCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.error("Missing ALPACA_API_KEY or ALPACA_API_SECRET.");
    console.error("Set environment variables or create .env (see .env.example)");
    process.exit(1);
  }

  return { apiKey, apiSecret };
}

const SYMBOLS = [
  "SPY", // S&P 500
  "QQQ", // Nasdaq 100
  "IWM", // Russell 2000
  "DIA", // Dow Jones
  "XLK", // Technology
  "XLF", // Financials
  "XLE", // Energy
  "XLV", // Healthcare
];

const DATA_DIR = resolve(import.meta.dirname, "data");

type AlpacaBar = {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

type BarsResponse = {
  bars: AlpacaBar[];
  next_page_token: string | null;
};

async function fetchBars(symbol: string, start: string, end?: string): Promise<AlpacaBar[]> {
  const { apiKey, apiSecret } = getCredentials();
  const headers = {
    "APCA-API-KEY-ID": apiKey,
    "APCA-API-SECRET-KEY": apiSecret,
  };

  const allBars: AlpacaBar[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeframe: "1Day",
      start,
      limit: "10000",
      feed: "sip",
      adjustment: "split",
    });
    if (end) params.set("end", end);
    if (pageToken) params.set("page_token", pageToken);

    const url = `${DATA_URL}/v2/stocks/${symbol}/bars?${params}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as BarsResponse;
    allBars.push(...data.bars);
    pageToken = data.next_page_token;
  } while (pageToken);

  return allBars;
}

function barsToCsv(bars: AlpacaBar[]): string {
  const lines = ["date,open,high,low,close,volume"];
  for (const bar of bars) {
    const date = bar.t.split("T")[0];
    lines.push(`${date},${bar.o},${bar.h},${bar.l},${bar.c},${bar.v}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const startDate = "2015-01-01";
  console.log(`Fetching daily data from ${startDate} for ${SYMBOLS.length} symbols...\n`);

  for (const symbol of SYMBOLS) {
    process.stdout.write(`  ${symbol}... `);
    try {
      const bars = await fetchBars(symbol, startDate);
      const csv = barsToCsv(bars);
      const filepath = resolve(DATA_DIR, `${symbol}.csv`);
      writeFileSync(filepath, csv, "utf-8");
      console.log(`${bars.length} bars saved`);
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }
  }

  console.log(`\nDone. Files saved to ${DATA_DIR}/`);
}

main();
