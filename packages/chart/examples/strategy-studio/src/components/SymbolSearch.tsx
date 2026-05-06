import { useEffect, useId, useRef, useState } from "react";
import { type AlpacaAsset, fetchAssetList, searchAssets } from "../lib/data-sources";

interface SymbolSearchProps {
  symbol: string;
  onSelect: (symbol: string) => void;
}

const inputStyle: React.CSSProperties = {
  width: 180,
  padding: "3px 6px",
  fontSize: 11,
  background: "#0e1320",
  border: "1px solid #2a2e39",
  borderRadius: 3,
  color: "#d1d4dc",
};

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "calc(100% + 2px)",
  left: 0,
  width: 320,
  maxHeight: 300,
  overflowY: "auto",
  background: "#1e222d",
  border: "1px solid #2a2e39",
  borderRadius: 3,
  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  zIndex: 100,
};

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  fontSize: 11,
  color: "#d1d4dc",
  cursor: "pointer",
  borderBottom: "1px solid #2a2e39",
};

const itemHoverStyle: React.CSSProperties = {
  ...itemStyle,
  background: "#2a2e39",
};

/**
 * Symbol picker with inline autocomplete. Fetches the Alpaca asset list
 * (US equities, ~10k entries) once per session and filters locally on
 * symbol-prefix → name-prefix → substring. Empty query shows popular
 * tickers as quick picks.
 */
export function SymbolSearch({ symbol, onSelect }: SymbolSearchProps) {
  const [assets, setAssets] = useState<AlpacaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  // Lazy-load asset list on first focus.
  const ensureLoaded = () => {
    if (assets.length > 0 || loadError) return;
    fetchAssetList()
      .then(setAssets)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err : new Error(String(err))));
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const suggestions = searchAssets(assets, query);

  const commit = (sym: string) => {
    onSelect(sym);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? query : symbol}
        placeholder="Symbol or company name…"
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlight(0);
          ensureLoaded();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const pick = suggestions[highlight];
            if (pick) commit(pick.symbol);
            else if (query.trim()) commit(query.trim().toUpperCase());
          } else if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        style={inputStyle}
        aria-label="Symbol search"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
      />
      {open && (
        <div id={listboxId} role="listbox" tabIndex={-1} style={dropdownStyle}>
          {loadError && (
            <div style={{ ...itemStyle, color: "#ef5350" }}>
              Failed to load asset list: {loadError.message}
            </div>
          )}
          {!loadError && assets.length === 0 && (
            <div style={{ ...itemStyle, color: "#787b86" }}>Loading assets…</div>
          )}
          {assets.length > 0 && suggestions.length === 0 && (
            <div style={{ ...itemStyle, color: "#787b86" }}>No matches</div>
          )}
          {suggestions.map((s, i) => (
            <div
              key={s.symbol}
              role="option"
              tabIndex={-1}
              aria-selected={i === highlight}
              style={i === highlight ? itemHoverStyle : itemStyle}
              onMouseDown={(e) => {
                // mousedown (not click) so we beat the input's blur, which
                // would otherwise close the dropdown before onClick fires.
                e.preventDefault();
                commit(s.symbol);
              }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span style={{ fontWeight: 600, minWidth: 60 }}>{s.symbol}</span>
              <span
                style={{
                  flex: 1,
                  color: "#a3a6af",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.name}
              </span>
              <span style={{ fontSize: 9, color: "#787b86" }}>{s.exchange}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
