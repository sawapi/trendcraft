import type { NormalizedCandle } from "../types";

/**
 * Read file content as text with Shift-JIS support
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file, "Shift_JIS");
  });
}

/**
 * Parse CSV text to candles
 */
export function parseCSV(text: string): NormalizedCandle[] {
  const lines = text.trim().split("\n");
  const candles: NormalizedCandle[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 6) continue;

    const [dateStr, open, high, low, close, volume, adjClose] = parts;

    const dateParts = dateStr.split(/[\/\-]/);
    if (dateParts.length !== 3) continue;

    const date = new Date(
      Number.parseInt(dateParts[0]),
      Number.parseInt(dateParts[1]) - 1,
      Number.parseInt(dateParts[2])
    );

    if (isNaN(date.getTime())) continue;

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
  }

  return candles.sort((a, b) => a.time - b.time);
}

/**
 * Format timestamp to YYYY/MM/DD
 */
export function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
