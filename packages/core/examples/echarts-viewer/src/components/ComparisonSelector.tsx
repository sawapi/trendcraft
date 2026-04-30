/**
 * Comparison mode selector - add symbols to overlay on main chart
 * Only renders when VITE_ALPACA_ENABLED is set.
 */

import { useCallback, useState } from "react";
import { useChartStore } from "../store/chartStore";
import { fetchAlpacaBars } from "../utils/alpacaApi";

const COMPARISON_COLORS = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4ecdc4"];

export function ComparisonSelector() {
  if (!import.meta.env.VITE_ALPACA_ENABLED) return null;
  return <ComparisonSelectorInner />;
}

function ComparisonSelectorInner() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comparisonSymbols = useChartStore((s) => s.comparisonSymbols);
  const addComparison = useChartStore((s) => s.addComparison);
  const removeComparison = useChartStore((s) => s.removeComparison);

  const handleAdd = useCallback(async () => {
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    if (comparisonSymbols.length >= 4) {
      setError("Max 4 comparisons");
      return;
    }
    if (comparisonSymbols.some((c) => c.symbol === symbol)) {
      setError("Already added");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const candles = await fetchAlpacaBars(symbol);
      if (candles.length === 0) throw new Error("No data");
      const colorIdx = comparisonSymbols.length % COMPARISON_COLORS.length;
      addComparison({
        symbol,
        candles,
        color: COMPARISON_COLORS[colorIdx],
      });
      setInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsLoading(false);
    }
  }, [input, comparisonSymbols, addComparison]);

  return (
    <div className="comparison-selector">
      <button
        type="button"
        className={`comparison-toggle ${comparisonSymbols.length > 0 ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Compare symbols"
      >
        <span className="material-icons md-14">compare_arrows</span>
        Compare
        {comparisonSymbols.length > 0 && (
          <span className="comparison-count">{comparisonSymbols.length}</span>
        )}
      </button>

      {isOpen && (
        <div className="comparison-dropdown">
          <div className="comparison-input-row">
            <input
              type="text"
              placeholder="Symbol (e.g. SPY)"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") setIsOpen(false);
              }}
              disabled={isLoading}
              // biome-ignore lint/a11y/noAutofocus: UX needs immediate focus
              autoFocus
            />
            <button
              type="button"
              onClick={handleAdd}
              disabled={isLoading || !input.trim()}
              className="comparison-add-btn"
            >
              {isLoading ? "..." : "+"}
            </button>
          </div>
          {error && <div className="comparison-error">{error}</div>}
          {comparisonSymbols.length > 0 && (
            <div className="comparison-list">
              {comparisonSymbols.map((c) => (
                <div key={c.symbol} className="comparison-item">
                  <span className="comparison-dot" style={{ backgroundColor: c.color }} />
                  <span className="comparison-symbol">{c.symbol}</span>
                  <button
                    type="button"
                    className="comparison-remove"
                    onClick={() => removeComparison(c.symbol)}
                  >
                    <span className="material-icons" style={{ fontSize: 14 }}>
                      close
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
