/**
 * Watchlist component - persisted list of favorite symbols
 * Only renders when VITE_ALPACA_ENABLED is set.
 */

import { useCallback, useState } from "react";
import { useChartStore } from "../store/chartStore";
import { fetchAlpacaBars } from "../utils/alpacaApi";

const STORAGE_KEY = "chart-viewer-watchlist";

function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(list: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>(loadWatchlist);

  const add = useCallback((symbol: string) => {
    setSymbols((prev) => {
      if (prev.includes(symbol)) return prev;
      const next = [...prev, symbol];
      saveWatchlist(next);
      return next;
    });
  }, []);

  const remove = useCallback((symbol: string) => {
    setSymbols((prev) => {
      const next = prev.filter((s) => s !== symbol);
      saveWatchlist(next);
      return next;
    });
  }, []);

  const has = useCallback((symbol: string) => symbols.includes(symbol), [symbols]);

  return { symbols, add, remove, has };
}

interface WatchlistProps {
  symbols: string[];
  onRemove: (symbol: string) => void;
}

export function Watchlist({ symbols, onRemove }: WatchlistProps) {
  if (!import.meta.env.VITE_ALPACA_ENABLED || symbols.length === 0) return null;

  const loadCandles = useChartStore((s) => s.loadCandles);
  const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);

  const handleClick = async (symbol: string) => {
    setLoadingSymbol(symbol);
    try {
      const candles = await fetchAlpacaBars(symbol);
      if (candles.length > 0) {
        loadCandles(candles, null, symbol);
      }
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoadingSymbol(null);
    }
  };

  return (
    <div className="watchlist">
      {symbols.map((sym) => (
        <span key={sym} className="watchlist-chip">
          <button
            type="button"
            className="watchlist-chip-label"
            onClick={() => handleClick(sym)}
            disabled={loadingSymbol === sym}
          >
            {loadingSymbol === sym ? "..." : sym}
          </button>
          <button
            type="button"
            className="watchlist-chip-remove"
            onClick={() => onRemove(sym)}
            title={`Remove ${sym}`}
          >
            <span className="material-icons" style={{ fontSize: 12 }}>
              close
            </span>
          </button>
        </span>
      ))}
    </div>
  );
}
