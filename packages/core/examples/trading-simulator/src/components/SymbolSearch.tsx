import { useCallback, useEffect, useMemo, useState } from "react";
import { useSimulatorStore } from "../store/simulatorStore";
import {
  type AlpacaAsset,
  fetchAlpacaBars,
  fetchAssetList,
  isAlpacaEnabled,
} from "../utils/alpacaApi";

export function SymbolSearch() {
  const { createSymbolSession } = useSimulatorStore();
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<AlpacaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  // Load asset list on mount
  useEffect(() => {
    if (!isAlpacaEnabled()) return;
    fetchAssetList()
      .then((list) => {
        setAssets(list);
        setAssetsLoaded(true);
      })
      .catch(() => {
        // Asset list failed — user can still type symbols manually
        setAssetsLoaded(true);
      });
  }, []);

  // Filter assets by query
  const filtered = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toUpperCase();
    return assets
      .filter((a) => a.symbol.startsWith(q) || a.name.toUpperCase().includes(q))
      .slice(0, 8);
  }, [query, assets]);

  const handleLoadSymbol = useCallback(
    async (symbol: string) => {
      setLoading(true);
      setError(null);
      try {
        const candles = await fetchAlpacaBars(symbol);
        if (candles.length === 0) {
          setError(`No data found for ${symbol}`);
          return;
        }
        createSymbolSession(candles, symbol, "USD");
        setQuery("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    },
    [createSymbolSession],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (query.trim()) {
        handleLoadSymbol(query.trim().toUpperCase());
      }
    },
    [query, handleLoadSymbol],
  );

  if (!isAlpacaEnabled()) return null;

  return (
    <div className="symbol-search">
      <form onSubmit={handleSubmit} className="symbol-search-form">
        <div className="symbol-search-input-row">
          <span className="material-icons search-icon">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={assetsLoaded ? "Search symbol (e.g. AAPL)" : "Loading assets..."}
            className="symbol-search-input"
            disabled={loading}
          />
          <button type="submit" className="symbol-search-btn" disabled={loading || !query.trim()}>
            {loading ? "Loading..." : "Load"}
          </button>
        </div>
      </form>

      {/* Autocomplete dropdown */}
      {filtered.length > 0 && !loading && (
        <div className="symbol-search-results">
          {filtered.map((asset) => (
            <button
              key={asset.symbol}
              type="button"
              className="symbol-search-result"
              onClick={() => handleLoadSymbol(asset.symbol)}
            >
              <span className="result-symbol">{asset.symbol}</span>
              <span className="result-name">{asset.name}</span>
              <span className="result-exchange">{asset.exchange}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="symbol-search-error">{error}</div>}
    </div>
  );
}
