import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALPACA_ENABLED,
  DEFAULT_SYMBOL,
  DEFAULT_TIMEFRAME,
  type DataSource,
  dataSourceKey,
  fetchAlpacaBars,
} from "../lib/data-sources";
import { type StudioCandle, sampleCandles } from "../lib/sample-data";

/**
 * Initial source: Alpaca (SPY 1D) when credentials are configured, otherwise
 * synthetic. Initial candles match the source — when Alpaca is selected we
 * start empty (with `loading=true`) instead of flashing synthetic data
 * before the fetch resolves.
 */
const INITIAL_SOURCE: DataSource = ALPACA_ENABLED
  ? { kind: "alpaca", symbol: DEFAULT_SYMBOL, timeframe: DEFAULT_TIMEFRAME }
  : { kind: "synthetic" };

export interface UseDataSourceResult {
  candles: StudioCandle[];
  source: DataSource;
  setSource: (source: DataSource) => void;
  reload: () => void;
  loading: boolean;
  error: Error | null;
  /**
   * Monotonic counter incremented every time `reload()` fires. Other hooks
   * that own independent fetches (e.g. PortfolioPanel's symbol set) should
   * key on this so they refresh in lockstep with the main candle stream.
   */
  reloadTick: number;
}

export function useDataSource(): UseDataSourceResult {
  const [source, setSourceState] = useState<DataSource>(INITIAL_SOURCE);
  const [candles, setCandles] = useState<StudioCandle[]>(() =>
    INITIAL_SOURCE.kind === "synthetic" ? sampleCandles : [],
  );
  const [loading, setLoading] = useState<boolean>(INITIAL_SOURCE.kind === "alpaca");
  const [error, setError] = useState<Error | null>(null);
  // Per-(symbol, tf) candle cache. Lives for the lifetime of the studio
  // session — reloads bypass it via `reload()`.
  const cacheRef = useRef<Map<string, StudioCandle[]>>(new Map());
  const reloadCounterRef = useRef(0);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (source.kind === "synthetic") {
      setCandles(sampleCandles);
      setLoading(false);
      setError(null);
      return;
    }

    const key = dataSourceKey(source);
    const cached = cacheRef.current.get(key);
    if (cached && reloadTick === reloadCounterRef.current) {
      setCandles(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchAlpacaBars(source.symbol, source.timeframe)
      .then((next) => {
        if (cancelled) return;
        cacheRef.current.set(key, next);
        setCandles(next);
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

  const setSource = useCallback((next: DataSource) => {
    setSourceState(next);
  }, []);

  const reload = useCallback(() => {
    if (source.kind === "alpaca") {
      cacheRef.current.delete(dataSourceKey(source));
    }
    reloadCounterRef.current += 1;
    setReloadTick(reloadCounterRef.current);
  }, [source]);

  return { candles, source, setSource, reload, loading, error, reloadTick };
}
