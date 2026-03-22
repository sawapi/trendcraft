/**
 * Trend Signal Evaluators
 *
 * Signal evaluators for trend-based indicators (Perfect Order, MA Cross, etc.)
 */

import { ema, sma } from "../../indicators";
import { perfectOrder, perfectOrderEnhanced } from "../../signals";
import type { NormalizedCandle, PrecomputedIndicators, SignalDefinition } from "../../types";

/**
 * Create Perfect Order bullish signal evaluator
 *
 * Returns 1 when Perfect Order is bullish (short > mid > long MA).
 * @example
 * ```ts
 * import { ScoreBuilder, createPerfectOrderBullishEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "poBull", weight: 3.0, evaluate: createPerfectOrderBullishEvaluator() })
 *   .build();
 * ```
 */
export function createPerfectOrderBullishEvaluator(
  periods: number[] = [5, 20, 60],
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current: { type: string; strength: number } | null | undefined;

    const isDefaultPeriods =
      periods.length === 3 && periods[0] === 5 && periods[1] === 20 && periods[2] === 60;

    if (precomputed?.perfectOrder && isDefaultPeriods) {
      current = precomputed.perfectOrder[index];
    } else {
      const poSeries = perfectOrder(candles.slice(0, index + 1), {
        periods,
      });
      const poValue = poSeries[poSeries.length - 1]?.value;
      current = poValue ? { type: poValue.type, strength: poValue.strength } : undefined;
    }

    if (!current) return 0;

    if (current.type === "bullish") {
      // Use strength as bonus
      const strengthBonus = Math.min(current.strength / 100, 0.2);
      return Math.min(1, 0.8 + strengthBonus);
    }

    return 0;
  };
}

/**
 * Create Perfect Order bearish signal evaluator
 *
 * Returns 1 when Perfect Order is bearish (short < mid < long MA).
 */
export function createPerfectOrderBearishEvaluator(
  periods: number[] = [5, 20, 60],
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current: { type: string; strength: number } | null | undefined;

    const isDefaultPeriods =
      periods.length === 3 && periods[0] === 5 && periods[1] === 20 && periods[2] === 60;

    if (precomputed?.perfectOrder && isDefaultPeriods) {
      current = precomputed.perfectOrder[index];
    } else {
      const poSeries = perfectOrder(candles.slice(0, index + 1), {
        periods,
      });
      const poValue = poSeries[poSeries.length - 1]?.value;
      current = poValue ? { type: poValue.type, strength: poValue.strength } : undefined;
    }

    if (!current) return 0;

    if (current.type === "bearish") {
      const strengthBonus = Math.min(current.strength / 100, 0.2);
      return Math.min(1, 0.8 + strengthBonus);
    }

    return 0;
  };
}

/**
 * Create Perfect Order confirmation (PO+) evaluator
 *
 * Returns 1 when PO is confirmed with proper MA slopes.
 */
export function createPOConfirmationEvaluator(
  periods: number[] = [5, 20, 60],
  slopeLookback = 3,
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod + slopeLookback) return 0;

    // Use pre-computed data if available (for default periods only)
    let current:
      | { state: string; isConfirmed: boolean; confirmationFormed: boolean }
      | null
      | undefined;

    const isDefaultPeriods =
      periods.length === 3 && periods[0] === 5 && periods[1] === 20 && periods[2] === 60;

    if (precomputed?.perfectOrderEnhanced && isDefaultPeriods && slopeLookback === 3) {
      current = precomputed.perfectOrderEnhanced[index];
    } else {
      const poSeries = perfectOrderEnhanced(candles.slice(0, index + 1), {
        periods,
        enhanced: true,
        slopeLookback,
      });
      const poValue = poSeries[poSeries.length - 1]?.value;
      current = poValue
        ? {
            state: poValue.state,
            isConfirmed: poValue.isConfirmed,
            confirmationFormed: poValue.confirmationFormed ?? false,
          }
        : undefined;
    }

    if (!current) return 0;

    // PO+ confirmation: bullish PO with all MAs sloping up
    if (current.state === "BULLISH_PO" && current.confirmationFormed) {
      return 1;
    }

    // Already confirmed bullish
    if (current.state === "BULLISH_PO" && current.isConfirmed) {
      return 0.8;
    }

    // Pre-bullish (forming)
    if (current.state === "PRE_BULLISH_PO") {
      return 0.5;
    }

    return 0;
  };
}

/**
 * Create pullback entry evaluator
 *
 * Returns 1 when price pulls back to key MA level in uptrend.
 * @example
 * ```ts
 * import { ScoreBuilder, createPullbackEntryEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "pullback", weight: 2.5, evaluate: createPullbackEntryEvaluator(20, 1) })
 *   .build();
 * ```
 */
export function createPullbackEntryEvaluator(
  maPeriod = 20,
  tolerancePercent = 1,
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < maPeriod) return 0;

    // Use pre-computed data if available
    let maValue: number | null | undefined;
    let prevMa: number | null | undefined;

    if (precomputed?.sma?.has(maPeriod)) {
      const smaData = precomputed.sma.get(maPeriod) ?? [];
      maValue = smaData[index];
      prevMa = index >= 5 ? smaData[index - 4] : null;
    } else {
      const slice = candles.slice(0, index + 1);
      const smaSeries = sma(slice, { period: maPeriod });
      maValue = smaSeries[smaSeries.length - 1]?.value;
      if (smaSeries.length < 5) return 0;
      prevMa = smaSeries[smaSeries.length - 5]?.value;
    }

    if (maValue === null || maValue === undefined) return 0;

    const close = candles[index].close;
    const low = candles[index].low;
    const tolerance = maValue * (tolerancePercent / 100);

    // Price touched or came close to MA
    const touchedMA = low <= maValue + tolerance && close >= maValue - tolerance;

    if (!touchedMA) return 0;

    // Check if in uptrend (price above MA and MA rising)
    if (prevMa === null || prevMa === undefined) return 0;

    const maRising = maValue > prevMa;
    const priceAboveMa = close > maValue;

    if (maRising && priceAboveMa) {
      return 1; // Perfect pullback entry
    }

    if (maRising) {
      return 0.7; // MA rising but price closed below
    }

    return 0;
  };
}

/**
 * Create golden cross evaluator
 *
 * Returns 1 when short MA crosses above long MA.
 * @example
 * ```ts
 * import { ScoreBuilder, createGoldenCrossEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "gc", weight: 2.0, evaluate: createGoldenCrossEvaluator(50, 200) })
 *   .build();
 * ```
 */
export function createGoldenCrossEvaluator(
  shortPeriod = 50,
  longPeriod = 200,
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < longPeriod + 1) return 0;

    // Use pre-computed data if available
    let currentShort: number | null | undefined;
    let currentLong: number | null | undefined;
    let prevShort: number | null | undefined;
    let prevLong: number | null | undefined;

    if (precomputed?.sma?.has(shortPeriod) && precomputed?.sma?.has(longPeriod)) {
      const shortData = precomputed.sma.get(shortPeriod) ?? [];
      const longData = precomputed.sma.get(longPeriod) ?? [];
      currentShort = shortData[index];
      currentLong = longData[index];
      prevShort = shortData[index - 1];
      prevLong = longData[index - 1];
    } else {
      const slice = candles.slice(0, index + 1);
      const shortMa = sma(slice, { period: shortPeriod });
      const longMa = sma(slice, { period: longPeriod });
      currentShort = shortMa[shortMa.length - 1]?.value;
      currentLong = longMa[longMa.length - 1]?.value;
      prevShort = shortMa[shortMa.length - 2]?.value;
      prevLong = longMa[longMa.length - 2]?.value;
    }

    if (currentShort === null || currentLong === null || prevShort === null || prevLong === null) {
      return 0;
    }
    if (
      currentShort === undefined ||
      currentLong === undefined ||
      prevShort === undefined ||
      prevLong === undefined
    ) {
      return 0;
    }

    // Crossover occurred
    if (prevShort <= prevLong && currentShort > currentLong) {
      return 1;
    }

    // Already above
    if (currentShort > currentLong) {
      return 0.3;
    }

    return 0;
  };
}

/**
 * Create death cross evaluator
 *
 * Returns 1 when short MA crosses below long MA.
 */
export function createDeathCrossEvaluator(
  shortPeriod = 50,
  longPeriod = 200,
): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < longPeriod + 1) return 0;

    // Use pre-computed data if available
    let currentShort: number | null | undefined;
    let currentLong: number | null | undefined;
    let prevShort: number | null | undefined;
    let prevLong: number | null | undefined;

    if (precomputed?.sma?.has(shortPeriod) && precomputed?.sma?.has(longPeriod)) {
      const shortData = precomputed.sma.get(shortPeriod) ?? [];
      const longData = precomputed.sma.get(longPeriod) ?? [];
      currentShort = shortData[index];
      currentLong = longData[index];
      prevShort = shortData[index - 1];
      prevLong = longData[index - 1];
    } else {
      const slice = candles.slice(0, index + 1);
      const shortMa = sma(slice, { period: shortPeriod });
      const longMa = sma(slice, { period: longPeriod });
      currentShort = shortMa[shortMa.length - 1]?.value;
      currentLong = longMa[longMa.length - 1]?.value;
      prevShort = shortMa[shortMa.length - 2]?.value;
      prevLong = longMa[longMa.length - 2]?.value;
    }

    if (currentShort === null || currentLong === null || prevShort === null || prevLong === null) {
      return 0;
    }
    if (
      currentShort === undefined ||
      currentLong === undefined ||
      prevShort === undefined ||
      prevLong === undefined
    ) {
      return 0;
    }

    if (prevShort >= prevLong && currentShort < currentLong) {
      return 1;
    }

    if (currentShort < currentLong) {
      return 0.3;
    }

    return 0;
  };
}

/**
 * Create price above EMA evaluator
 */
export function createPriceAboveEmaEvaluator(period = 20): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available
    let emaValue: number | null | undefined;

    if (precomputed?.ema?.has(period)) {
      emaValue = precomputed.ema.get(period)?.[index];
    } else {
      const slice = candles.slice(0, index + 1);
      const emaSeries = ema(slice, { period });
      emaValue = emaSeries[emaSeries.length - 1]?.value;
    }

    if (emaValue === null || emaValue === undefined) return 0;

    const close = candles[index].close;
    return close > emaValue ? 1 : 0;
  };
}

/**
 * Create price below EMA evaluator
 */
export function createPriceBelowEmaEvaluator(period = 20): SignalDefinition["evaluate"] {
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available
    let emaValue: number | null | undefined;

    if (precomputed?.ema?.has(period)) {
      emaValue = precomputed.ema.get(period)?.[index];
    } else {
      const slice = candles.slice(0, index + 1);
      const emaSeries = ema(slice, { period });
      emaValue = emaSeries[emaSeries.length - 1]?.value;
    }

    if (emaValue === null || emaValue === undefined) return 0;

    const close = candles[index].close;
    return close < emaValue ? 1 : 0;
  };
}

// Pre-built signal definitions
export const perfectOrderBullish: SignalDefinition = {
  name: "poBullish",
  displayName: "Perfect Order (Bull)",
  weight: 3.0,
  category: "trend",
  evaluate: createPerfectOrderBullishEvaluator(),
  requiredIndicators: ["perfectOrder"],
};

export const perfectOrderBearish: SignalDefinition = {
  name: "poBearish",
  displayName: "Perfect Order (Bear)",
  weight: 3.0,
  category: "trend",
  evaluate: createPerfectOrderBearishEvaluator(),
  requiredIndicators: ["perfectOrder"],
};

export const poConfirmation: SignalDefinition = {
  name: "poConfirmation",
  displayName: "PO+ Confirmation",
  weight: 3.0,
  category: "trend",
  evaluate: createPOConfirmationEvaluator(),
  requiredIndicators: ["perfectOrderEnhanced"],
};

export const pullbackEntry20: SignalDefinition = {
  name: "pullback20",
  displayName: "Pullback to 20MA",
  weight: 2.0,
  category: "trend",
  evaluate: createPullbackEntryEvaluator(20),
  requiredIndicators: ["sma"],
};

export const goldenCross50200: SignalDefinition = {
  name: "goldenCross",
  displayName: "Golden Cross (50/200)",
  weight: 2.5,
  category: "trend",
  evaluate: createGoldenCrossEvaluator(50, 200),
  requiredIndicators: ["sma"],
};

export const priceAboveEma20: SignalDefinition = {
  name: "priceAboveEma20",
  displayName: "Price > EMA20",
  weight: 1.0,
  category: "trend",
  evaluate: createPriceAboveEmaEvaluator(20),
  requiredIndicators: ["ema"],
};
