/**
 * Format utilities for price, time, and volume display.
 * Provides auto-precision formatting and customization hooks.
 */

// ============================================
// Price Formatting
// ============================================

/**
 * Auto-format price based on magnitude.
 * - >= 10000 → "12,345" (0 decimals)
 * - >= 100   → "234.56" (2 decimals)
 * - >= 1     → "1.234" (3 decimals)
 * - >= 0.01  → "0.0456" (4 decimals)
 * - < 0.01   → "0.00001234" (8 decimals)
 */
export function autoFormatPrice(price: number): string {
  const abs = Math.abs(price);
  if (!Number.isFinite(price)) return "—";
  if (abs === 0) return "0";
  if (abs >= 10000) return price.toFixed(0);
  if (abs >= 100) return price.toFixed(2);
  if (abs >= 1) return price.toFixed(3);
  if (abs >= 0.01) return price.toFixed(4);
  if (abs >= 0.0001) return price.toFixed(6);
  return price.toFixed(8);
}

/**
 * Detect optimal decimal precision from a dataset.
 * Useful for setting a consistent precision across the entire chart.
 */
export function detectPrecision(prices: number[]): number {
  if (prices.length === 0) return 2;
  const median = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];
  const abs = Math.abs(median);
  if (abs >= 10000) return 0;
  if (abs >= 100) return 2;
  if (abs >= 1) return 3;
  if (abs >= 0.01) return 4;
  if (abs >= 0.0001) return 6;
  return 8;
}

/**
 * Create a fixed-precision price formatter.
 */
export function fixedPriceFormatter(decimals: number): (price: number) => string {
  return (price: number) => {
    if (!Number.isFinite(price)) return "—";
    return price.toFixed(decimals);
  };
}

// ============================================
// Time Formatting
// ============================================

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Smart time label formatting.
 * Uses the difference from the previous label to determine the appropriate level of detail.
 *
 * @param time - Epoch milliseconds
 * @param prevTime - Previous label's epoch milliseconds (null for first label)
 * @returns Formatted string
 */
export function autoFormatTime(time: number, prevTime: number | null): string {
  const d = new Date(time);
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();

  if (prevTime === null) {
    // First label: show full date
    if (hours === 0 && minutes === 0) {
      return `${MONTH_NAMES[month]} ${day}`;
    }
    return `${MONTH_NAMES[month]} ${day} ${pad2(hours)}:${pad2(minutes)}`;
  }

  const prev = new Date(prevTime);

  // Year changed
  if (prev.getFullYear() !== year) {
    return `${year}`;
  }

  // Month changed
  if (prev.getMonth() !== month) {
    return `${MONTH_NAMES[month]}`;
  }

  // Day changed
  if (prev.getDate() !== day) {
    return `${MONTH_NAMES[month]} ${day}`;
  }

  // Same day: show time
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Format time for crosshair label (always show full detail).
 */
export function formatCrosshairTime(time: number): string {
  const d = new Date(time);
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = d.getHours();
  const min = d.getMinutes();

  if (h === 0 && min === 0) {
    return `${y}-${m}-${day}`;
  }
  return `${y}-${m}-${day} ${pad2(h)}:${pad2(min)}`;
}

// ============================================
// Volume Formatting
// ============================================

/**
 * Format volume with K/M/B abbreviation.
 */
export function formatVolume(vol: number): string {
  if (!Number.isFinite(vol)) return "—";
  const abs = Math.abs(vol);
  if (abs >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

// ============================================
// Helpers
// ============================================

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
