/**
 * CSV parsing utilities (browser-compatible)
 *
 * This module contains only browser-safe code without Node.js fs dependencies.
 */

import { normalizeCandles } from "../core/normalize";
import type { NormalizedCandle } from "../types";

/**
 * Parse CSV content to candles
 * Supports formats:
 * - YYYY/MM/DD (e.g., 2024/1/5)
 * - YYYY-MM-DD (e.g., 2024-01-05)
 *
 * Expected columns: date,open,high,low,close,volume[,adjusted_close]
 */
export function parseCsv(content: string): NormalizedCandle[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV file has no data rows");
  }

  // Skip header line
  const dataLines = lines.slice(1);

  const rawCandles = dataLines.map((line, idx) => {
    const parts = line.split(",");
    if (parts.length < 6) {
      throw new Error(`Invalid CSV format at line ${idx + 2}: expected at least 6 columns`);
    }

    const [date, open, high, low, close, volume] = parts;

    // Parse date - normalize to YYYY-MM-DD format
    let normalizedDate: string;
    if (date.includes("/")) {
      // YYYY/M/D -> YYYY-MM-DD
      const [year, month, day] = date.split("/");
      normalizedDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    } else {
      // Already YYYY-MM-DD format
      normalizedDate = date;
    }

    return {
      time: normalizedDate,
      open: Number.parseFloat(open),
      high: Number.parseFloat(high),
      low: Number.parseFloat(low),
      close: Number.parseFloat(close),
      volume: Number.parseFloat(volume),
    };
  });

  // Sort by date ascending
  rawCandles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return normalizeCandles(rawCandles);
}
