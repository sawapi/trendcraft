/**
 * Momentum Signal Evaluators
 *
 * Signal evaluators for momentum-based indicators (RSI, MACD, Stochastics, etc.)
 */

import { macd, rsi, stochastics } from "../../indicators";
import type { NormalizedCandle, PrecomputedIndicators, SignalDefinition } from "../../types";
import { assertInRange } from "../../utils/validate-number";
import { assertPeriod } from "../../utils/validate-period";

/**
 * Check MACD periods when the evaluator is created. `macd()` checks them too,
 * but only once a bar is evaluated.
 */
function assertMacdPeriods(
  label: string,
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): void {
  assertPeriod(`${label} fastPeriod`, fastPeriod);
  assertPeriod(`${label} slowPeriod`, slowPeriod);
  assertPeriod(`${label} signalPeriod`, signalPeriod);
  if (fastPeriod >= slowPeriod) {
    throw new Error(`${label} fastPeriod must be less than slowPeriod`);
  }
}

/**
 * Create RSI oversold signal evaluator
 *
 * Returns 1 when RSI is at or below threshold, 0 when above.
 * Includes gradual scaling near threshold.
 *
 * @param threshold - RSI oversold threshold (default: 30)
 * @param period - RSI period (default: 14)
 * @throws Error if `threshold` is outside [0, 100] or `period` is not a positive integer
 * @example
 * ```ts
 * import { ScoreBuilder, createRsiOversoldEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "rsiOS", displayName: "RSI < 25", weight: 2.0, evaluate: createRsiOversoldEvaluator(25) })
 *   .build();
 * ```
 */
export function createRsiOversoldEvaluator(
  threshold = 30,
  period = 14,
): SignalDefinition["evaluate"] {
  assertInRange("createRsiOversoldEvaluator threshold", threshold, 0, 100);
  assertPeriod("createRsiOversoldEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 14 only)
    let current: number | null | undefined;
    if (precomputed?.rsi14 && period === 14) {
      current = precomputed.rsi14[index];
    } else {
      const rsiSeries = rsi(candles.slice(0, index + 1), { period });
      current = rsiSeries[rsiSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    // Full score at threshold, gradual reduction above
    if (current <= threshold) return 1;
    if (current <= threshold + 10) {
      // Gradual falloff: 30-40 range gives 1-0 score
      return 1 - (current - threshold) / 10;
    }
    return 0;
  };
}

/**
 * Create RSI overbought signal evaluator
 *
 * Returns 1 when RSI is at or above threshold, 0 when below.
 *
 * @param threshold - RSI overbought threshold (default: 70)
 * @param period - RSI period (default: 14)
 * @throws Error if `threshold` is outside [0, 100] or `period` is not a positive integer
 */
export function createRsiOverboughtEvaluator(
  threshold = 70,
  period = 14,
): SignalDefinition["evaluate"] {
  assertInRange("createRsiOverboughtEvaluator threshold", threshold, 0, 100);
  assertPeriod("createRsiOverboughtEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 14 only)
    let current: number | null | undefined;
    if (precomputed?.rsi14 && period === 14) {
      current = precomputed.rsi14[index];
    } else {
      const rsiSeries = rsi(candles.slice(0, index + 1), { period });
      current = rsiSeries[rsiSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current >= threshold) return 1;
    if (current >= threshold - 10) {
      return 1 - (threshold - current) / 10;
    }
    return 0;
  };
}

/**
 * Create RSI neutral zone evaluator
 *
 * Returns 1 when RSI is in the neutral zone (40-60), useful for mean reversion.
 *
 * @param lowerBound - Lower bound of neutral zone (default: 40)
 * @param upperBound - Upper bound of neutral zone (default: 60)
 * @param period - RSI period (default: 14)
 * @throws Error if a bound is outside [0, 100], `lowerBound` exceeds `upperBound`, or `period` is not a positive integer
 */
export function createRsiNeutralEvaluator(
  lowerBound = 40,
  upperBound = 60,
  period = 14,
): SignalDefinition["evaluate"] {
  assertInRange("createRsiNeutralEvaluator lowerBound", lowerBound, 0, 100);
  assertInRange("createRsiNeutralEvaluator upperBound", upperBound, 0, 100);
  if (lowerBound > upperBound) {
    throw new Error("createRsiNeutralEvaluator lowerBound must not exceed upperBound");
  }
  assertPeriod("createRsiNeutralEvaluator period", period);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < period) return 0;

    // Use pre-computed data if available (for period 14 only)
    let current: number | null | undefined;
    if (precomputed?.rsi14 && period === 14) {
      current = precomputed.rsi14[index];
    } else {
      const rsiSeries = rsi(candles.slice(0, index + 1), { period });
      current = rsiSeries[rsiSeries.length - 1]?.value;
    }

    if (current === null || current === undefined) return 0;

    if (current >= lowerBound && current <= upperBound) return 1;
    return 0;
  };
}

/**
 * Create MACD bullish crossover signal evaluator
 *
 * Returns 1 when MACD line crosses above signal line.
 * @throws Error if a period is not a positive integer, or `fastPeriod` is not less than `slowPeriod`
 * @example
 * ```ts
 * import { ScoreBuilder, createMacdBullishEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "macdBull", displayName: "MACD Bullish", weight: 1.5, evaluate: createMacdBullishEvaluator() })
 *   .build();
 * ```
 */
export function createMacdBullishEvaluator(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): SignalDefinition["evaluate"] {
  assertMacdPeriods("createMacdBullishEvaluator", fastPeriod, slowPeriod, signalPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < slowPeriod + signalPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current:
      | { macd: number | null; signal: number | null; histogram: number | null }
      | undefined;
    let prev: { macd: number | null; signal: number | null; histogram: number | null } | undefined;

    if (precomputed?.macd && fastPeriod === 12 && slowPeriod === 26 && signalPeriod === 9) {
      current = precomputed.macd[index];
      prev = precomputed.macd[index - 1];
    } else {
      const macdSeries = macd(candles.slice(0, index + 1), {
        fastPeriod,
        slowPeriod,
        signalPeriod,
      });
      if (macdSeries.length < 2) return 0;
      current = macdSeries[macdSeries.length - 1]?.value;
      prev = macdSeries[macdSeries.length - 2]?.value;
    }

    if (!current || !prev) return 0;
    if (current.histogram === null || prev.histogram === null) return 0;

    // Crossover: was below, now above
    if (prev.histogram < 0 && current.histogram >= 0) {
      return 1;
    }

    // Already bullish (histogram positive)
    if (current.histogram > 0) {
      return 0.5; // Partial score for sustained bullishness
    }

    return 0;
  };
}

/**
 * Create MACD bearish crossover signal evaluator
 *
 * Returns 1 when MACD line crosses below signal line.
 * @throws Error if a period is not a positive integer, or `fastPeriod` is not less than `slowPeriod`
 */
export function createMacdBearishEvaluator(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): SignalDefinition["evaluate"] {
  assertMacdPeriods("createMacdBearishEvaluator", fastPeriod, slowPeriod, signalPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < slowPeriod + signalPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current:
      | { macd: number | null; signal: number | null; histogram: number | null }
      | undefined;
    let prev: { macd: number | null; signal: number | null; histogram: number | null } | undefined;

    if (precomputed?.macd && fastPeriod === 12 && slowPeriod === 26 && signalPeriod === 9) {
      current = precomputed.macd[index];
      prev = precomputed.macd[index - 1];
    } else {
      const macdSeries = macd(candles.slice(0, index + 1), {
        fastPeriod,
        slowPeriod,
        signalPeriod,
      });
      if (macdSeries.length < 2) return 0;
      current = macdSeries[macdSeries.length - 1]?.value;
      prev = macdSeries[macdSeries.length - 2]?.value;
    }

    if (!current || !prev) return 0;
    if (current.histogram === null || prev.histogram === null) return 0;

    if (prev.histogram > 0 && current.histogram <= 0) {
      return 1;
    }

    if (current.histogram < 0) {
      return 0.5;
    }

    return 0;
  };
}

/**
 * Create Stochastics oversold signal evaluator
 *
 * Returns 1 when both %K and %D are in oversold territory.
 *
 * @param threshold - Oversold threshold (default: 20)
 * @param kPeriod - %K period (default: 14)
 * @param dPeriod - %D period (default: 3)
 * @throws Error if `threshold` is outside [0, 100] or a period is not a positive integer
 * @example
 * ```ts
 * import { ScoreBuilder } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "stochOS", displayName: "Stoch < 20", weight: 2.0, evaluate: createStochOversoldEvaluator(20) })
 *   .build();
 * ```
 */
export function createStochOversoldEvaluator(
  threshold = 20,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
  assertInRange("createStochOversoldEvaluator threshold", threshold, 0, 100);
  assertPeriod("createStochOversoldEvaluator kPeriod", kPeriod);
  assertPeriod("createStochOversoldEvaluator dPeriod", dPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < kPeriod + dPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current: { k: number | null; d: number | null } | undefined;

    if (precomputed?.stoch && kPeriod === 14 && dPeriod === 3) {
      current = precomputed.stoch[index];
    } else {
      const stochSeries = stochastics(candles.slice(0, index + 1), {
        kPeriod,
        dPeriod,
      });
      current = stochSeries[stochSeries.length - 1]?.value;
    }

    if (!current || current.k === null || current.d === null) return 0;

    // Both K and D oversold
    if (current.k <= threshold && current.d <= threshold) {
      return 1;
    }

    // Only K oversold
    if (current.k <= threshold) {
      return 0.7;
    }

    return 0;
  };
}

/**
 * Create Stochastics overbought signal evaluator
 *
 * Returns 1 when both %K and %D are in overbought territory.
 *
 * @param threshold - Overbought threshold (default: 80)
 * @param kPeriod - %K period (default: 14)
 * @param dPeriod - %D period (default: 3)
 * @throws Error if `threshold` is outside [0, 100] or a period is not a positive integer
 */
export function createStochOverboughtEvaluator(
  threshold = 80,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
  assertInRange("createStochOverboughtEvaluator threshold", threshold, 0, 100);
  assertPeriod("createStochOverboughtEvaluator kPeriod", kPeriod);
  assertPeriod("createStochOverboughtEvaluator dPeriod", dPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < kPeriod + dPeriod) return 0;

    // Use pre-computed data if available (for default periods only)
    let current: { k: number | null; d: number | null } | undefined;

    if (precomputed?.stoch && kPeriod === 14 && dPeriod === 3) {
      current = precomputed.stoch[index];
    } else {
      const stochSeries = stochastics(candles.slice(0, index + 1), {
        kPeriod,
        dPeriod,
      });
      current = stochSeries[stochSeries.length - 1]?.value;
    }

    if (!current || current.k === null || current.d === null) return 0;

    if (current.k >= threshold && current.d >= threshold) {
      return 1;
    }

    if (current.k >= threshold) {
      return 0.7;
    }

    return 0;
  };
}

/**
 * Create Stochastics bullish crossover evaluator
 *
 * Returns 1 when %K crosses above %D in oversold territory.
 * @throws Error if `oversoldThreshold` is outside [0, 100] or a period is not a positive integer
 * @example
 * ```ts
 * import { ScoreBuilder } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "stochCross", displayName: "Stoch Bull Cross", weight: 2.5, evaluate: createStochBullishCrossEvaluator(20) })
 *   .build();
 * ```
 */
export function createStochBullishCrossEvaluator(
  oversoldThreshold = 20,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
  assertInRange("createStochBullishCrossEvaluator oversoldThreshold", oversoldThreshold, 0, 100);
  assertPeriod("createStochBullishCrossEvaluator kPeriod", kPeriod);
  assertPeriod("createStochBullishCrossEvaluator dPeriod", dPeriod);
  return (
    candles: NormalizedCandle[],
    index: number,
    _context?: unknown,
    precomputed?: PrecomputedIndicators,
  ) => {
    if (index < kPeriod + dPeriod + 1) return 0;

    // Use pre-computed data if available (for default periods only)
    let current: { k: number | null; d: number | null } | undefined;
    let prev: { k: number | null; d: number | null } | undefined;

    if (precomputed?.stoch && kPeriod === 14 && dPeriod === 3) {
      current = precomputed.stoch[index];
      prev = precomputed.stoch[index - 1];
    } else {
      const stochSeries = stochastics(candles.slice(0, index + 1), {
        kPeriod,
        dPeriod,
      });
      if (stochSeries.length < 2) return 0;
      current = stochSeries[stochSeries.length - 1]?.value;
      prev = stochSeries[stochSeries.length - 2]?.value;
    }

    if (!current || !prev) return 0;
    if (current.k === null || current.d === null) return 0;
    if (prev.k === null || prev.d === null) return 0;

    // K crosses above D
    const crossover = prev.k <= prev.d && current.k > current.d;

    if (crossover && current.k <= oversoldThreshold + 10) {
      return 1; // Crossover in oversold zone
    }

    if (crossover) {
      return 0.5; // Crossover anywhere else
    }

    return 0;
  };
}

// Pre-built signal definitions for convenience
export const rsiOversold30: SignalDefinition = {
  name: "rsiOversold30",
  displayName: "RSI < 30",
  weight: 2.0,
  category: "momentum",
  evaluate: /* @__PURE__ */ createRsiOversoldEvaluator(30, 14),
  requiredIndicators: ["rsi14"],
};

export const rsiOverbought70: SignalDefinition = {
  name: "rsiOverbought70",
  displayName: "RSI > 70",
  weight: 2.0,
  category: "momentum",
  evaluate: /* @__PURE__ */ createRsiOverboughtEvaluator(70, 14),
  requiredIndicators: ["rsi14"],
};

export const macdBullish: SignalDefinition = {
  name: "macdBullish",
  displayName: "MACD Bullish",
  weight: 1.5,
  category: "momentum",
  evaluate: /* @__PURE__ */ createMacdBullishEvaluator(),
  requiredIndicators: ["macd"],
};

export const macdBearish: SignalDefinition = {
  name: "macdBearish",
  displayName: "MACD Bearish",
  weight: 1.5,
  category: "momentum",
  evaluate: /* @__PURE__ */ createMacdBearishEvaluator(),
  requiredIndicators: ["macd"],
};

export const stochOversold: SignalDefinition = {
  name: "stochOversold",
  displayName: "Stoch < 20",
  weight: 1.5,
  category: "momentum",
  evaluate: /* @__PURE__ */ createStochOversoldEvaluator(20),
  requiredIndicators: ["stoch"],
};

export const stochOverbought: SignalDefinition = {
  name: "stochOverbought",
  displayName: "Stoch > 80",
  weight: 1.5,
  category: "momentum",
  evaluate: /* @__PURE__ */ createStochOverboughtEvaluator(80),
  requiredIndicators: ["stoch"],
};
