/**
 * Parabolic SAR (Stop and Reverse)
 *
 * A trend-following indicator that provides potential entry and exit points.
 * Developed by J. Welles Wilder Jr.
 */

import { isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries } from "../../core/tag-series";
import type { Candle, NormalizedCandle, Series } from "../../types";

/**
 * Parabolic SAR options
 */
export type ParabolicSarOptions = {
  /** Acceleration factor step (default: 0.02) */
  step?: number;
  /** Maximum acceleration factor (default: 0.2) */
  max?: number;
};

/**
 * Parabolic SAR value
 */
export type ParabolicSarValue = {
  /** SAR value (support when bullish, resistance when bearish) */
  sar: number | null;
  /** Trend direction: 1 = bullish (up), -1 = bearish (down), 0 = undefined */
  direction: 1 | -1 | 0;
  /** Whether this is a reversal point */
  isReversal: boolean;
  /** Current acceleration factor */
  af: number | null;
  /** Extreme point (highest high in uptrend, lowest low in downtrend) */
  ep: number | null;
};

/**
 * Calculate Parabolic SAR
 *
 * Calculation:
 * - SAR(t+1) = SAR(t) + AF × (EP - SAR(t))
 * - AF starts at `step` and increases by `step` each time EP is updated, capped at `max`
 * - EP is the highest high (uptrend) or lowest low (downtrend) since the trend started
 * - Trend reverses when price crosses the SAR
 *
 * Trading signals:
 * - When price crosses above SAR, start a long position
 * - When price crosses below SAR, start a short position
 * - SAR can be used as a trailing stop-loss level
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Parabolic SAR options
 * @returns Series of Parabolic SAR values
 *
 * @example
 * ```ts
 * const psar = parabolicSar(candles);
 * const psarCustom = parabolicSar(candles, { step: 0.01, max: 0.1 });
 *
 * // Check for reversals
 * if (psar[i].value.isReversal) {
 *   console.log(`Reversal at ${psar[i].value.sar}`);
 * }
 *
 * // Use as trailing stop
 * const stopLevel = psar[i].value.sar;
 * ```
 */
export function parabolicSar(
  candles: Candle[] | NormalizedCandle[],
  options: ParabolicSarOptions = {},
): Series<ParabolicSarValue> {
  const { step = 0.02, max = 0.2 } = options;

  if (step <= 0) {
    throw new Error("Parabolic SAR step must be positive");
  }
  if (max <= 0) {
    throw new Error("Parabolic SAR max must be positive");
  }
  if (step > max) {
    throw new Error("Parabolic SAR step must be less than or equal to max");
  }

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length === 0) {
    return [];
  }

  if (normalized.length === 1) {
    return [
      {
        time: normalized[0].time,
        value: {
          sar: null,
          direction: 0,
          isReversal: false,
          af: null,
          ep: null,
        },
      },
    ];
  }

  const result: Series<ParabolicSarValue> = [];

  // Determine initial trend direction using MINUS_DM (TA-Lib compatible)
  // If -DM(period=1) > 0, start short; otherwise start long
  const diffP = normalized[1].high - normalized[0].high; // plus delta
  const diffM = normalized[0].low - normalized[1].low; // minus delta
  const minusDm = diffM > 0 && diffM > diffP ? diffM : 0;
  let isLong = !(minusDm > 0);

  // Initialize SAR and EP (TA-Lib: sar = prev bar's low/high, ep = current bar's high/low)
  let sar: number;
  let ep: number;
  let af = step;

  if (isLong) {
    sar = normalized[0].low;
    ep = normalized[1].high;
  } else {
    sar = normalized[0].high;
    ep = normalized[1].low;
  }

  // First candle - no SAR (lookback = 1)
  result.push({
    time: normalized[0].time,
    value: {
      sar: null,
      direction: 0,
      isReversal: false,
      af: null,
      ep: null,
    },
  });

  // TA-Lib loop: prevLow/prevHigh track the previous bar's low/high
  // For the first iteration, both prev and new point to bar[1] (startIdx)
  let prevLow = normalized[1].low;
  let prevHigh = normalized[1].high;

  for (let i = 1; i < normalized.length; i++) {
    const newLow = normalized[i].low;
    const newHigh = normalized[i].high;
    let isReversal = false;
    let outputSar: number;

    if (isLong) {
      // Check for reversal: low penetrates SAR (inclusive, TA-Lib uses <=)
      if (newLow <= sar) {
        // Switch to short
        isLong = false;
        isReversal = true;

        // Override SAR with EP from previous trend
        sar = ep;

        // Constrain within yesterday's and today's range
        if (sar < prevHigh) sar = prevHigh;
        if (sar < newHigh) sar = newHigh;

        // Output the override SAR
        outputSar = sar;

        // Reset af and ep for new downtrend
        af = step;
        ep = newLow;

        // Calculate new SAR for next iteration
        sar = sar + af * (ep - sar);

        // Constrain new SAR within yesterday's and today's range
        if (sar < prevHigh) sar = prevHigh;
        if (sar < newHigh) sar = newHigh;
      } else {
        // No reversal - output the SAR (calculated in previous iteration)
        outputSar = sar;

        // Update EP and AF if new high
        if (newHigh > ep) {
          ep = newHigh;
          af += step;
          if (af > max) af = max;
        }

        // Calculate new SAR for next iteration
        sar = sar + af * (ep - sar);

        // Constrain: SAR cannot be above prior two lows
        if (sar > prevLow) sar = prevLow;
        if (sar > newLow) sar = newLow;
      }
    } else {
      // Check for reversal: high penetrates SAR (inclusive, TA-Lib uses >=)
      if (newHigh >= sar) {
        // Switch to long
        isLong = true;
        isReversal = true;

        // Override SAR with EP from previous trend
        sar = ep;

        // Constrain within yesterday's and today's range
        if (sar > prevLow) sar = prevLow;
        if (sar > newLow) sar = newLow;

        // Output the override SAR
        outputSar = sar;

        // Reset af and ep for new uptrend
        af = step;
        ep = newHigh;

        // Calculate new SAR for next iteration
        sar = sar + af * (ep - sar);

        // Constrain new SAR within yesterday's and today's range
        if (sar > prevLow) sar = prevLow;
        if (sar > newLow) sar = newLow;
      } else {
        // No reversal - output the SAR (calculated in previous iteration)
        outputSar = sar;

        // Update EP and AF if new low
        if (newLow < ep) {
          ep = newLow;
          af += step;
          if (af > max) af = max;
        }

        // Calculate new SAR for next iteration
        sar = sar + af * (ep - sar);

        // Constrain: SAR cannot be below prior two highs
        if (sar < prevHigh) sar = prevHigh;
        if (sar < newHigh) sar = newHigh;
      }
    }

    prevLow = newLow;
    prevHigh = newHigh;

    result.push({
      time: normalized[i].time,
      value: {
        sar: outputSar,
        direction: isLong ? 1 : -1,
        isReversal,
        af,
        ep,
      },
    });
  }

  return tagSeries(result, { pane: "main", label: "Parabolic SAR" });
}
