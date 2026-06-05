import type { StudioCandle } from "../sample-data";
import { TIMEFRAME_LOOKBACK_DAYS, type Timeframe } from "./types";

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaBarsResponse {
  bars?: AlpacaBar[];
  next_page_token?: string | null;
}

export interface AlpacaAsset {
  symbol: string;
  name: string;
  exchange: string;
}

interface AlpacaAssetRaw {
  symbol: string;
  name: string;
  exchange: string;
  tradable: boolean;
}

/**
 * Whether the dev server has Alpaca credentials configured. When `false`,
 * studio uses synthetic data only. The flag is injected by `vite.config.ts`
 * via `define`; the actual API keys never reach client code.
 */
export const ALPACA_ENABLED: boolean = import.meta.env.VITE_ALPACA_ENABLED === "true";

/** Default symbols offered as quick-pick buttons in DataSourcePanel. */
export const POPULAR_SYMBOLS = ["SPY", "QQQ", "AAPL", "NVDA", "MSFT"];

export const DEFAULT_SYMBOL = "SPY";
export const DEFAULT_TIMEFRAME: Timeframe = "1Day";

/**
 * Symbols used by PortfolioPanel when Alpaca is enabled — picked to span the
 * volatility / cap-size spectrum so the BASE / STEADY / VOLAT semantics still
 * read clearly with real data.
 */
export const PORTFOLIO_SYMBOLS: ReadonlyArray<{ symbol: string; label: string }> = [
  { symbol: "SPY", label: "SPDR S&P 500 ETF" },
  { symbol: "AAPL", label: "Apple Inc." },
  { symbol: "NVDA", label: "NVIDIA Corp" },
];

/**
 * Fetch historical bars for a given symbol/timeframe via the dev-server proxy.
 * Pagination is handled internally; returns a chronologically ordered array
 * of `StudioCandle`. Adjustment is `split` to align with TradingView's default
 * chart behaviour for sanity comparisons.
 */
export async function fetchAlpacaBars(
  symbol: string,
  timeframe: Timeframe,
): Promise<StudioCandle[]> {
  const lookbackDays = TIMEFRAME_LOOKBACK_DAYS[timeframe];
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - lookbackDays);
  const startStr = start.toISOString();

  const out: StudioCandle[] = [];
  let pageToken: string | null = null;

  do {
    const params = new URLSearchParams({
      timeframe,
      start: startStr,
      limit: "10000",
      feed: "iex",
      adjustment: "split",
    });
    if (pageToken) params.set("page_token", pageToken);

    const url = `/api/alpaca/data/v2/stocks/${encodeURIComponent(symbol)}/bars?${params}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Alpaca API ${res.status}: ${text || res.statusText}`);
    }

    const data = (await res.json()) as AlpacaBarsResponse;
    const bars = data.bars ?? [];

    for (const bar of bars) {
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

// ── Asset list (lazy, session-cached) ──────────────────────────────────────

let assetCache: AlpacaAsset[] | null = null;
let assetFetchPromise: Promise<AlpacaAsset[]> | null = null;

/**
 * Fetch the full list of tradable US equities from Alpaca's trading API.
 * Cached for the lifetime of the page — concurrent callers share a single
 * in-flight request. Returns symbol + company name + exchange for each
 * entry, enabling search by either symbol or name.
 */
export async function fetchAssetList(): Promise<AlpacaAsset[]> {
  if (assetCache) return assetCache;
  if (assetFetchPromise) return assetFetchPromise;

  assetFetchPromise = (async () => {
    const res = await fetch("/api/alpaca/trading/v2/assets?status=active&asset_class=us_equity");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Alpaca asset list ${res.status}: ${text || res.statusText}`);
    }
    const raw = (await res.json()) as AlpacaAssetRaw[];
    assetCache = raw
      .filter((a) => a.tradable)
      .map((a) => ({ symbol: a.symbol, name: a.name, exchange: a.exchange }));
    return assetCache;
  })();

  try {
    return await assetFetchPromise;
  } catch (err) {
    assetFetchPromise = null;
    throw err;
  }
}

export interface SearchOptions {
  /** Maximum suggestions to return. */
  limit?: number;
}

/**
 * Filter and rank assets by a query string. Matches against symbol prefix
 * (highest priority), name prefix, then symbol/name substring. Empty query
 * returns the popular symbols list resolved against the asset cache.
 */
export function searchAssets(
  assets: AlpacaAsset[],
  query: string,
  { limit = 20 }: SearchOptions = {},
): AlpacaAsset[] {
  const q = query.trim().toUpperCase();
  if (!q) {
    const map = new Map(assets.map((a) => [a.symbol, a]));
    const out: AlpacaAsset[] = [];
    for (const sym of POPULAR_SYMBOLS) {
      const hit = map.get(sym);
      if (hit) out.push(hit);
    }
    return out.slice(0, limit);
  }

  const symbolPrefix: AlpacaAsset[] = [];
  const namePrefix: AlpacaAsset[] = [];
  const symbolSubstr: AlpacaAsset[] = [];
  const nameSubstr: AlpacaAsset[] = [];

  for (const asset of assets) {
    const sym = asset.symbol.toUpperCase();
    const name = asset.name.toUpperCase();
    if (sym.startsWith(q)) symbolPrefix.push(asset);
    else if (name.startsWith(q)) namePrefix.push(asset);
    else if (sym.includes(q)) symbolSubstr.push(asset);
    else if (name.includes(q)) nameSubstr.push(asset);
    if (symbolPrefix.length + namePrefix.length >= limit * 2) break;
  }

  return [...symbolPrefix, ...namePrefix, ...symbolSubstr, ...nameSubstr].slice(0, limit);
}
