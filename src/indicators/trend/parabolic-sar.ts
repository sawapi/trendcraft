/**
 * Parabolic SAR (Stop and Reverse)
 *
 * A trend-following indicator that provides potential entry and exit points.
 * Developed by J. Welles Wilder Jr.
 */

import { normalizeCandles } from "../../core/normalize";
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
  options: ParabolicSarOptions = {}
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

  // Determine initial trend direction based on first two candles
  let isUptrend = normalized[1].close > normalized[0].close;

  // Initialize SAR and EP
  let sar: number;
  let ep: number;
  let af = step;

  if (isUptrend) {
    // Start SAR at the low of the first candle
    sar = normalized[0].low;
    ep = normalized[0].high;
  } else {
    // Start SAR at the high of the first candle
    sar = normalized[0].high;
    ep = normalized[0].low;
  }

  // First candle - no SAR yet
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

  for (let i = 1; i < normalized.length; i++) {
    const candle = normalized[i];
    const prevCandle = normalized[i - 1];
    let isReversal = false;

    // Calculate new SAR
    let newSar = sar + af * (ep - sar);

    if (isUptrend) {
      // In uptrend, SAR cannot be above the prior two lows
      newSar = Math.min(newSar, prevCandle.low);
      if (i >= 2) {
        newSar = Math.min(newSar, normalized[i - 2].low);
      }

      // Check for reversal (price crosses below SAR)
      if (candle.low < newSar) {
        isReversal = true;
        isUptrend = false;
        newSar = ep; // SAR becomes the EP of the previous trend
        ep = candle.low;
        af = step;
      } else {
        // Update EP if new high
        if (candle.high > ep) {
          ep = candle.high;
          af = Math.min(af + step, max);
        }
      }
    } else {
      // In downtrend, SAR cannot be below the prior two highs
      newSar = Math.max(newSar, prevCandle.high);
      if (i >= 2) {
        newSar = Math.max(newSar, normalized[i - 2].high);
      }

      // Check for reversal (price crosses above SAR)
      if (candle.high > newSar) {
        isReversal = true;
        isUptrend = true;
        newSar = ep; // SAR becomes the EP of the previous trend
        ep = candle.high;
        af = step;
      } else {
        // Update EP if new low
        if (candle.low < ep) {
          ep = candle.low;
          af = Math.min(af + step, max);
        }
      }
    }

    sar = newSar;

    result.push({
      time: candle.time,
      value: {
        sar,
        direction: isUptrend ? 1 : -1,
        isReversal,
        af,
        ep,
      },
    });
  }

  return result;
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
