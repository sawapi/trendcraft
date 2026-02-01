/**
 * Order Block Detection
 *
 * Order Blocks are zones where institutional traders placed significant orders.
 * They are identified by finding the last opposing candle before a Break of Structure (BOS).
 *
 * Bullish Order Block: The last bearish candle before a bullish BOS
 * Bearish Order Block: The last bullish candle before a bearish BOS
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import { breakOfStructure } from "../price/break-of-structure";
import { volumeMa } from "../volume/volume-ma";

/**
 * Individual Order Block
 */
export type OrderBlock = {
  /** Order block type */
  type: "bullish" | "bearish";
  /** Upper boundary of the order block (candle high) */
  high: number;
  /** Lower boundary of the order block (candle low) */
  low: number;
  /** Open price of the order block candle */
  open: number;
  /** Close price of the order block candle */
  close: number;
  /** Index where the order block was created */
  startIndex: number;
  /** Time when the order block was created */
  startTime: number;
  /** Strength score (0-100) based on volume and move size */
  strength: number;
  /** Whether the order block has been mitigated (price returned to it) */
  mitigated: boolean;
  /** Index where the order block was mitigated (null if not mitigated) */
  mitigatedIndex: number | null;
  /** Time when the order block was mitigated (null if not mitigated) */
  mitigatedTime: number | null;
};

/**
 * Order Block detection result
 */
export type OrderBlockValue = {
  /** New order block created at this bar */
  newOrderBlock: OrderBlock | null;
  /** Currently active (not mitigated) order blocks */
  activeOrderBlocks: OrderBlock[];
  /** Order blocks that were mitigated at this bar */
  mitigatedThisBar: OrderBlock[];
  /** Is price currently at a bullish order block zone? */
  atBullishOB: boolean;
  /** Is price currently at a bearish order block zone? */
  atBearishOB: boolean;
};

/**
 * Options for Order Block detection
 */
export type OrderBlockOptions = {
  /** Swing detection period for BOS (default: 5) */
  swingPeriod?: number;
  /** Volume MA period for strength calculation (default: 20) */
  volumePeriod?: number;
  /** Minimum volume ratio above average for valid OB (default: 1.0, no filter) */
  minVolumeRatio?: number;
  /** Maximum number of active order blocks to track (default: 10) */
  maxActiveOBs?: number;
  /** Consider partial touch as mitigation (default: true) */
  partialMitigation?: boolean;
};

/**
 * Detect Order Blocks
 *
 * An Order Block is identified when:
 * 1. A Break of Structure (BOS) occurs
 * 2. The last opposing candle before the BOS becomes the Order Block
 * 3. Optionally, the candle has above-average volume
 *
 * Order Blocks act as support/resistance zones where price often returns.
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Order Block options
 * @returns Series of Order Block values
 *
 * @example
 * ```ts
 * const obs = orderBlock(candles, { swingPeriod: 5, minVolumeRatio: 1.2 });
 *
 * const lastOb = obs[obs.length - 1].value;
 *
 * // Check for new order block
 * if (lastOb.newOrderBlock) {
 *   console.log(`New ${lastOb.newOrderBlock.type} OB at ${lastOb.newOrderBlock.low}-${lastOb.newOrderBlock.high}`);
 * }
 *
 * // Check if price is at an order block zone
 * if (lastOb.atBullishOB) {
 *   console.log("Price is at a bullish order block - potential support");
 * }
 * ```
 */
export function orderBlock(
  candles: Candle[] | NormalizedCandle[],
  options: OrderBlockOptions = {},
): Series<OrderBlockValue> {
  const {
    swingPeriod = 5,
    volumePeriod = 20,
    minVolumeRatio = 1.0,
    maxActiveOBs = 10,
    partialMitigation = true,
  } = options;

  if (swingPeriod < 1) throw new Error("swingPeriod must be at least 1");
  if (volumePeriod < 1) throw new Error("volumePeriod must be at least 1");
  if (minVolumeRatio < 0) throw new Error("minVolumeRatio must be non-negative");
  if (maxActiveOBs < 1) throw new Error("maxActiveOBs must be at least 1");

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  // Get BOS data
  const bosData = breakOfStructure(normalized, { swingPeriod });

  // Get volume MA for strength calculation
  const volMa = volumeMa(normalized, { period: volumePeriod });

  const result: Series<OrderBlockValue> = [];

  // Track active order blocks
  let activeOrderBlocks: OrderBlock[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const candle = normalized[i];
    const bos = bosData[i]?.value;
    const currentVolMa = volMa[i]?.value ?? null;

    let newOrderBlock: OrderBlock | null = null;
    const mitigatedThisBar: OrderBlock[] = [];

    // Check for new Order Block on BOS
    if (bos && (bos.bullishBos || bos.bearishBos)) {
      // Find the last opposing candle before BOS
      const obCandle = findOrderBlockCandle(normalized, i, bos.bullishBos ? "bullish" : "bearish");

      if (obCandle) {
        // Calculate strength based on volume and move size
        const volumeRatio =
          currentVolMa !== null && currentVolMa > 0
            ? normalized[obCandle.index].volume / currentVolMa
            : 1;

        // Only create OB if volume filter passes
        if (volumeRatio >= minVolumeRatio) {
          const obCandleData = normalized[obCandle.index];

          // Calculate strength (0-100)
          const moveStrength = calculateMoveStrength(normalized, obCandle.index, i);
          const volumeStrength = Math.min(volumeRatio / 2, 1) * 50; // Cap at 50 points
          const strength = Math.round(moveStrength + volumeStrength);

          newOrderBlock = {
            type: bos.bullishBos ? "bullish" : "bearish",
            high: obCandleData.high,
            low: obCandleData.low,
            open: obCandleData.open,
            close: obCandleData.close,
            startIndex: obCandle.index,
            startTime: obCandleData.time,
            strength: Math.min(100, strength),
            mitigated: false,
            mitigatedIndex: null,
            mitigatedTime: null,
          };

          // Add to active list
          activeOrderBlocks.push(newOrderBlock);
          if (activeOrderBlocks.length > maxActiveOBs) {
            activeOrderBlocks = activeOrderBlocks.slice(-maxActiveOBs);
          }
        }
      }
    }

    // Check for mitigation (price returns to OB zone)
    let atBullishOB = false;
    let atBearishOB = false;

    activeOrderBlocks = activeOrderBlocks.filter((ob) => {
      // Skip if this is the creation bar
      if (i <= ob.startIndex) {
        return true;
      }

      const isMitigated = checkMitigation(candle, ob, partialMitigation);

      if (isMitigated) {
        ob.mitigated = true;
        ob.mitigatedIndex = i;
        ob.mitigatedTime = candle.time;
        mitigatedThisBar.push(ob);
        return false; // Remove from active
      }

      // Check if price is at OB zone (for signals)
      if (ob.type === "bullish" && candle.low <= ob.high && candle.high >= ob.low) {
        atBullishOB = true;
      }
      if (ob.type === "bearish" && candle.high >= ob.low && candle.low <= ob.high) {
        atBearishOB = true;
      }

      return true;
    });

    result.push({
      time: candle.time,
      value: {
        newOrderBlock,
        activeOrderBlocks: [...activeOrderBlocks],
        mitigatedThisBar,
        atBullishOB,
        atBearishOB,
      },
    });
  }

  return result;
}

/**
 * Find the order block candle (last opposing candle before BOS)
 */
function findOrderBlockCandle(
  candles: NormalizedCandle[],
  bosIndex: number,
  bosType: "bullish" | "bearish",
): { index: number } | null {
  const lookbackLimit = Math.min(bosIndex, 10);
  const lookForBearish = bosType === "bullish";

  for (let i = bosIndex - 1; i >= bosIndex - lookbackLimit && i >= 0; i--) {
    const candle = candles[i];
    const isBearish = candle.close < candle.open;
    const isBullish = candle.close > candle.open;

    if ((lookForBearish && isBearish) || (!lookForBearish && isBullish)) {
      return { index: i };
    }
  }

  return null;
}

/**
 * Calculate move strength based on how much price moved after OB formation
 */
function calculateMoveStrength(
  candles: NormalizedCandle[],
  obIndex: number,
  bosIndex: number,
): number {
  const obCandle = candles[obIndex];
  const bosCandle = candles[bosIndex];

  // Calculate percentage move from OB to BOS
  const isBullish = bosCandle.close > obCandle.close;
  const move = isBullish
    ? ((bosCandle.close - obCandle.low) / obCandle.low) * 100
    : ((obCandle.high - bosCandle.close) / obCandle.high) * 100;

  // Convert to 0-50 scale (50 max points for move)
  return Math.min(move * 10, 50);
}

/**
 * Check if an order block has been mitigated
 */
function checkMitigation(
  candle: NormalizedCandle,
  ob: OrderBlock,
  partialMitigation: boolean,
): boolean {
  if (ob.type === "bullish") {
    const threshold = partialMitigation ? ob.high : ob.low;
    return candle.low <= threshold;
  }
  const threshold = partialMitigation ? ob.low : ob.high;
  return candle.high >= threshold;
}

/**
 * Get all active (non-mitigated) order blocks at the end of the series
 */
export function getActiveOrderBlocks(
  candles: Candle[] | NormalizedCandle[],
  options: OrderBlockOptions = {},
): { bullish: OrderBlock[]; bearish: OrderBlock[] } {
  const obSeries = orderBlock(candles, options);

  if (obSeries.length === 0) {
    return { bullish: [], bearish: [] };
  }

  const last = obSeries[obSeries.length - 1].value;
  return {
    bullish: last.activeOrderBlocks.filter((ob) => ob.type === "bullish"),
    bearish: last.activeOrderBlocks.filter((ob) => ob.type === "bearish"),
  };
}

/**
 * Find nearest order block to current price
 */
export function getNearestOrderBlock(
  candles: Candle[] | NormalizedCandle[],
  options: OrderBlockOptions = {},
): OrderBlock | null {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return null;
  }

  const currentPrice = normalized[normalized.length - 1].close;
  const { bullish, bearish } = getActiveOrderBlocks(candles, options);

  let nearestOB: OrderBlock | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  // Check bullish OBs (below price, support)
  for (const ob of bullish) {
    const distance = Math.abs(currentPrice - ob.high);
    if (distance < minDistance) {
      minDistance = distance;
      nearestOB = ob;
    }
  }

  // Check bearish OBs (above price, resistance)
  for (const ob of bearish) {
    const distance = Math.abs(currentPrice - ob.low);
    if (distance < minDistance) {
      minDistance = distance;
      nearestOB = ob;
    }
  }

  return nearestOB;
}
