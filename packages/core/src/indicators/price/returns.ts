/**
 * Returns calculation indicator
 */

import { ensureNormalized } from "../../core/normalize";
import { tagSeries, withLabelParams } from "../../core/tag-series";
import type { Candle, NormalizedCandle, ReturnsOptions, Series } from "../../types";
import type { SeriesMeta } from "../../types/candle";
import { assertOneOf, keywords } from "../../utils/validate-keyword";
import { assertPeriod } from "../../utils/validate-period";
import { RETURNS_META } from "../indicator-meta";

const RETURN_TYPES = keywords<NonNullable<ReturnsOptions["type"]>>()(["simple", "log"]);
const CUMULATIVE_RETURN_TYPES = keywords<NonNullable<Parameters<typeof cumulativeReturns>[1]>>()([
  "simple",
  "log",
]);

/**
 * Calculate price returns
 *
 * Simple Return = (Current Price - Previous Price) / Previous Price
 * Log Return = ln(Current Price / Previous Price)
 *
 * @param candles - Array of candles (raw or normalized)
 * @param options - Returns options (period=1, type='simple')
 * @returns Series of return values
 *
 * @example
 * ```ts
 * const dailyReturns = returns(candles); // 1-period simple returns
 * const weeklyReturns = returns(candles, { period: 5 }); // 5-period returns
 * const logReturns = returns(candles, { type: 'log' }); // Log returns
 * ```
 */
export function returns(
  candles: Candle[] | NormalizedCandle[],
  options: ReturnsOptions = {},
): Series<number | null> {
  const { period = 1, type = "simple" } = options;

  assertPeriod("Returns period", period);
  // An unknown type gave simple returns.
  assertOneOf("Returns type", type, RETURN_TYPES);

  // Normalize if needed
  const normalized = ensureNormalized(candles);

  const result: Series<number | null> = [];

  for (let i = 0; i < normalized.length; i++) {
    if (i < period) {
      // Not enough data for n-period return
      result.push({ time: normalized[i].time, value: null });
    } else {
      const currentPrice = normalized[i].close;
      const previousPrice = normalized[i - period].close;

      if (previousPrice === 0) {
        result.push({ time: normalized[i].time, value: null });
      } else if (type === "log") {
        // Log return
        const logReturn = Math.log(currentPrice / previousPrice);
        result.push({ time: normalized[i].time, value: logReturn });
      } else {
        // Simple return
        const simpleReturn = (currentPrice - previousPrice) / previousPrice;
        result.push({ time: normalized[i].time, value: simpleReturn });
      }
    }
  }

  return tagSeries(result, RETURNS_META);
}

/** Series metadata for `cumulativeReturns`; log returns add "log" to the label. */
export const CUMULATIVE_RETURNS_META: SeriesMeta = {
  kind: "cumulativeReturns",
  overlay: false,
  label: "Cum. Returns",
};

/**
 * Calculate cumulative returns from a starting point
 *
 * @param candles - Array of candles
 * @param type - Return type ('simple' or 'log')
 * @returns Series of cumulative return values
 */
export function cumulativeReturns(
  candles: Candle[] | NormalizedCandle[],
  type: "simple" | "log" = "simple",
): Series<number | null> {
  assertOneOf("cumulativeReturns type", type, CUMULATIVE_RETURN_TYPES);
  const normalized = ensureNormalized(candles);
  const meta = withLabelParams(CUMULATIVE_RETURNS_META, [type === "log" ? "log" : undefined]);

  if (normalized.length === 0) {
    return tagSeries([], meta);
  }

  const result: Series<number | null> = [];
  const startPrice = normalized[0].close;

  if (startPrice === 0) {
    return tagSeries(
      normalized.map((c) => ({ time: c.time, value: null })),
      meta,
    );
  }

  for (let i = 0; i < normalized.length; i++) {
    const currentPrice = normalized[i].close;

    if (type === "log") {
      const cumReturn = Math.log(currentPrice / startPrice);
      result.push({ time: normalized[i].time, value: cumReturn });
    } else {
      const cumReturn = (currentPrice - startPrice) / startPrice;
      result.push({ time: normalized[i].time, value: cumReturn });
    }
  }

  return tagSeries(result, meta);
}
