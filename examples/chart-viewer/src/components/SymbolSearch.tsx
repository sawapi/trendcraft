/**
 * Symbol search bar with Alpaca Markets ticker autocomplete.
 * Only renders when VITE_ALPACA_ENABLED is set (i.e. API keys configured).
 * In GitHub Pages / CSV-only mode this component renders nothing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedCandle } from "trendcraft";
import { useChartStore } from "../store/chartStore";

// ── Alpaca types ────────────────────────────────────────────────

interface AlpacaAsset {
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

// ── Popular tickers (shown when input is empty) ─────────────────

const POPULAR_SYMBOLS = [
  "AAPL",
  "MSFT",
  "AMZN",
  "NVDA",
  "GOOGL",
  "META",
  "TSLA",
  "BRK.B",
  "JPM",
  "V",
  "UNH",
  "MA",
  "HD",
  "PG",
  "JNJ",
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
];

// ── History (persisted in localStorage) ─────────────────────────

const HISTORY_KEY = "chart-viewer-symbol-history";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

function addToHistory(symbol: string): void {
  const history = loadHistory().filter((s) => s !== symbol);
  history.unshift(symbol);
  saveHistory(history.slice(0, MAX_HISTORY));
}

// ── Asset list cache (fetched once per session) ─────────────────

let assetCache: AlpacaAsset[] | null = null;
let assetFetchPromise: Promise<AlpacaAsset[]> | null = null;

async function fetchAssetList(): Promise<AlpacaAsset[]> {
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

async function fetchAlpacaBars(symbol: string): Promise<NormalizedCandle[]> {
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

// ── Search logic ────────────────────────────────────────────────

const MAX_SUGGESTIONS = 20;

interface Suggestion {
  symbol: string;
  name: string;
  exchange: string;
  isHistory?: boolean;
}

function buildSuggestions(assets: AlpacaAsset[], query: string): Suggestion[] {
  if (!query) {
    // Empty query: show history first, then popular tickers
    const history = loadHistory();
    const assetMap = new Map(assets.map((a) => [a.symbol, a]));

    const results: Suggestion[] = [];
    const seen = new Set<string>();

    for (const sym of history) {
      const a = assetMap.get(sym);
      results.push({
        symbol: sym,
        name: a?.name ?? "",
        exchange: a?.exchange ?? "",
        isHistory: true,
      });
      seen.add(sym);
    }

    for (const sym of POPULAR_SYMBOLS) {
      if (seen.has(sym)) continue;
      const a = assetMap.get(sym);
      if (!a) continue;
      results.push({ symbol: a.symbol, name: a.name, exchange: a.exchange });
      seen.add(sym);
      if (results.length >= MAX_SUGGESTIONS) break;
    }

    return results.slice(0, MAX_SUGGESTIONS);
  }

  const q = query.toLowerCase();
  const exactPrefix: Suggestion[] = [];
  const symbolContains: Suggestion[] = [];
  const nameContains: Suggestion[] = [];

  for (const a of assets) {
    const sym = a.symbol.toLowerCase();
    const name = a.name.toLowerCase();
    const entry = { symbol: a.symbol, name: a.name, exchange: a.exchange };
    if (sym.startsWith(q)) {
      exactPrefix.push(entry);
    } else if (sym.includes(q)) {
      symbolContains.push(entry);
    } else if (name.includes(q)) {
      nameContains.push(entry);
    }
    if (exactPrefix.length + symbolContains.length + nameContains.length > MAX_SUGGESTIONS * 3) {
      break;
    }
  }

  return [...exactPrefix, ...symbolContains, ...nameContains].slice(0, MAX_SUGGESTIONS);
}

// ── Component ───────────────────────────────────────────────────

export function SymbolSearch() {
  if (!import.meta.env.VITE_ALPACA_ENABLED) return null;
  return <SymbolSearchInner />;
}

function SymbolSearchInner() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [assets, setAssets] = useState<AlpacaAsset[]>([]);
  const loadCandles = useChartStore((state) => state.loadCandles);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch asset list on mount
  useEffect(() => {
    fetchAssetList()
      .then(setAssets)
      .catch((err) => console.warn("Failed to load asset list:", err));
  }, []);

  const suggestions = buildSuggestions(assets, query);

  // Reset selection when suggestions change
  const prevSuggestionsRef = useRef(suggestions);
  if (prevSuggestionsRef.current !== suggestions) {
    prevSuggestionsRef.current = suggestions;
    if (selectedIndex !== -1) setSelectedIndex(-1);
  }

  const handleLoad = useCallback(
    async (sym: string) => {
      const trimmed = sym.trim().toUpperCase();
      if (!trimmed) return;

      setIsLoading(true);
      setError(null);
      setShowSuggestions(false);
      setSelectedIndex(-1);

      try {
        const candles = await fetchAlpacaBars(trimmed);
        if (candles.length === 0) {
          throw new Error("No data returned for this symbol");
        }
        addToHistory(trimmed);
        loadCandles(candles, null, trimmed);
        setQuery("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    },
    [loadCandles],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showSuggestions || suggestions.length === 0) {
        if (e.key === "Enter") {
          handleLoad(query);
        } else if (e.key === "Escape") {
          setShowSuggestions(false);
        } else if (e.key === "ArrowDown") {
          setShowSuggestions(true);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        }
        case "Enter": {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            const sym = suggestions[selectedIndex].symbol;
            setQuery(sym);
            handleLoad(sym);
          } else {
            handleLoad(query);
          }
          break;
        }
        case "Escape": {
          setShowSuggestions(false);
          setSelectedIndex(-1);
          break;
        }
      }
    },
    [handleLoad, query, showSuggestions, suggestions, selectedIndex],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll(".symbol-suggestion");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <div className="symbol-search">
      <div className="symbol-search-input-wrapper">
        <span className="material-icons md-16 symbol-search-icon">search</span>
        <input
          ref={inputRef}
          type="text"
          className="symbol-search-input"
          placeholder="Search ticker (e.g. AAPL, SPY)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
            setShowSuggestions(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          disabled={isLoading}
        />
        {isLoading && <span className="symbol-search-spinner" />}
        {!isLoading && query && (
          <button
            type="button"
            className="symbol-search-go"
            onClick={() => handleLoad(query)}
            title="Load"
          >
            <span className="material-icons md-16">arrow_forward</span>
          </button>
        )}
      </div>

      {error && <div className="symbol-search-error">{error}</div>}

      {showSuggestions && suggestions.length > 0 && (
        <div className="symbol-search-suggestions" ref={listRef}>
          {suggestions.map((s, i) => (
            <button
              key={s.symbol}
              type="button"
              className={`symbol-suggestion${i === selectedIndex ? " selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setQuery(s.symbol);
                handleLoad(s.symbol);
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {s.isHistory && (
                <span className="material-icons md-14 suggestion-history-icon">history</span>
              )}
              <span className="suggestion-symbol">{s.symbol}</span>
              <span className="suggestion-name">{s.name}</span>
              <span className="suggestion-exchange">{s.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
