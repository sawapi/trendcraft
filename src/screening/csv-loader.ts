/**
 * CSV file loading utilities for screening
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { normalizeCandles } from "../core/normalize";
import type { NormalizedCandle } from "../types";
import type { CsvLoadError, CsvLoadResult } from "./types";

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

/**
 * Load single CSV file
 */
export function loadCsvFile(filepath: string): CsvLoadResult {
  const content = readFileSync(filepath, "utf-8");
  const ticker = basename(filepath, ".csv");
  const candles = parseCsv(content);
  return { ticker, candles };
}

/**
 * Get all CSV files in a directory
 */
export function getCsvFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory not found: ${dirPath}`);
  }

  const stat = statSync(dirPath);
  if (!stat.isDirectory()) {
    throw new Error(`Not a directory: ${dirPath}`);
  }

  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => join(dirPath, f));
}

/**
 * Load all CSV files from directory
 */
export function loadCsvDirectory(
  dirPath: string,
  options: {
    onProgress?: (loaded: number, total: number, ticker: string) => void;
  } = {},
): { results: CsvLoadResult[]; errors: CsvLoadError[] } {
  const { onProgress } = options;

  const files = getCsvFiles(dirPath);
  const results: CsvLoadResult[] = [];
  const errors: CsvLoadError[] = [];

  for (let i = 0; i < files.length; i++) {
    const filepath = files[i];
    const ticker = basename(filepath, ".csv");

    try {
      const result = loadCsvFile(filepath);
      results.push(result);
      onProgress?.(i + 1, files.length, ticker);
    } catch (e) {
      errors.push({ ticker, error: String(e) });
    }
  }

  return { results, errors };
}
