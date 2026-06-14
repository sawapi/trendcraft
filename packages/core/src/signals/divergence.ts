/**
 * Divergence detection utilities
 * Detects divergence between price and indicators (OBV, RSI, MACD, etc.)
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { macd } from "../indicators/momentum/macd";
import { rsi } from "../indicators/momentum/rsi";
import { obv } from "../indicators/volume/obv";
import type { Candle, NormalizedCandle } from "../types";

/**
 * Divergence class.
 *
 * - `"regular"` — a reversal signal: price and indicator pull apart at an
 *   extreme that the price is still extending (price lower low / indicator
 *   higher low for bullish; price higher high / indicator lower high for
 *   bearish).
 * - `"hidden"` — a continuation signal seen during a pullback: the indicator
 *   extends past its prior extreme while price holds back (price higher low /
 *   indicator lower low for bullish; price lower high / indicator higher high
 *   for bearish).
 */
export type DivergenceClass = "regular" | "hidden";

/**
 * Divergence signal type
 */
export type DivergenceSignal = {
  /** Timestamp of the divergence point (second peak/trough) */
  time: number;
  /** Directional bias of the divergence (a buy lean vs. a sell lean) */
  type: "bullish" | "bearish";
  /** Regular (reversal) vs. hidden (continuation) divergence */
  kind: DivergenceClass;
  /** First peak/trough index */
  firstIdx: number;
  /** Second peak/trough index */
  secondIdx: number;
  /** Price values at the two points */
  price: { first: number; second: number };
  /** Indicator values at the two points */
  indicator: { first: number; second: number };
};

/**
 * Options for divergence detection
 */
export type DivergenceOptions = {
  /** Lookback period for finding peaks/troughs (default: 5) */
  swingLookback?: number;
  /** Minimum bars between two peaks/troughs (default: 5) */
  minSwingDistance?: number;
  /** Maximum bars between two peaks/troughs (default: 60) */
  maxSwingDistance?: number;
  /**
   * Which divergence classes to detect. Defaults to `["regular"]` so existing
   * callers keep getting reversal signals only; pass `["regular", "hidden"]`
   * (or `["hidden"]`) to opt into continuation signals.
   */
  kinds?: DivergenceClass[];
};

/**
 * Detect OBV divergence signals
 *
 * Divergence occurs when price and OBV move in opposite directions:
 * - Bullish divergence: Price makes lower low, OBV makes higher low
 *   (indicates potential upward reversal)
 * - Bearish divergence: Price makes higher high, OBV makes lower high
 *   (indicates potential downward reversal)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = obvDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function obvDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 10) return [];

  const obvData = obv(normalized);
  const prices = normalized.map((c) => c.close);
  const obvValues = obvData.map((d) => d.value);

  return detectDivergence(normalized, prices, obvValues, options);
}

/**
 * Detect RSI divergence signals
 *
 * Divergence occurs when price and RSI move in opposite directions:
 * - Bullish divergence: Price makes lower low, RSI makes higher low
 *   (indicates potential upward reversal, often from oversold territory)
 * - Bearish divergence: Price makes higher high, RSI makes lower high
 *   (indicates potential downward reversal, often from overbought territory)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = rsiDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function rsiDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 14) return [];

  const rsiData = rsi(normalized, { period: 14 });
  const prices = normalized.map((c) => c.close);
  const rsiValues = rsiData.map((d) => d.value ?? 50); // Use 50 as neutral if null

  return detectDivergence(normalized, prices, rsiValues, options);
}

/**
 * Detect MACD divergence signals
 *
 * Divergence occurs when price and MACD line move in opposite directions:
 * - Bullish divergence: Price makes lower low, MACD makes higher low
 *   (indicates potential upward reversal)
 * - Bearish divergence: Price makes higher high, MACD makes lower high
 *   (indicates potential downward reversal)
 *
 * @param candles - Array of candles
 * @param options - Detection options
 * @returns Array of divergence signals
 *
 * @example
 * ```ts
 * const signals = macdDivergence(candles);
 * const bullish = signals.filter(s => s.type === 'bullish');
 * const bearish = signals.filter(s => s.type === 'bearish');
 * ```
 */
export function macdDivergence(
  candles: Candle[] | NormalizedCandle[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);

  if (normalized.length < 26) return [];

  const macdData = macd(normalized);
  const prices = normalized.map((c) => c.close);
  const macdValues = macdData.map((d) => d.value.macd ?? 0); // Use 0 as neutral if null

  return detectDivergence(normalized, prices, macdValues, options);
}

/**
 * Generic divergence detection between price and any indicator.
 *
 * Detects up to four divergence types, gated by {@link DivergenceOptions.kinds}:
 * - Regular bullish (reversal): price lower low, indicator higher low
 * - Regular bearish (reversal): price higher high, indicator lower high
 * - Hidden bullish (continuation): price higher low, indicator lower low
 * - Hidden bearish (continuation): price lower high, indicator higher high
 *
 * Each signal carries a `type` (`"bullish"`/`"bearish"` directional bias) and a
 * `kind` (`"regular"`/`"hidden"`). Only regular divergences are detected by
 * default.
 *
 * @param candles - Normalized candles (for timestamps)
 * @param prices - Price series (typically close prices)
 * @param indicator - Indicator series
 * @param options - Detection options
 * @returns Array of divergence signals, sorted by time
 *
 * @example
 * ```ts
 * // Reversal signals only (default)
 * const reversals = detectDivergence(candles, prices, rsiValues);
 * // Both reversal and continuation signals
 * const all = detectDivergence(candles, prices, rsiValues, {
 *   kinds: ["regular", "hidden"],
 * });
 * const continuation = all.filter((s) => s.kind === "hidden");
 * ```
 */
export function detectDivergence(
  candles: NormalizedCandle[],
  prices: number[],
  indicator: number[],
  options: DivergenceOptions = {},
): DivergenceSignal[] {
  const {
    swingLookback = 5,
    minSwingDistance = 5,
    maxSwingDistance = 60,
    kinds = ["regular"],
  } = options;

  // Find swing highs and lows for both series once; the detector loops below
  // reuse these pivot lists.
  const priceHighs = findSwingHighs(prices, swingLookback);
  const priceLows = findSwingLows(prices, swingLookback);
  const indHighs = findSwingHighs(indicator, swingLookback);
  const indLows = findSwingLows(indicator, swingLookback);

  // Required first->second pivot move directions for each (kind, type). Bearish
  // works on peaks, bullish on troughs; `priceHigher`/`indHigher` say which way
  // each series must move. Hidden is the mirror of regular (booleans flipped).
  const directions: Record<
    DivergenceClass,
    Record<"bullish" | "bearish", { priceHigher: boolean; indHigher: boolean }>
  > = {
    regular: {
      bearish: { priceHigher: true, indHigher: false }, // price higher high, ind lower high
      bullish: { priceHigher: false, indHigher: true }, // price lower low, ind higher low
    },
    hidden: {
      bearish: { priceHigher: false, indHigher: true }, // price lower high, ind higher high
      bullish: { priceHigher: true, indHigher: false }, // price higher low, ind lower low
    },
  };

  const results: DivergenceSignal[] = [];

  for (const kind of kinds) {
    for (const type of ["bearish", "bullish"] as const) {
      const { priceHigher, indHigher } = directions[kind][type];
      const pricePivots = type === "bearish" ? priceHighs : priceLows;
      const indPivots = type === "bearish" ? indHighs : indLows;

      for (let i = 1; i < pricePivots.length; i++) {
        const prev = pricePivots[i - 1];
        const curr = pricePivots[i];

        const distance = curr.idx - prev.idx;
        if (distance < minSwingDistance || distance > maxSwingDistance) continue;

        // Price must move strictly in the required direction.
        if (priceHigher ? curr.value <= prev.value : curr.value >= prev.value) continue;

        const prevInd = findNearestSwing(indPivots, prev.idx, swingLookback);
        const currInd = findNearestSwing(indPivots, curr.idx, swingLookback);
        if (!prevInd || !currInd) continue;

        // Indicator must move strictly in the (opposing) required direction.
        if (indHigher ? currInd.value <= prevInd.value : currInd.value >= prevInd.value) continue;

        results.push({
          time: candles[curr.idx].time,
          type,
          kind,
          firstIdx: prev.idx,
          secondIdx: curr.idx,
          price: { first: prev.value, second: curr.value },
          indicator: { first: prevInd.value, second: currInd.value },
        });
      }
    }
  }

  // Sort by time
  results.sort((a, b) => a.time - b.time);

  return results;
}

/**
 * Swing point type
 */
type SwingPoint = {
  idx: number;
  value: number;
};

/**
 * Find swing highs (local maxima)
 */
function findSwingHighs(data: number[], lookback: number): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;

    // Check if current point is higher than all points in lookback range
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j] >= data[i]) {
        isHigh = false;
        break;
      }
    }

    if (isHigh) {
      result.push({ idx: i, value: data[i] });
    }
  }

  return result;
}

/**
 * Find swing lows (local minima)
 */
function findSwingLows(data: number[], lookback: number): SwingPoint[] {
  const result: SwingPoint[] = [];

  for (let i = lookback; i < data.length - lookback; i++) {
    let isLow = true;

    // Check if current point is lower than all points in lookback range
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && data[j] <= data[i]) {
        isLow = false;
        break;
      }
    }

    if (isLow) {
      result.push({ idx: i, value: data[i] });
    }
  }

  return result;
}

/**
 * Find the nearest swing point to a given index
 */
function findNearestSwing(
  swings: SwingPoint[],
  targetIdx: number,
  tolerance: number,
): SwingPoint | null {
  let nearest: SwingPoint | null = null;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const swing of swings) {
    const distance = Math.abs(swing.idx - targetIdx);
    if (distance <= tolerance && distance < minDistance) {
      minDistance = distance;
      nearest = swing;
    }
  }

  return nearest;
}
