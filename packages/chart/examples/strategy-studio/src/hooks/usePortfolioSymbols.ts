import { useEffect, useRef, useState } from "react";
import {
  type DataSource,
  fetchAlpacaBars,
  PORTFOLIO_SYMBOLS,
  type Timeframe,
} from "../lib/data-sources";
import { type SampleSymbol, sampleSymbols } from "../lib/sample-data";

export interface UsePortfolioSymbolsResult {
  symbols: SampleSymbol[];
  loading: boolean;
  error: Error | null;
}

/**
 * Returns the symbol set PortfolioPanel renders. Mirrors `useDataSource`'s
 * lifecycle for consistency: synthetic mode returns the bundled three
 * (BASE / STEADY / VOLAT); Alpaca mode fetches PORTFOLIO_SYMBOLS in parallel
 * at the active timeframe and caches per timeframe in memory for the
 * session.
 *
 * `reloadTick` is the counter exposed by `useDataSource` — incrementing it
 * (e.g. when the user clicks the toolbar Reload button) busts this hook's
 * timeframe cache so the portfolio backtest stays aligned with the main
 * chart's freshly-fetched bars.
 */
export function usePortfolioSymbols(source: DataSource, reloadTick = 0): UsePortfolioSymbolsResult {
  const isAlpaca = source.kind === "alpaca";
  const [symbols, setSymbols] = useState<SampleSymbol[]>(() => (isAlpaca ? [] : sampleSymbols));
  const [loading, setLoading] = useState<boolean>(isAlpaca);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<Timeframe, SampleSymbol[]>>(new Map());
  const lastReloadTickRef = useRef(reloadTick);

  useEffect(() => {
    if (source.kind !== "alpaca") {
      setSymbols(sampleSymbols);
      setLoading(false);
      setError(null);
      return;
    }

    if (lastReloadTickRef.current !== reloadTick) {
      lastReloadTickRef.current = reloadTick;
      cacheRef.current.clear();
    }

    const tf = source.timeframe;
    const cached = cacheRef.current.get(tf);
    if (cached) {
      setSymbols(cached);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all(
      PORTFOLIO_SYMBOLS.map(async (p) => ({
        symbol: p.symbol,
        label: p.label,
        candles: await fetchAlpacaBars(p.symbol, tf),
      })),
    )
      .then((next) => {
        if (cancelled) return;
        cacheRef.current.set(tf, next);
        setSymbols(next);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [source, reloadTick]);

  return { symbols, loading, error };
}
