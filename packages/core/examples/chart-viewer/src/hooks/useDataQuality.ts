/**
 * Hook for running data quality validation on candle data
 */

import { useMemo } from "react";
import { type NormalizedCandle, type ValidationResult, validateCandles } from "trendcraft";

/**
 * Validate candle data quality and return findings.
 * Returns null if candles array is empty.
 */
export function useDataQuality(candles: NormalizedCandle[]): ValidationResult | null {
  return useMemo(() => {
    if (candles.length === 0) return null;
    return validateCandles(candles);
  }, [candles]);
}
