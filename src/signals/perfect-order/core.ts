/**
 * Perfect Order detection for trading signals
 * Detects when multiple moving averages are aligned in order (short > medium > long or vice versa)
 *
 * Uses hysteresis to prevent noise from price crossing the short MA:
 * - Formation requires: price > shortMA AND MA order OK
 * - Continuation requires: price > shortMA × (1 - margin) AND MA order OK
 * - Collapse when: price < shortMA × (1 - margin) OR MA order broken
 */

import { normalizeCandles, getPrice } from "../../core/normalize";
import type { Candle, NormalizedCandle, Series } from "../../types";
import type { PerfectOrderType, PerfectOrderValue, PerfectOrderOptions } from "./types";
import { DEFAULT_HYSTERESIS_MARGIN } from "./types";
import {
  getMaFunction,
  isNormalized,
  determinePerfectOrderTypeWithHysteresis,
  calculateStrength,
} from "./utils";

/**
 * Detect Perfect Order alignment of multiple moving averages
 *
 * Perfect Order occurs when MAs are aligned in order AND price is positioned correctly:
 * - Bullish: Price > Short MA > Medium MA > Long MA (uptrend)
 * - Bearish: Price < Short MA < Medium MA < Long MA (downtrend)
 *
 * Uses hysteresis (1% default margin) to prevent noise from price crossing the short MA:
 * - Formation: price must be above/below shortMA (strict)
 * - Continuation: price can be within margin of shortMA (relaxed)
 * - Collapse: price falls below/above margin OR MA order breaks
 *
 * The strength score (0-100) reflects how "ideal" the perfect order is:
 * - MA spread: wider spread = stronger trend
 * - MA uniformity: evenly spaced MAs = healthier trend
 * - Price position: price deviation from short MA adds bonus points
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Perfect order options
 * @returns Series of perfect order values with formation/collapse signals
 *
 * @example
 * ```ts
 * // Default: 5, 25, 75 SMA (Japanese stock standard)
 * const po = perfectOrder(candles);
 *
 * // Custom periods with EMA
 * const po4 = perfectOrder(candles, {
 *   periods: [10, 20, 50, 200],
 *   maType: 'ema'
 * });
 *
 * // Find strong formation signals
 * const strongFormations = po.filter(p => p.value.formed && p.value.strength >= 50);
 * ```
 */
export function perfectOrder(
  candles: Candle[] | NormalizedCandle[],
  options: PerfectOrderOptions = {}
): Series<PerfectOrderValue> {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    source = "close",
    hysteresisMargin = DEFAULT_HYSTERESIS_MARGIN,
  } = options;

  // Sort and dedupe periods
  const sortedPeriods = [...new Set(periods)].sort((a, b) => a - b);

  if (sortedPeriods.length < 2) {
    throw new Error("At least 2 different periods are required");
  }

  if (sortedPeriods.some((p) => p < 1)) {
    throw new Error("All periods must be positive integers");
  }

  if (candles.length === 0) {
    return [];
  }

  // Normalize candles
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  // Calculate all MAs
  const maFn = getMaFunction(maType);
  const maSeries = sortedPeriods.map((period) => maFn(normalized, { period, source }));

  // Build result
  const result: Series<PerfectOrderValue> = [];
  let prevType: PerfectOrderType = "none";

  for (let i = 0; i < normalized.length; i++) {
    const time = normalized[i].time;
    const price = getPrice(normalized[i], source);
    const maValues = maSeries.map((series) => series[i].value);

    // Determine perfect order type with hysteresis
    // - Formation: strict price check (price > shortMA for bullish)
    // - Continuation: relaxed price check (price > shortMA × (1 - margin))
    const type = determinePerfectOrderTypeWithHysteresis(
      maValues,
      price,
      prevType,
      hysteresisMargin
    );

    // Detect formation and collapse
    const formed = prevType === "none" && type !== "none";
    const collapsed = prevType !== "none" && type === "none";

    // Calculate strength (includes price deviation)
    const strength = type !== "none" ? calculateStrength(maValues, type, price) : 0;

    result.push({
      time,
      value: {
        type,
        formed,
        collapsed,
        strength,
        maValues,
      },
    });

    prevType = type;
  }

  return result;
}
