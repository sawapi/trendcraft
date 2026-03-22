/**
 * Sortable results table for optimization output
 */

import { useCallback, useMemo, useState } from "react";
import type { OptimizationResultEntry } from "trendcraft";

type SortKey =
  | "score"
  | "returns"
  | "sharpe"
  | "maxDrawdown"
  | "winRate"
  | "tradeCount"
  | "profitFactor";

interface ResultsTableProps {
  results: OptimizationResultEntry[];
  topN?: number;
  onSelectResult?: (entry: OptimizationResultEntry) => void;
}

const COLUMNS: { key: SortKey; label: string; format: (v: number) => string }[] = [
  { key: "score", label: "Score", format: (v) => v.toFixed(3) },
  { key: "returns", label: "Return%", format: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
  { key: "sharpe", label: "Sharpe", format: (v) => v.toFixed(2) },
  { key: "maxDrawdown", label: "MaxDD%", format: (v) => `-${v.toFixed(1)}%` },
  { key: "winRate", label: "WinR%", format: (v) => `${v.toFixed(0)}%` },
  { key: "tradeCount", label: "Trades", format: (v) => String(Math.round(v)) },
  { key: "profitFactor", label: "PF", format: (v) => v.toFixed(2) },
];

function getMetricValue(entry: OptimizationResultEntry, key: SortKey): number {
  if (key === "score") return entry.score;
  return entry.metrics[key] ?? 0;
}

export function ResultsTable({ results, topN = 5, onSelectResult }: ResultsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortAsc(!sortAsc);
      } else {
        setSortKey(key);
        // maxDrawdown: lower is better, so default ascending
        setSortAsc(key === "maxDrawdown");
      }
    },
    [sortKey, sortAsc],
  );

  const sorted = useMemo(() => {
    const copy = [...results];
    copy.sort((a, b) => {
      const va = getMetricValue(a, sortKey);
      const vb = getMetricValue(b, sortKey);
      return sortAsc ? va - vb : vb - va;
    });
    return copy;
  }, [results, sortKey, sortAsc]);

  // Show at most 50 rows
  const display = sorted.slice(0, 50);

  if (results.length === 0) {
    return (
      <div style={{ color: "var(--text-secondary)", fontSize: "var(--font-sm)", padding: 8 }}>
        No results to display.
      </div>
    );
  }

  // Collect all param names from first result
  const paramNames = Object.keys(results[0].params);

  return (
    <div className="opt-results-table-wrap" style={{ overflowX: "auto", marginTop: 8 }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "var(--font-xs)",
          color: "var(--text-primary)",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>#</th>
            {paramNames.map((p) => (
              <th key={p} style={thStyle}>
                {p}
              </th>
            ))}
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                onClick={() => handleSort(col.key)}
              >
                {col.label}
                {sortKey === col.key ? (sortAsc ? " \u25B2" : " \u25BC") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {display.map((entry, idx) => {
            const isTop = idx < topN;
            const isSelected = selectedIdx === idx;
            return (
              <tr
                key={idx}
                style={{
                  background: isSelected
                    ? "rgba(233, 69, 96, 0.25)"
                    : isTop
                      ? "rgba(0, 255, 136, 0.08)"
                      : "transparent",
                  cursor: onSelectResult ? "pointer" : "default",
                }}
                onClick={() => {
                  setSelectedIdx(idx);
                  onSelectResult?.(entry);
                }}
              >
                <td style={tdStyle}>{idx + 1}</td>
                {paramNames.map((p) => (
                  <td key={p} style={{ ...tdStyle, color: "var(--warning)" }}>
                    {entry.params[p]}
                  </td>
                ))}
                {COLUMNS.map((col) => {
                  const val = getMetricValue(entry, col.key);
                  let color = "var(--text-primary)";
                  if (col.key === "returns") {
                    color = val >= 0 ? "var(--success)" : "var(--error)";
                  }
                  return (
                    <td key={col.key} style={{ ...tdStyle, color }}>
                      {col.format(val)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {results.length > 50 && (
        <div
          style={{
            fontSize: "var(--font-xs)",
            color: "var(--text-secondary)",
            padding: "4px 0",
            textAlign: "center",
          }}
        >
          Showing top 50 of {results.length} results
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid var(--border)",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-secondary)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: "var(--bg-secondary)",
};

const tdStyle: React.CSSProperties = {
  padding: "3px 6px",
  borderBottom: "1px solid rgba(51, 51, 51, 0.5)",
  whiteSpace: "nowrap",
};
