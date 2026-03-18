/**
 * CVD (Cumulative Volume Delta) Divergence Detection
 *
 * Detects divergence between price and CVD, which can signal
 * potential reversals in buying/selling pressure.
 *
 * - Bullish divergence: Price makes lower low, CVD makes higher low
 *   (hidden buying pressure despite falling price)
 * - Bearish divergence: Price makes higher high, CVD makes lower high
 *   (weakening buying pressure despite rising price)
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { cvd } from "../indicators/volume/cvd";
import type { Candle, NormalizedCandle } from "../types";
import { detectDivergence } from "./divergence";
import type { DivergenceOptions, DivergenceSignal } from "./divergence";

/**
 * Detect CVD divergence signals
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Divergence detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = cvdDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function cvdDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 10) return [];

  const cvdData = cvd(normalized);
  const prices = normalized.map((c) => c.close);
  const cvdValues = cvdData.map((d) => d.value);

  return detectDivergence(normalized, prices, cvdValues, options);
}
