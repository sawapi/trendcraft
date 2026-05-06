import {
  ALPACA_ENABLED,
  DEFAULT_SYMBOL,
  DEFAULT_TIMEFRAME,
  type DataSource,
  POPULAR_SYMBOLS,
  TIMEFRAME_LABEL,
  TIMEFRAME_ORDER,
  type Timeframe,
} from "../lib/data-sources";
import { SymbolSearch } from "./SymbolSearch";

interface DataSourcePanelProps {
  source: DataSource;
  loading: boolean;
  error: Error | null;
  onChange: (source: DataSource) => void;
  onReload: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "#787b86",
};

const buttonStyle: React.CSSProperties = {
  padding: "3px 8px",
  fontSize: 11,
  background: "#1e222d",
  // Long-hand border properties only — mixing `border` shorthand with
  // `borderColor` overrides triggers a React rerender warning.
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "#2a2e39",
  borderRadius: 3,
  color: "#d1d4dc",
  cursor: "pointer",
};

const activeButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#2196f3",
  borderColor: "#2196f3",
  color: "#fff",
};

/**
 * Toolbar mounted in the studio header. Renders nothing when Alpaca is
 * disabled at the dev-server layer (no key) — synthetic data is the only
 * option in that case and the existing UI already conveys it.
 */
export function DataSourcePanel({
  source,
  loading,
  error,
  onChange,
  onReload,
}: DataSourcePanelProps) {
  if (!ALPACA_ENABLED) return null;

  const isAlpaca = source.kind === "alpaca";
  const currentSymbol = isAlpaca ? source.symbol : DEFAULT_SYMBOL;
  const currentTimeframe: Timeframe = isAlpaca ? source.timeframe : DEFAULT_TIMEFRAME;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
      }}
      role="toolbar"
      aria-label="Data source"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={labelStyle}>Source</span>
        <button
          type="button"
          style={!isAlpaca ? activeButtonStyle : buttonStyle}
          onClick={() => onChange({ kind: "synthetic" })}
        >
          Synthetic
        </button>
        <button
          type="button"
          style={isAlpaca ? activeButtonStyle : buttonStyle}
          onClick={() =>
            onChange({
              kind: "alpaca",
              symbol: currentSymbol,
              timeframe: currentTimeframe,
            })
          }
        >
          Alpaca
        </button>
      </div>

      {isAlpaca && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={labelStyle}>Symbol</span>
            <SymbolSearch
              symbol={source.symbol}
              onSelect={(sym) =>
                onChange({ kind: "alpaca", symbol: sym, timeframe: currentTimeframe })
              }
            />
            {POPULAR_SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                style={source.symbol === sym ? activeButtonStyle : buttonStyle}
                onClick={() =>
                  onChange({ kind: "alpaca", symbol: sym, timeframe: currentTimeframe })
                }
              >
                {sym}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={labelStyle}>TF</span>
            {TIMEFRAME_ORDER.map((tf) => (
              <button
                key={tf}
                type="button"
                style={currentTimeframe === tf ? activeButtonStyle : buttonStyle}
                onClick={() => onChange({ kind: "alpaca", symbol: source.symbol, timeframe: tf })}
              >
                {TIMEFRAME_LABEL[tf]}
              </button>
            ))}
          </div>

          <button type="button" style={buttonStyle} onClick={onReload} disabled={loading}>
            {loading ? "Loading…" : "Reload"}
          </button>
        </>
      )}

      {error && (
        <span
          style={{
            fontSize: 11,
            color: "#ef5350",
            background: "#3a1a1a",
            padding: "3px 8px",
            borderRadius: 3,
            border: "1px solid #ef5350",
          }}
          role="alert"
        >
          {error.message}
        </span>
      )}
    </div>
  );
}
