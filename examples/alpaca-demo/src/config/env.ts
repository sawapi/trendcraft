/**
 * Environment configuration loader
 */

import { resolve } from "node:path";
import { config } from "dotenv";

config({ path: resolve(import.meta.dirname, "../../.env") });

export type AlpacaEnv = {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  dataUrl: string;
  streamUrl: string;
};

export function loadEnv(): AlpacaEnv {
  const apiKey = process.env.ALPACA_API_KEY;
  const apiSecret = process.env.ALPACA_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing ALPACA_API_KEY or ALPACA_API_SECRET. Copy .env.example to .env and fill in your credentials.",
    );
  }

  return {
    apiKey,
    apiSecret,
    baseUrl: process.env.ALPACA_BASE_URL ?? "https://paper-api.alpaca.markets",
    dataUrl: process.env.ALPACA_DATA_URL ?? "https://data.alpaca.markets",
    streamUrl: process.env.ALPACA_STREAM_URL ?? "wss://stream.data.alpaca.markets/v2/iex",
  };
}
