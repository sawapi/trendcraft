/**
 * Detrended Price Oscillator (DPO)
 *
 * DPO removes the trend from price data to identify cycles.
 * It compares price to a displaced moving average, highlighting
 * short-term cycles independent of the overall trend.
 */

import { getPrice, isNormalized, normalizeCandles } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, PriceSource, Series } from "../../types";
import { assertPeriod } from "../../utils/validate-period";
import { assertPriceSource } from "../../utils/validate-price-source";
import { DPO_META } from "../indicator-meta";

/**
 * DPO options
 */
export type DpoOptions = {
  /** Period for SMA calculation (default: 20) */
  period?: number;
  /** Price source to use (default: 'close') */
  source?: PriceSource;
  /**
   * Stamp each value at the bar it describes instead of the bar where it
   * becomes known (default: `false`).
   *
   * The two forms hold the same numbers, `shift = floor(period / 2) + 1`
   * bars apart. The default (`false`; TA-Lib's `TA_DPO`, added in TA-Lib
   * 0.8.1, and StockCharts' formula) is causal: bar `i`
   * gets `Price[i - shift] - SMA[i]`, computed from bars up to `i`. With
   * `true` (the classic chart form, e.g. TradingView's "Centered"), bar `i`
   * gets `Price[i] - SMA[i + shift]`, which reads `shift` bars **after** `i`
   * and leaves the last `shift` bars null. Use it to line cycles up with the
   * price that formed them on a historical chart; never feed it to a
   * backtest, a screen or a live signal.
   */
  centered?: boolean;
};

/**
 * Calculate Detrended Price Oscillator
 *
 * DPO compares a past price with the SMA that is centred on it, which
 * removes the trend and leaves the cycle: with `shift = floor(period/2) + 1`,
 * the value is `Price[i - shift] - SMA[i]` at bar `i` (default), or the same
 * number stamped `shift` bars earlier with `centered: true` (see
 * {@link DpoOptions.centered}, which reads future bars).
 *
 * Interpretation:
 * - Positive DPO: Price is above the detrended average (cycle high)
 * - Negative DPO: Price is below the detrended average (cycle low)
 * - Zero crossings indicate cycle turning points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - DPO options
 * @returns Series of DPO values
 *
 * @example
 * ```ts
 * const dpoData = dpo(candles); // Default 20-period DPO, causal
 * const dpoCustom = dpo(candles, { period: 14 });
 *
 * // Chart view: each value at the bar it describes (reads future bars)
 * const forChart = dpo(candles, { centered: true });
 * ```
 */
export function dpo(
  candles: Candle[] | NormalizedCandle[],
  options: DpoOptions = {},
): Series<number | null> {
  const { period = 20, source = "close", centered = false } = options;
  assertPriceSource("DPO source", source);

  assertPeriod("DPO period", period);

  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const result: Series<number | null> = [];
  const shift = Math.floor(period / 2) + 1;

  // Pre-calculate SMA values
  const smaValues: (number | null)[] = new Array(normalized.length).fill(null);
  let sum = 0;
  for (let i = 0; i < normalized.length; i++) {
    sum += getPrice(normalized[i], source);
    if (i >= period) {
      sum -= getPrice(normalized[i - period], source);
    }
    if (i >= period - 1) {
      smaValues[i] = sum / period;
    }
  }

  for (let i = 0; i < normalized.length; i++) {
    // Pair Price[p] with SMA[p + shift]; bar i holds the pair whose price
    // is at i (centered) or whose SMA is at i (causal).
    const p = centered ? i : i - shift;
    const smaVal = smaValues[p + shift];
    if (p >= 0 && smaVal !== null && smaVal !== undefined) {
      result.push({ time: normalized[i].time, value: getPrice(normalized[p], source) - smaVal });
    } else {
      result.push({ time: normalized[i].time, value: null });
    }
  }

  return tagSeries(result, withLabelParams(DPO_META, [period]));
}
