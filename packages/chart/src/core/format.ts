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

let MONTH_NAMES = [
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

/** Override month abbreviations for i18n */
export function setMonthNames(names: readonly string[]): void {
  if (names.length === 12) MONTH_NAMES = [...names];
}

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

  // Anchor a time label when the jump is "big" AND the destination bar is at
  // a different time-of-day than the previous one. Daily / weekly data keeps
  // bars at a consistent hour (e.g. 00:00 or 09:30), so the hour is noise.
  // Session gaps (overnight, weekend) move between different times-of-day.
  const bigJump = time - prevTime > 4 * 60 * 60 * 1000;
  const prevTod = prev.getHours() * 60 + prev.getMinutes();
  const curTod = hours * 60 + minutes;
  const sameTimeOfDay = Math.abs(prevTod - curTod) < 60;
  const nearMidnight = hours === 0 && minutes < 30;
  const anchorTime = bigJump && !nearMidnight && !sameTimeOfDay;

  // Day changed (local TZ)
  if (prev.getDate() !== day) {
    return anchorTime
      ? `${MONTH_NAMES[month]} ${day} ${pad2(hours)}:${pad2(minutes)}`
      : `${MONTH_NAMES[month]} ${day}`;
  }

  // Same local day, but a big time jump — likely a session gap (e.g. AAPL
  // overnight viewed from Japan, where Mon ET 16:00 and Tue ET 09:30 both
  // fall on the same JST day). Surface the date to anchor the viewer.
  if (anchorTime) {
    return `${MONTH_NAMES[month]} ${day} ${pad2(hours)}:${pad2(minutes)}`;
  }

  // Same day: show time
  return `${pad2(hours)}:${pad2(minutes)}`;
}

/**
 * Format a wall-clock time as a short axis label (HH:MM).
 * Uses 24-hour format in browser local TZ.
 */
export function formatShortTime(time: number): string {
  const d = new Date(time);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Format a date as a short axis anchor ("Mar 16" or "2026" at year boundaries).
 * Locale-aware via the MONTH_NAMES table.
 */
export function formatShortDate(time: number, prevTime: number | null = null): string {
  const d = new Date(time);
  if (prevTime !== null) {
    const prev = new Date(prevTime);
    if (prev.getFullYear() !== d.getFullYear()) return `${d.getFullYear()}`;
    if (prev.getMonth() !== d.getMonth()) return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
  }
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/**
 * Nice tick-step candidates in ms. Used by {@link pickNiceStep} to choose a
 * readable wall-clock spacing (5 min, 15 min, 1 hour, 1 day, etc.) that fits
 * the visible span and target tick count.
 */
const NICE_STEPS_MS: readonly number[] = [
  60_000, // 1 min
  5 * 60_000, // 5 min
  10 * 60_000, // 10 min
  15 * 60_000, // 15 min
  30 * 60_000, // 30 min
  60 * 60_000, // 1 hour
  2 * 60 * 60_000, // 2 hours
  4 * 60 * 60_000, // 4 hours
  6 * 60 * 60_000, // 6 hours
  12 * 60 * 60_000, // 12 hours
  24 * 60 * 60_000, // 1 day
  2 * 24 * 60 * 60_000, // 2 days
  7 * 24 * 60 * 60_000, // 1 week
  30 * 24 * 60 * 60_000, // ~1 month
  90 * 24 * 60 * 60_000, // ~1 quarter
  365 * 24 * 60 * 60_000, // ~1 year
];

/**
 * Pick a readable wall-clock tick step for a time-axis spanning `rangeMs`
 * with at most `maxTicks` labels visible.
 */
export function pickNiceStep(rangeMs: number, maxTicks: number): number {
  if (rangeMs <= 0 || maxTicks <= 0) return NICE_STEPS_MS[0];
  const target = rangeMs / maxTicks;
  for (const step of NICE_STEPS_MS) {
    if (step >= target) return step;
  }
  return NICE_STEPS_MS[NICE_STEPS_MS.length - 1];
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
// Text Measurement Cache
// ============================================

const _textWidthCache = new Map<string, number>();
const TEXT_CACHE_MAX = 500;

/**
 * Cached version of ctx.measureText().width.
 * Avoids expensive synchronous text measurement on repeated calls
 * with the same font + text combination (common in per-frame rendering).
 */
export function measureTextWidth(ctx: CanvasRenderingContext2D, text: string): number {
  // Use ctx.font as part of the cache key
  const key = `${ctx.font}\t${text}`;
  const cached = _textWidthCache.get(key);
  if (cached !== undefined) return cached;
  const width = ctx.measureText(text).width;
  if (_textWidthCache.size >= TEXT_CACHE_MAX) _textWidthCache.clear();
  _textWidthCache.set(key, width);
  return width;
}

// ============================================
// Helpers
// ============================================

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
