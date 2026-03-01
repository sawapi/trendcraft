/**
 * Incremental Threshold Detector
 *
 * Detects when a value crosses above or below a fixed threshold level.
 * Useful for RSI overbought/oversold, price levels, etc.
 *
 * @example
 * ```ts
 * const rsiThreshold = createThresholdDetector(30);
 * for (const candle of stream) {
 *   const rsi = rsiIndicator.next(candle).value;
 *   const { crossAbove, crossBelow } = rsiThreshold.next(rsi);
 *   if (crossBelow) console.log('RSI dropped below 30 - oversold');
 *   if (crossAbove) console.log('RSI rose above 30 - recovering');
 * }
 * ```
 */

import type { ThresholdDetector, ThresholdDetectorState } from "../types";

/**
 * Create a threshold detector that detects crosses above/below a fixed level.
 *
 * @param threshold - The level to detect crosses against
 * @param fromState - Optional saved state to restore from
 * @returns A ThresholdDetector instance
 *
 * @example
 * ```ts
 * const detector = createThresholdDetector(70);
 * detector.next(65); // { crossAbove: false, crossBelow: false } (first call)
 * detector.next(72); // { crossAbove: true, crossBelow: false }
 * detector.next(68); // { crossAbove: false, crossBelow: true }
 * ```
 */
export function createThresholdDetector(
  threshold: number,
  fromState?: ThresholdDetectorState,
): ThresholdDetector {
  let prevValue = fromState?.prevValue ?? null;
  const t = fromState?.threshold ?? threshold;

  function detect(
    value: number | null,
    prev: number | null,
  ): { crossAbove: boolean; crossBelow: boolean } {
    if (prev === null || value === null) {
      return { crossAbove: false, crossBelow: false };
    }
    return {
      crossAbove: prev <= t && value > t,
      crossBelow: prev >= t && value < t,
    };
  }

  return {
    next(value: number | null): { crossAbove: boolean; crossBelow: boolean } {
      const result = detect(value, prevValue);
      prevValue = value;
      return result;
    },

    peek(value: number | null): { crossAbove: boolean; crossBelow: boolean } {
      return detect(value, prevValue);
    },

    getState(): ThresholdDetectorState {
      return { threshold: t, prevValue };
    },
  };
}
