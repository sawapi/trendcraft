/**
 * CSV output formatter for screening results
 */

import type { ScreeningSessionResult } from "../types";

/**
 * Escape CSV field value
 */
function escapeCsv(value: string | number | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  const str = String(value);
  // Escape if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format screening results as CSV
 *
 * @param sessionResult - Screening session result
 * @param options - Formatting options
 * @returns Formatted CSV string
 */
export function formatCsv(
  sessionResult: ScreeningSessionResult,
  options: { showAll?: boolean } = {},
): string {
  const { showAll = false } = options;

  const lines: string[] = [];

  // Header
  const headers = [
    "ticker",
    "entry_signal",
    "exit_signal",
    "price",
    "atr_percent",
    "rsi14",
    "volume",
    "volume_ratio",
    "timestamp",
  ];
  lines.push(headers.join(","));

  // Filter results
  const results = showAll
    ? sessionResult.results
    : sessionResult.results.filter((r) => r.entrySignal || r.exitSignal);

  // Data rows
  for (const r of results) {
    const row = [
      escapeCsv(r.ticker),
      r.entrySignal ? "1" : "0",
      r.exitSignal ? "1" : "0",
      r.currentPrice.toFixed(2),
      r.atrPercent.toFixed(4),
      r.metrics.rsi14?.toFixed(2) ?? "",
      r.metrics.volume?.toString() ?? "",
      r.metrics.volumeRatio?.toFixed(4) ?? "",
      new Date(r.timestamp).toISOString().split("T")[0],
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}
