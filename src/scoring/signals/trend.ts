/**
 * Trend Signal Evaluators
 *
 * Signal evaluators for trend-based indicators (Perfect Order, MA Cross, etc.)
 */

import { ema, sma } from "../../indicators";
import { perfectOrder, perfectOrderEnhanced } from "../../signals";
import type { NormalizedCandle, SignalDefinition } from "../../types";

/**
 * Create Perfect Order bullish signal evaluator
 *
 * Returns 1 when Perfect Order is bullish (short > mid > long MA).
 */
export function createPerfectOrderBullishEvaluator(
  periods: number[] = [5, 20, 60],
): SignalDefinition["evaluate"] {
  return (candles: NormalizedCandle[], index: number) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod) return 0;

    const poSeries = perfectOrder(candles.slice(0, index + 1), {
      periods,
    });

    const current = poSeries[poSeries.length - 1]?.value;
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
  return (candles: NormalizedCandle[], index: number) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod) return 0;

    const poSeries = perfectOrder(candles.slice(0, index + 1), {
      periods,
    });

    const current = poSeries[poSeries.length - 1]?.value;
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
  return (candles: NormalizedCandle[], index: number) => {
    const longPeriod = Math.max(...periods);
    if (index < longPeriod + slopeLookback) return 0;

    const poSeries = perfectOrderEnhanced(candles.slice(0, index + 1), {
      periods,
      enhanced: true,
      slopeLookback,
    });

    const current = poSeries[poSeries.length - 1]?.value;
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
 */
export function createPullbackEntryEvaluator(
  maPeriod = 20,
  tolerancePercent = 1,
): SignalDefinition["evaluate"] {
  return (candles: NormalizedCandle[], index: number) => {
    if (index < maPeriod) return 0;

    const slice = candles.slice(0, index + 1);
    const smaSeries = sma(slice, { period: maPeriod });
    const maValue = smaSeries[smaSeries.length - 1]?.value;

    if (maValue === null || maValue === undefined) return 0;

    const close = candles[index].close;
    const low = candles[index].low;
    const tolerance = maValue * (tolerancePercent / 100);

    // Price touched or came close to MA
    const touchedMA = low <= maValue + tolerance && close >= maValue - tolerance;

    if (!touchedMA) return 0;

    // Check if in uptrend (price above MA and MA rising)
    if (smaSeries.length < 5) return 0;
    const prevMa = smaSeries[smaSeries.length - 5]?.value;
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
 */
export function createGoldenCrossEvaluator(
  shortPeriod = 50,
  longPeriod = 200,
): SignalDefinition["evaluate"] {
  return (candles: NormalizedCandle[], index: number) => {
    if (index < longPeriod + 1) return 0;

    const slice = candles.slice(0, index + 1);
    const shortMa = sma(slice, { period: shortPeriod });
    const longMa = sma(slice, { period: longPeriod });

    const currentShort = shortMa[shortMa.length - 1]?.value;
    const currentLong = longMa[longMa.length - 1]?.value;
    const prevShort = shortMa[shortMa.length - 2]?.value;
    const prevLong = longMa[longMa.length - 2]?.value;

    if (currentShort === null || currentLong === null || prevShort === null || prevLong === null) {
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
  return (candles: NormalizedCandle[], index: number) => {
    if (index < longPeriod + 1) return 0;

    const slice = candles.slice(0, index + 1);
    const shortMa = sma(slice, { period: shortPeriod });
    const longMa = sma(slice, { period: longPeriod });

    const currentShort = shortMa[shortMa.length - 1]?.value;
    const currentLong = longMa[longMa.length - 1]?.value;
    const prevShort = shortMa[shortMa.length - 2]?.value;
    const prevLong = longMa[longMa.length - 2]?.value;

    if (currentShort === null || currentLong === null || prevShort === null || prevLong === null) {
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
  return (candles: NormalizedCandle[], index: number) => {
    if (index < period) return 0;

    const slice = candles.slice(0, index + 1);
    const emaSeries = ema(slice, { period });
    const emaValue = emaSeries[emaSeries.length - 1]?.value;

    if (emaValue === null || emaValue === undefined) return 0;

    const close = candles[index].close;
    return close > emaValue ? 1 : 0;
  };
}

/**
 * Create price below EMA evaluator
 */
export function createPriceBelowEmaEvaluator(period = 20): SignalDefinition["evaluate"] {
  return (candles: NormalizedCandle[], index: number) => {
    if (index < period) return 0;

    const slice = candles.slice(0, index + 1);
    const emaSeries = ema(slice, { period });
    const emaValue = emaSeries[emaSeries.length - 1]?.value;

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
};

export const perfectOrderBearish: SignalDefinition = {
  name: "poBearish",
  displayName: "Perfect Order (Bear)",
  weight: 3.0,
  category: "trend",
  evaluate: createPerfectOrderBearishEvaluator(),
};

export const poConfirmation: SignalDefinition = {
  name: "poConfirmation",
  displayName: "PO+ Confirmation",
  weight: 3.0,
  category: "trend",
  evaluate: createPOConfirmationEvaluator(),
};

export const pullbackEntry20: SignalDefinition = {
  name: "pullback20",
  displayName: "Pullback to 20MA",
  weight: 2.0,
  category: "trend",
  evaluate: createPullbackEntryEvaluator(20),
};

export const goldenCross50200: SignalDefinition = {
  name: "goldenCross",
  displayName: "Golden Cross (50/200)",
  weight: 2.5,
  category: "trend",
  evaluate: createGoldenCrossEvaluator(50, 200),
};

export const priceAboveEma20: SignalDefinition = {
  name: "priceAboveEma20",
  displayName: "Price > EMA20",
  weight: 1.0,
  category: "trend",
  evaluate: createPriceAboveEmaEvaluator(20),
};
