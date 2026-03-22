/**
 * File handling: drag-drop, CSV parsing
 */

import type { NormalizedCandle } from "trendcraft";

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
 * Parse CSV text to candles
 */
export function parseCSV(text: string): NormalizedCandle[] {
  const lines = text.trim().split("\n");
  const candles: NormalizedCandle[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Skip header
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(",");
    if (parts.length < 6) continue;

    const [dateStr, open, high, low, close, volume, adjClose] = parts;

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
  }

  return candles;
}

/**
 * Setup drop zone event handlers
 */
export function setupDropZone(
  dropZone: HTMLDivElement,
  fileInput: HTMLInputElement,
  onFile: (file: File) => void,
): void {
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) onFile(file);
  });

  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  });
}
