/**
 * Shared Alpaca API utilities (used by SymbolSearch and Watchlist)
 */

import type { NormalizedCandle } from "trendcraft";

export interface AlpacaAsset {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
}

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ── Asset list cache (fetched once per session) ─────────────────

let assetCache: AlpacaAsset[] | null = null;
let assetFetchPromise: Promise<AlpacaAsset[]> | null = null;

export async function fetchAssetList(): Promise<AlpacaAsset[]> {
  if (assetCache) return assetCache;
  if (assetFetchPromise) return assetFetchPromise;

  assetFetchPromise = (async () => {
    const res = await fetch("/api/alpaca/trading/v2/assets?status=active&asset_class=us_equity");
    if (!res.ok) throw new Error(`Asset list fetch failed: ${res.status}`);
    const raw: { symbol: string; name: string; exchange: string; tradable: boolean }[] =
      await res.json();
    assetCache = raw
      .filter((a) => a.tradable)
      .map((a) => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
        tradable: a.tradable,
      }));
    return assetCache;
  })();

  return assetFetchPromise;
}

// ── Historical bars fetcher ─────────────────────────────────────

export async function fetchAlpacaBars(symbol: string): Promise<NormalizedCandle[]> {
  const yearsBack = 10;
  const start = new Date();
  start.setFullYear(start.getFullYear() - yearsBack);
  const startStr = start.toISOString().split("T")[0];

  const allCandles: NormalizedCandle[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeframe: "1Day",
      start: startStr,
      limit: "10000",
      feed: "iex",
      adjustment: "split",
    });
    if (pageToken) params.set("page_token", pageToken);

    const url = `/api/alpaca/data/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Alpaca API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const bars: AlpacaBar[] = data.bars ?? [];

    for (const bar of bars) {
      allCandles.push({
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

  return allCandles;
}
