/**
 * File parsing utilities for CSV data
 */

import type { NormalizedCandle } from "trendcraft";
import type { FundamentalData } from "../types";

/**
 * Result of parsing a CSV file
 */
export interface ParseResult {
  candles: NormalizedCandle[];
  fundamentals: FundamentalData | null;
}

/**
 * Read file content as text with Shift-JIS support
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    // Try Shift-JIS first (for Japanese CSV files)
    reader.readAsText(file, "Shift_JIS");
  });
}

/**
 * Parse CSV text to candles with optional fundamental data (PER/PBR)
 */
export function parseCSV(text: string): ParseResult {
  const lines = text.trim().split("\n");
  const candles: NormalizedCandle[] = [];
  const perValues: (number | null)[] = [];
  const pbrValues: (number | null)[] = [];
  let hasFundamentals = false;

  for (let i = 1; i < lines.length; i++) {
    // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 6) continue;

    const [dateStr, open, high, low, close, volume, adjClose, perStr, pbrStr] = parts;

    // Parse date (format: 2025/12/12 or 2025-12-12)
    const dateParts = dateStr.split(/[\/\-]/);
    if (dateParts.length !== 3) continue;

    const date = new Date(
      Number.parseInt(dateParts[0]),
      Number.parseInt(dateParts[1]) - 1,
      Number.parseInt(dateParts[2]),
    );

    if (Number.isNaN(date.getTime())) continue;

    // Use adjusted close if available to handle stock splits
    const rawClose = Number.parseFloat(close);
    const adjustedClose = adjClose ? Number.parseFloat(adjClose) : rawClose;
    const adjustmentRatio = adjustedClose / rawClose;

    candles.push({
      time: date.getTime(),
      open: Number.parseFloat(open) * adjustmentRatio,
      high: Number.parseFloat(high) * adjustmentRatio,
      low: Number.parseFloat(low) * adjustmentRatio,
      close: adjustedClose,
      volume: Number.parseFloat(volume),
    });

    // Parse PER/PBR (optional columns 8 and 9)
    const per = perStr ? Number.parseFloat(perStr) : null;
    const pbr = pbrStr ? Number.parseFloat(pbrStr) : null;
    perValues.push(Number.isNaN(per as number) ? null : per);
    pbrValues.push(Number.isNaN(pbr as number) ? null : pbr);

    // Check if we have any valid fundamental data
    if (per !== null && !Number.isNaN(per as number)) hasFundamentals = true;
    if (pbr !== null && !Number.isNaN(pbr as number)) hasFundamentals = true;
  }

  // Sort by time ascending (in case CSV is in descending order)
  // We need to sort fundamentals along with candles
  const indexed = candles.map((c, i) => ({ candle: c, per: perValues[i], pbr: pbrValues[i] }));
  indexed.sort((a, b) => a.candle.time - b.candle.time);

  const sortedCandles = indexed.map((item) => item.candle);
  const sortedPer = indexed.map((item) => item.per);
  const sortedPbr = indexed.map((item) => item.pbr);

  return {
    candles: sortedCandles,
    fundamentals: hasFundamentals ? { per: sortedPer, pbr: sortedPbr } : null,
  };
}

/**
 * Parse file and return candles with optional fundamental data
 */
export async function parseFile(file: File): Promise<ParseResult> {
  const text = await readFileAsText(file);
  return parseCSV(text);
}
