/**
 * Fundamental metrics parser and utilities
 *
 * Provides functions to parse PER/PBR data from CSV and lookup by time.
 */

import type { FundamentalMetrics } from "../types";

/**
 * Parse options for fundamentals CSV
 */
export type ParseFundamentalsOptions = {
  /** Encoding for CSV content (default: 'utf-8') */
  encoding?: "utf-8" | "shift-jis";
  /** Column index for PER (0-based, default: 7) */
  perColumn?: number;
  /** Column index for PBR (0-based, default: 8) */
  pbrColumn?: number;
  /** Whether to skip header line (default: true) */
  skipHeader?: boolean;
};

/**
 * Parse PER/PBR from CSV content
 *
 * Expected CSV format: date,open,high,low,close,volume,adjusted_close,per,pbr
 * - Date format: YYYY/MM/DD or YYYY-MM-DD
 * - PER/PBR values can be empty or contain numeric values
 *
 * @param content CSV content as string
 * @param options Parsing options
 * @returns Array of FundamentalMetrics sorted by time ascending
 *
 * @example
 * ```ts
 * const csv = `date,open,high,low,close,volume,adjusted_close,per,pbr
 * 2024/1/5,100,105,99,104,1000000,104,15.5,1.2
 * 2024/1/6,104,110,103,108,1200000,108,16.0,1.25`;
 *
 * const fundamentals = parseFundamentals(csv);
 * // [
 * //   { time: 1704412800000, per: 15.5, pbr: 1.2 },
 * //   { time: 1704499200000, per: 16.0, pbr: 1.25 }
 * // ]
 * ```
 */
export function parseFundamentals(
  content: string,
  options: ParseFundamentalsOptions = {},
): FundamentalMetrics[] {
  const { perColumn = 7, pbrColumn = 8, skipHeader = true } = options;

  const lines = content.trim().split("\n");

  if (lines.length < (skipHeader ? 2 : 1)) {
    return [];
  }

  const dataLines = skipHeader ? lines.slice(1) : lines;
  const result: FundamentalMetrics[] = [];

  for (const line of dataLines) {
    const parts = line.split(",");

    if (parts.length < 1) continue;

    const dateStr = parts[0].trim();
    const time = parseDate(dateStr);

    if (time === null) continue;

    const per = parseNumericValue(parts[perColumn]);
    const pbr = parseNumericValue(parts[pbrColumn]);

    // Only include if at least one value is present
    if (per !== null || pbr !== null) {
      result.push({ time, per, pbr });
    } else {
      // Include entry with null values for consistency
      result.push({ time, per: null, pbr: null });
    }
  }

  // Sort by time ascending
  result.sort((a, b) => a.time - b.time);

  return result;
}

/**
 * Create a time-indexed map for fast fundamental lookup
 *
 * @param fundamentals Array of FundamentalMetrics
 * @returns Map with time as key for O(1) lookup
 *
 * @example
 * ```ts
 * const fundamentals = parseFundamentals(csvContent);
 * const map = createFundamentalsMap(fundamentals);
 *
 * const metrics = map.get(1704412800000);
 * console.log(metrics?.per); // 15.5
 * ```
 */
export function createFundamentalsMap(
  fundamentals: FundamentalMetrics[],
): Map<number, FundamentalMetrics> {
  const map = new Map<number, FundamentalMetrics>();

  for (const fund of fundamentals) {
    map.set(fund.time, fund);
  }

  return map;
}

/**
 * Get fundamental metrics for a specific time
 *
 * @param map Fundamentals map created by createFundamentalsMap
 * @param time Timestamp to lookup (epoch milliseconds)
 * @returns FundamentalMetrics if found, undefined otherwise
 *
 * @example
 * ```ts
 * const map = createFundamentalsMap(fundamentals);
 * const metrics = getFundamentalsAt(map, candle.time);
 *
 * if (metrics?.per !== null && metrics.per < 15) {
 *   // Undervalued stock
 * }
 * ```
 */
export function getFundamentalsAt(
  map: Map<number, FundamentalMetrics>,
  time: number,
): FundamentalMetrics | undefined {
  return map.get(time);
}

/**
 * Parse date string to epoch milliseconds
 * Supports YYYY/MM/DD and YYYY-MM-DD formats
 */
function parseDate(dateStr: string): number | null {
  if (!dateStr) return null;

  let normalized: string;

  if (dateStr.includes("/")) {
    // YYYY/M/D -> YYYY-MM-DD
    const parts = dateStr.split("/");
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  } else if (dateStr.includes("-")) {
    normalized = dateStr;
  } else {
    return null;
  }

  const date = new Date(`${normalized}T00:00:00Z`);
  const time = date.getTime();

  return Number.isNaN(time) ? null : time;
}

/**
 * Parse numeric value from string
 * Returns null for empty, undefined, or non-numeric values
 */
function parseNumericValue(value: string | undefined): number | null {
  if (value === undefined || value === null) return null;

  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-") return null;

  const num = Number.parseFloat(trimmed);
  return Number.isNaN(num) ? null : num;
}
