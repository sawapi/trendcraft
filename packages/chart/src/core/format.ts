/**
 * Format utilities for price, time, and volume display.
 * Provides auto-precision formatting and customization hooks.
 */

import { wallClock } from "./time-zone";

// ============================================
// Price Formatting
// ============================================

/**
 * Auto-format price based on magnitude.
 * - >= 10000 → "12345" (0 decimals)
 * - >= 100   → "234.56" (2 decimals)
 * - >= 1     → "1.234" (3 decimals)
 * - >= 0.01  → "0.0456" (4 decimals)
 * - >= 0.0001 → "0.000123" (6 decimals)
 * - < 0.0001 → "0.00001234" (8 decimals)
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
  // Sort a copy: callers pass their own price arrays.
  const median = [...prices].sort((a, b) => a - b)[Math.floor(prices.length / 2)];
  const abs = Math.abs(median);
  if (abs >= 10000) return 0;
  if (abs >= 100) return 2;
  if (abs >= 1) return 3;
  if (abs >= 0.01) return 4;
  if (abs >= 0.0001) return 6;
  return 8;
}

/**
 * Units for price-axis ticks of a million and up, largest first. The axis
 * is a fixed 60px by default, which "140000000000" does not fit. As in
 * Highcharts, only axis labels are shortened: crosshair, badge and legend
 * prices keep every digit (BTC/JPY trades around 15,000,000).
 */
const PRICE_UNITS = [
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
] as const;

/**
 * A tick in the unit that `abs` (a million and up) calls for, with the
 * decimals the step needs in that unit; undefined below a million.
 */
function unitTick(price: number, abs: number, step: number) {
  const unit = PRICE_UNITS.find(([size]) => abs >= size);
  return unit && (price / unit[0]).toFixed(stepDecimals(step / unit[0])) + unit[1];
}

/** Decimals that show a tick step: 0.1 → 1, 0.25 → 2, 20 → 0. */
function stepDecimals(step: number): number {
  // The epsilon keeps steps like 0.1 (log10 = -0.9999…) at one decimal.
  return Math.min(10, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
}

/**
 * Tick label formatter for one price axis: every label gets the decimals the
 * tick step needs, so an axis reads "20, 40, … 140" or "1.21, 1.22, …"
 * rather than switching precision at 1 or 100 the way `autoFormatPrice`
 * does for a single value. Chart.js and d3 derive axis decimals from the
 * step the same way. Falls back to `autoFormatPrice` with fewer than two
 * ticks, where there is no step.
 *
 * From a million up, the labels take one M/B/T unit chosen by the largest
 * tick ("20B, 40B, … 140B"), unless that makes them longer, as on a narrow
 * range like 1,234,520–1,234,600.
 *
 * With `log`, ticks that are all 1–9 × 10^k are labelled one by one (see
 * `logTickLabel`); a log axis over a narrow range falls back to linear
 * ticks, which keep the shared decimals.
 */
export function tickPriceFormatter(
  ticks: readonly number[],
  log = false,
): (price: number) => string {
  if (log && ticks.length > 1 && ticks.every(isLogTick)) return logTickLabel;
  if (ticks.length < 2) return autoFormatPrice;
  const step = Math.abs(ticks[1] - ticks[0]);
  if (!(step > 0) || !Number.isFinite(step)) return autoFormatPrice;
  const full = fixedPriceFormatter(stepDecimals(step));
  const maxAbs = Math.max(...ticks.map(Math.abs));
  const short = (price: number) =>
    (price && Number.isFinite(price) && unitTick(price, maxAbs, step)) || full(price);
  return short(maxAbs).length < full(maxAbs).length ? short : full;
}

/** True for a positive 1–9 × 10^k, the values a log axis ticks at. */
function isLogTick(price: number): boolean {
  if (!(price > 0)) return false;
  const m = price / 10 ** Math.floor(Math.log10(price) + 1e-9);
  return Math.abs(m - Math.round(m)) < 1e-6;
}

/**
 * A log-axis tick label. Log ticks have no common step, so each label shows
 * its own digits ("0.01, 0.1, 1, 10") and, from a million up, its own unit
 * ("1M, 100M, 10B"), as d3's log tickFormat labels each tick on its own.
 */
function logTickLabel(price: number): string {
  const unit = PRICE_UNITS.find(([size]) => price >= size);
  const scaled = unit ? price / unit[0] : price;
  let decimals = 0;
  while (decimals < 10 && Math.abs(Number(scaled.toFixed(decimals)) - scaled) > scaled * 1e-9)
    decimals++;
  return scaled.toFixed(decimals) + (unit ? unit[1] : "");
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

/** One day in milliseconds — the threshold at/above which a series is "daily+". */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Smart time label formatting.
 * Uses the difference from the previous label to determine the appropriate level of detail.
 *
 * @param time - Epoch milliseconds
 * @param prevTime - Previous label's epoch milliseconds (null for first label)
 * @param intervalMs - Optional dominant bar interval. When the series is
 *   daily-grained or coarser, the first label's wall-clock time is suppressed
 *   (see below). Omit to keep the legacy "show time if non-midnight" behavior.
 * @param timeZone - IANA zone to read the wall clock in (browser local when omitted)
 * @returns Formatted string
 */
export function autoFormatTime(
  time: number,
  prevTime: number | null,
  intervalMs?: number,
  timeZone?: string,
): string {
  const d = wallClock(time, timeZone);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();

  if (prevTime === null) {
    // First label: show full date. The wall-clock time is suppressed for
    // daily+ bars, where the hour is a timezone artifact (e.g. a 00:00 UTC
    // daily bar renders as 09:00 in JST) that would clash with the bare
    // month/year anchors used for every later tick. With no interval hint we
    // keep the legacy behavior of showing the time when it is non-midnight.
    const coarse = (intervalMs ?? 0) >= DAY_MS;
    if ((hours === 0 && minutes === 0) || coarse) {
      return `${MONTH_NAMES[month]} ${day}`;
    }
    return `${MONTH_NAMES[month]} ${day} ${pad2(hours)}:${pad2(minutes)}`;
  }

  const prev = wallClock(prevTime, timeZone);

  // Year changed
  if (prev.getUTCFullYear() !== year) {
    return `${year}`;
  }

  // Month changed
  if (prev.getUTCMonth() !== month) {
    return `${MONTH_NAMES[month]}`;
  }

  // Anchor a time label when the jump is "big" AND the destination bar is at
  // a different time-of-day than the previous one. Daily / weekly data keeps
  // bars at a consistent hour (e.g. 00:00 or 09:30), so the hour is noise.
  // Session gaps (overnight, weekend) move between different times-of-day.
  // Daily and coarser bars carry no meaningful wall-clock time: their hour is
  // a feed or timezone artifact that also shifts by an hour at every DST
  // change, which the time-of-day test below would read as a session gap.
  const coarse = (intervalMs ?? 0) >= DAY_MS;
  const bigJump = !coarse && time - prevTime > 4 * 60 * 60 * 1000;
  const prevTod = prev.getUTCHours() * 60 + prev.getUTCMinutes();
  const curTod = hours * 60 + minutes;
  const sameTimeOfDay = Math.abs(prevTod - curTod) < 60;
  const nearMidnight = hours === 0 && minutes < 30;
  const anchorTime = bigJump && !nearMidnight && !sameTimeOfDay;

  // Day changed
  if (prev.getUTCDate() !== day) {
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
 * Format a wall-clock time as a short axis label (HH:MM), 24-hour, in
 * `timeZone` (browser local when omitted).
 */
export function formatShortTime(time: number, timeZone?: string): string {
  const d = wallClock(time, timeZone);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/**
 * Format a date as a short axis anchor ("Mar 16" or "2026" at year boundaries).
 * Locale-aware via the MONTH_NAMES table.
 */
export function formatShortDate(
  time: number,
  prevTime: number | null = null,
  timeZone?: string,
): string {
  const d = wallClock(time, timeZone);
  const label = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
  if (prevTime !== null && wallClock(prevTime, timeZone).getUTCFullYear() !== d.getUTCFullYear()) {
    return `${d.getUTCFullYear()}`;
  }
  return label;
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
 * Format time for crosshair label, in `timeZone` (browser local when
 * omitted). Shows the date, plus the wall-clock time unless it is midnight
 * or the bars are daily or coarser (`intervalMs` ≥ one day), where the hour
 * is a time-zone artifact; the time axis applies the same rule.
 *
 * @param time - Epoch milliseconds
 * @param timeZone - IANA zone to read the wall clock in
 * @param intervalMs - Bar interval, e.g. from the candles' spacing
 */
export function formatCrosshairTime(time: number, timeZone?: string, intervalMs?: number): string {
  const d = wallClock(time, timeZone);
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  const h = d.getUTCHours();
  const min = d.getUTCMinutes();

  if ((h === 0 && min === 0) || (intervalMs ?? 0) >= DAY_MS) {
    return `${y}-${m}-${day}`;
  }
  return `${y}-${m}-${day} ${pad2(h)}:${pad2(min)}`;
}

/**
 * Bar interval of a candle series: the smallest positive gap among its first
 * 32 bars (a weekend or holiday gap is larger, so it does not count). `0`
 * with fewer than two bars.
 */
export function estimateBarIntervalMs(candles: readonly { time: number }[]): number {
  const n = candles.length;
  if (n < 2) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (let i = 1; i < n && i <= 32; i++) {
    const dt = candles[i].time - candles[i - 1].time;
    if (dt > 0 && dt < min) min = dt;
  }
  return Number.isFinite(min) ? min : 0;
}

// ============================================
// Volume Formatting
// ============================================

/**
 * Format volume with K/M/B abbreviation. Below 1,000 a whole number is shown
 * as is and a fractional one (crypto, fractional shares) to 3 significant
 * digits without trailing zeros or exponent, so 0.3 reads "0.3", not "0".
 * The unit is chosen after rounding, so 999.96K reads "1.0M", not "1000.0K".
 */
export function formatVolume(vol: number): string {
  if (!Number.isFinite(vol)) return "—";
  const abs = Math.abs(vol);
  if (abs >= 999_950_000) return `${(vol / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 999_950) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (abs >= 999.5) return `${(vol / 1_000).toFixed(1)}K`;
  if (Number.isInteger(vol) || abs === 0) return vol.toFixed(0);
  const digits = Math.min(20, Math.max(0, 2 - Math.floor(Math.log10(abs))));
  const text = vol.toFixed(digits);
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
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
