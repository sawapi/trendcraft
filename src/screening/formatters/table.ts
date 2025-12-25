/**
 * Table output formatter for screening results
 */

import type { ScreeningSessionResult } from "../types";

/**
 * Format screening results as ASCII table
 *
 * @param sessionResult - Screening session result
 * @param options - Formatting options
 * @returns Formatted ASCII table string
 */
export function formatTable(
  sessionResult: ScreeningSessionResult,
  options: { showAll?: boolean } = {},
): string {
  const { showAll = false } = options;

  const lines: string[] = [];

  // Header
  lines.push("=".repeat(90));
  lines.push(`Stock Screening Results - ${new Date(sessionResult.timestamp).toISOString()}`);
  lines.push("=".repeat(90));
  lines.push("");

  // Criteria
  lines.push(`Criteria: ${sessionResult.criteria.name || "Custom"}`);
  lines.push(`  Entry: ${sessionResult.criteria.entryDescription}`);
  if (sessionResult.criteria.exitDescription) {
    lines.push(`  Exit: ${sessionResult.criteria.exitDescription}`);
  }
  lines.push("");

  // Options
  if (sessionResult.options.minAtrPercent) {
    lines.push(`Filters: minAtrPercent >= ${sessionResult.options.minAtrPercent}%`);
    lines.push("");
  }

  // Summary
  const s = sessionResult.summary;
  lines.push("Summary:");
  lines.push(`  Total Files: ${s.totalFiles}`);
  lines.push(`  Processed: ${s.processedFiles}`);
  lines.push(`  Skipped: ${s.skippedFiles}`);
  lines.push(`  Entry Signals: ${s.entrySignals}`);
  lines.push(`  Exit Signals: ${s.exitSignals}`);
  lines.push(`  Processing Time: ${s.processingTimeMs}ms`);
  lines.push("");

  // Results table
  const results = showAll
    ? sessionResult.results
    : sessionResult.results.filter((r) => r.entrySignal || r.exitSignal);

  if (results.length === 0) {
    lines.push("No signals found.");
    return lines.join("\n");
  }

  // Table header
  const header = [
    "Ticker".padEnd(12),
    "Signal".padEnd(8),
    "Price".padStart(10),
    "ATR%".padStart(8),
    "RSI".padStart(6),
    "VolRatio".padStart(10),
  ].join(" | ");

  lines.push("-".repeat(header.length + 4));
  lines.push(`| ${header} |`);
  lines.push("-".repeat(header.length + 4));

  for (const r of results) {
    let signal = "-";
    if (r.entrySignal && r.exitSignal) {
      signal = "BOTH";
    } else if (r.entrySignal) {
      signal = "ENTRY";
    } else if (r.exitSignal) {
      signal = "EXIT";
    }

    const row = [
      r.ticker.padEnd(12),
      signal.padEnd(8),
      r.currentPrice.toFixed(0).padStart(10),
      `${r.atrPercent.toFixed(2)}%`.padStart(8),
      (r.metrics.rsi14?.toFixed(0) ?? "-").padStart(6),
      (r.metrics.volumeRatio?.toFixed(2) ?? "-").padStart(10),
    ].join(" | ");
    lines.push(`| ${row} |`);
  }

  lines.push("-".repeat(header.length + 4));

  return lines.join("\n");
}
