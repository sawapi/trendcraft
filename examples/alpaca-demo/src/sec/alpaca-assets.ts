/**
 * Fetch tradable US equity symbols from Alpaca API
 */

import type { AlpacaEnv } from "../config/env.js";

type AlpacaAsset = {
  symbol: string;
  status: string;
  tradable: boolean;
  asset_class: string;
};

/**
 * Fetch all active, tradable US equity symbols from Alpaca.
 * Returns a Set for O(1) lookup.
 */
export async function fetchTradableSymbols(env: AlpacaEnv): Promise<Set<string>> {
  const url = `${env.baseUrl}/v2/assets?status=active&asset_class=us_equity`;
  const res = await fetch(url, {
    headers: {
      "APCA-API-KEY-ID": env.apiKey,
      "APCA-API-SECRET-KEY": env.apiSecret,
    },
  });

  if (!res.ok) {
    throw new Error(`Alpaca /v2/assets error ${res.status}: ${await res.text()}`);
  }

  const assets = (await res.json()) as AlpacaAsset[];
  const symbols = new Set<string>();
  for (const a of assets) {
    if (a.tradable) symbols.add(a.symbol);
  }
  return symbols;
}
