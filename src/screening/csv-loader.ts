/**
 * CSV file loading utilities for screening (Node.js-only)
 *
 * This module requires Node.js fs module.
 * For browser-compatible CSV parsing, use csv-parser.ts instead.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import type { CsvLoadError, CsvLoadResult } from "./types";
import { parseCsv } from "./csv-parser";

// Re-export parseCsv for backwards compatibility
export { parseCsv } from "./csv-parser";

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
