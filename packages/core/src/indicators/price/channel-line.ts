/**
 * Channel Line
 *
 * Draws a parallel channel (upper, middle, lower) based on trend direction.
 * - Uptrend: primary line connects last two swing lows, parallel line passes
 *   through the highest swing high between them.
 * - Downtrend: primary line connects last two swing highs, parallel line passes
 *   through the lowest swing low between them.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { swingPoints } from "./swing-points";

/**
 * Options for channel line calculation
 */
export type ChannelLineOptions = {
  /** Number of bars to the left for swing point confirmation (default: 10) */
  leftBars?: number;
  /** Number of bars to the right for swing point confirmation (default: 10) */
  rightBars?: number;
};

/**
 * Channel line result for each bar
 */
export type ChannelLineValue = {
  /** Upper channel line value */
  upper: number | null;
  /** Lower channel line value */
  lower: number | null;
  /** Middle channel line value (average of upper and lower) */
  middle: number | null;
  /** Channel direction: "up" or "down" */
  direction: "up" | "down" | null;
};

/**
 * Calculate channel lines based on swing points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Channel line options
 * @returns Series of channel line values
 *
 * @example
 * ```ts
 * const ch = channelLine(candles, { leftBars: 10, rightBars: 10 });
 * const last = ch[ch.length - 1].value;
 * console.log(`Upper: ${last.upper}, Lower: ${last.lower}, Dir: ${last.direction}`);
 * ```
 */
export function channelLine(
  candles: Candle[] | NormalizedCandle[],
  options: ChannelLineOptions = {},
): Series<ChannelLineValue> {
  const { leftBars = 10, rightBars = 10 } = options;

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  const swings = swingPoints(normalized, { leftBars, rightBars });

  const result: Series<ChannelLineValue> = [];

  const swingHighs: Array<{ index: number; price: number }> = [];
  const swingLows: Array<{ index: number; price: number }> = [];

  // Channel state
  let channelDefined = false;
  let channelDir: "up" | "down" = "up";
  let primarySlope = 0;
  let primaryAnchorIdx = 0;
  let primaryAnchorPrice = 0;
  let parallelOffset = 0; // offset from primary line to parallel line

  for (let i = 0; i < swings.length; i++) {
    const sp = swings[i].value;

    if (sp.isSwingHigh) {
      swingHighs.push({ index: i, price: normalized[i].high });
    }
    if (sp.isSwingLow) {
      swingLows.push({ index: i, price: normalized[i].low });
    }

    // Try to determine channel when we have at least 2 of both types
    if (swingLows.length >= 2 || swingHighs.length >= 2) {
      const hasUpCandidate = swingLows.length >= 2;
      const hasDownCandidate = swingHighs.length >= 2;

      let upValid = false;
      let downValid = false;

      // Up channel candidate
      let upSlope = 0;
      let upAnchorIdx = 0;
      let upAnchorPrice = 0;
      let upOffset = 0;
      let upLastIdx = 0;
      if (hasUpCandidate) {
        const sl1 = swingLows[swingLows.length - 2];
        const sl2 = swingLows[swingLows.length - 1];
        if (sl2.price > sl1.price) {
          upValid = true;
          upSlope = (sl2.price - sl1.price) / (sl2.index - sl1.index);
          upAnchorIdx = sl1.index;
          upAnchorPrice = sl1.price;
          upLastIdx = sl2.index;
          // Find highest swing high between sl1 and sl2
          let maxHighOffset = 0;
          for (const sh of swingHighs) {
            if (sh.index >= sl1.index && sh.index <= sl2.index) {
              const primaryAtSh = upAnchorPrice + upSlope * (sh.index - upAnchorIdx);
              const offset = sh.price - primaryAtSh;
              if (offset > maxHighOffset) {
                maxHighOffset = offset;
              }
            }
          }
          upOffset = maxHighOffset > 0 ? maxHighOffset : 0;
        }
      }

      // Down channel candidate
      let downSlope = 0;
      let downAnchorIdx = 0;
      let downAnchorPrice = 0;
      let downOffset = 0;
      let downLastIdx = 0;
      if (hasDownCandidate) {
        const sh1 = swingHighs[swingHighs.length - 2];
        const sh2 = swingHighs[swingHighs.length - 1];
        if (sh2.price < sh1.price) {
          downValid = true;
          downSlope = (sh2.price - sh1.price) / (sh2.index - sh1.index);
          downAnchorIdx = sh1.index;
          downAnchorPrice = sh1.price;
          downLastIdx = sh2.index;
          // Find lowest swing low between sh1 and sh2
          let maxLowOffset = 0;
          for (const sl of swingLows) {
            if (sl.index >= sh1.index && sl.index <= sh2.index) {
              const primaryAtSl = downAnchorPrice + downSlope * (sl.index - downAnchorIdx);
              const offset = primaryAtSl - sl.price;
              if (offset > maxLowOffset) {
                maxLowOffset = offset;
              }
            }
          }
          downOffset = maxLowOffset > 0 ? maxLowOffset : 0;
        }
      }

      if (upValid && downValid) {
        // Both valid: use the one with the more recent defining point
        if (upLastIdx >= downLastIdx) {
          channelDir = "up";
          primarySlope = upSlope;
          primaryAnchorIdx = upAnchorIdx;
          primaryAnchorPrice = upAnchorPrice;
          parallelOffset = upOffset;
        } else {
          channelDir = "down";
          primarySlope = downSlope;
          primaryAnchorIdx = downAnchorIdx;
          primaryAnchorPrice = downAnchorPrice;
          parallelOffset = downOffset;
        }
        channelDefined = true;
      } else if (upValid) {
        channelDir = "up";
        primarySlope = upSlope;
        primaryAnchorIdx = upAnchorIdx;
        primaryAnchorPrice = upAnchorPrice;
        parallelOffset = upOffset;
        channelDefined = true;
      } else if (downValid) {
        channelDir = "down";
        primarySlope = downSlope;
        primaryAnchorIdx = downAnchorIdx;
        primaryAnchorPrice = downAnchorPrice;
        parallelOffset = downOffset;
        channelDefined = true;
      }
    }

    if (channelDefined && i >= primaryAnchorIdx) {
      const primaryValue = primaryAnchorPrice + primarySlope * (i - primaryAnchorIdx);
      let upper: number;
      let lower: number;

      if (channelDir === "up") {
        // Primary line is lower, parallel is upper
        lower = primaryValue;
        upper = primaryValue + parallelOffset;
      } else {
        // Primary line is upper, parallel is lower
        upper = primaryValue;
        lower = primaryValue - parallelOffset;
      }

      const middle = (upper + lower) / 2;

      result.push({
        time: swings[i].time,
        value: { upper, lower, middle, direction: channelDir },
      });
    } else {
      result.push({
        time: swings[i].time,
        value: { upper: null, lower: null, middle: null, direction: null },
      });
    }
  }

  return tagSeries(result, { pane: "main", label: "Channel" });
}
