/**
 * Market Profile / TPO (Time Price Opportunity)
 *
 * Analyzes how much time price spends at each level,
 * identifying POC, Value Area High/Low per session.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Market Profile value
 */
export type MarketProfileValue = {
  /** Point of Control — price level with most time */
  poc: number | null;
  /** Value Area High */
  valueAreaHigh: number | null;
  /** Value Area Low */
  valueAreaLow: number | null;
  /** TPO profile: price level → count of time periods at that level */
  profile: Map<number, number> | null;
};

/**
 * Market Profile options
 */
export type MarketProfileOptions = {
  /**
   * Price bucket size. If 0 or undefined, auto-calculated from data range.
   * (default: 0 = auto)
   */
  tickSize?: number;
  /**
   * Session reset logic:
   * - 'session': Reset at the start of each day (default)
   * - number: Reset every N candles
   */
  sessionResetPeriod?: "session" | number;
  /** Percentage of TPOs that define the Value Area (default: 0.70) */
  valueAreaPercent?: number;
};

/**
 * Calculate Market Profile
 *
 * Tracks how many time periods price visits each price level.
 * Outputs POC (most visited level) and Value Area for each bar.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Options
 * @returns Series of Market Profile values
 *
 * @example
 * ```ts
 * const mp = marketProfile(candles, { tickSize: 0.5 });
 * const { poc, valueAreaHigh, valueAreaLow } = mp[i].value;
 * ```
 */
export function marketProfile(
  candles: Candle[] | NormalizedCandle[],
  options: MarketProfileOptions = {},
): Series<MarketProfileValue> {
  const {
    tickSize: rawTickSize = 0,
    sessionResetPeriod = "session",
    valueAreaPercent = 0.7,
  } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Auto-detect tick size if not specified
  const tickSize = rawTickSize > 0 ? rawTickSize : autoTickSize(normalized);

  const result: Series<MarketProfileValue> = [];
  const MS_PER_DAY = 86400000;

  let profile = new Map<number, number>();
  let lastDayIndex = -1;
  let sessionStart = 0;

  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    const currentDayIndex = Math.floor(c.time / MS_PER_DAY);

    // Check if we need to reset
    const shouldReset =
      (sessionResetPeriod === "session" &&
        currentDayIndex !== lastDayIndex &&
        lastDayIndex !== -1) ||
      (typeof sessionResetPeriod === "number" && i - sessionStart >= sessionResetPeriod);

    if (shouldReset) {
      profile = new Map();
      sessionStart = i;
    }

    lastDayIndex = currentDayIndex;

    // Add TPOs for this candle's price range
    const low = Math.floor(c.low / tickSize) * tickSize;
    const high = Math.ceil(c.high / tickSize) * tickSize;

    for (let price = low; price <= high; price = roundTick(price + tickSize, tickSize)) {
      profile.set(price, (profile.get(price) ?? 0) + 1);
    }

    // Find POC (highest count)
    let poc: number | null = null;
    let maxCount = 0;
    for (const [price, count] of profile) {
      if (count > maxCount) {
        maxCount = count;
        poc = price;
      }
    }

    // Calculate Value Area
    const { vah, val } = calculateValueArea(profile, valueAreaPercent);

    result.push({
      time: c.time,
      value: {
        poc,
        valueAreaHigh: vah,
        valueAreaLow: val,
        profile: new Map(profile),
      },
    });
  }

  return result;
}

/**
 * Auto-detect tick size from price data
 */
function autoTickSize(candles: NormalizedCandle[]): number {
  let high = Number.NEGATIVE_INFINITY;
  let low = Number.POSITIVE_INFINITY;
  for (const c of candles) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
  }
  const range = high - low;
  if (range === 0) return 1;

  // Target ~50 levels
  const rawTick = range / 50;
  // Round to a nice number
  const magnitude = 10 ** Math.floor(Math.log10(rawTick));
  return Math.max(magnitude, rawTick - (rawTick % magnitude) || magnitude);
}

/**
 * Round to avoid floating point issues
 */
function roundTick(value: number, tickSize: number): number {
  return Math.round(value / tickSize) * tickSize;
}

/**
 * Calculate Value Area from profile
 */
function calculateValueArea(
  profile: Map<number, number>,
  valueAreaPercent: number,
): { vah: number | null; val: number | null } {
  if (profile.size === 0) {
    return { vah: null, val: null };
  }

  // Sort by price
  const entries = [...profile.entries()].sort((a, b) => a[0] - b[0]);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0);
  const targetCount = totalCount * valueAreaPercent;

  // Find POC index
  let pocIdx = 0;
  let maxCount = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i][1] > maxCount) {
      maxCount = entries[i][1];
      pocIdx = i;
    }
  }

  // Expand from POC
  let areaCount = entries[pocIdx][1];
  let lo = pocIdx;
  let hi = pocIdx;

  while (areaCount < targetCount && (lo > 0 || hi < entries.length - 1)) {
    const belowCount = lo > 0 ? entries[lo - 1][1] : 0;
    const aboveCount = hi < entries.length - 1 ? entries[hi + 1][1] : 0;

    if (belowCount >= aboveCount && lo > 0) {
      lo--;
      areaCount += entries[lo][1];
    } else if (hi < entries.length - 1) {
      hi++;
      areaCount += entries[hi][1];
    } else if (lo > 0) {
      lo--;
      areaCount += entries[lo][1];
    }
  }

  return {
    val: entries[lo][0],
    vah: entries[hi][0],
  };
}
