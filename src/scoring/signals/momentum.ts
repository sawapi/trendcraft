/**
 * Momentum Signal Evaluators
 *
 * Signal evaluators for momentum-based indicators (RSI, MACD, Stochastics, etc.)
 */

import { macd, rsi, stochastics } from "../../indicators";
import type { NormalizedCandle, PrecomputedIndicators, SignalDefinition } from "../../types";

/**
 * Create RSI oversold signal evaluator
 *
 * Returns 1 when RSI is at or below threshold, 0 when above.
 * Includes gradual scaling near threshold.
 *
 * @param threshold - RSI oversold threshold (default: 30)
 * @param period - RSI period (default: 14)
 * @example
 * ```ts
 * import { ScoreBuilder, createRsiOversoldEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "rsiOS", weight: 2.0, evaluate: createRsiOversoldEvaluator(25) })
 *   .build();
 * ```
 */
export function createRsiOversoldEvaluator(
  threshold = 30,
  period = 14,
): SignalDefinition["evaluate"] {
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
 */
export function createRsiOverboughtEvaluator(
  threshold = 70,
  period = 14,
): SignalDefinition["evaluate"] {
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
 */
export function createRsiNeutralEvaluator(
  lowerBound = 40,
  upperBound = 60,
  period = 14,
): SignalDefinition["evaluate"] {
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
 * @example
 * ```ts
 * import { ScoreBuilder, createMacdBullishEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "macdBull", weight: 1.5, evaluate: createMacdBullishEvaluator() })
 *   .build();
 * ```
 */
export function createMacdBullishEvaluator(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): SignalDefinition["evaluate"] {
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
 */
export function createMacdBearishEvaluator(
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): SignalDefinition["evaluate"] {
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
 * @example
 * ```ts
 * import { ScoreBuilder, createStochOversoldEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "stochOS", weight: 2.0, evaluate: createStochOversoldEvaluator(20) })
 *   .build();
 * ```
 */
export function createStochOversoldEvaluator(
  threshold = 20,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
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
 */
export function createStochOverboughtEvaluator(
  threshold = 80,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
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
 * @example
 * ```ts
 * import { ScoreBuilder, createStochBullishCrossEvaluator } from "trendcraft";
 *
 * const config = ScoreBuilder.create()
 *   .addSignal({ name: "stochCross", weight: 2.5, evaluate: createStochBullishCrossEvaluator(20) })
 *   .build();
 * ```
 */
export function createStochBullishCrossEvaluator(
  oversoldThreshold = 20,
  kPeriod = 14,
  dPeriod = 3,
): SignalDefinition["evaluate"] {
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
  evaluate: createRsiOversoldEvaluator(30, 14),
  requiredIndicators: ["rsi14"],
};

export const rsiOverbought70: SignalDefinition = {
  name: "rsiOverbought70",
  displayName: "RSI > 70",
  weight: 2.0,
  category: "momentum",
  evaluate: createRsiOverboughtEvaluator(70, 14),
  requiredIndicators: ["rsi14"],
};

export const macdBullish: SignalDefinition = {
  name: "macdBullish",
  displayName: "MACD Bullish",
  weight: 1.5,
  category: "momentum",
  evaluate: createMacdBullishEvaluator(),
  requiredIndicators: ["macd"],
};

export const macdBearish: SignalDefinition = {
  name: "macdBearish",
  displayName: "MACD Bearish",
  weight: 1.5,
  category: "momentum",
  evaluate: createMacdBearishEvaluator(),
  requiredIndicators: ["macd"],
};

export const stochOversold: SignalDefinition = {
  name: "stochOversold",
  displayName: "Stoch < 20",
  weight: 1.5,
  category: "momentum",
  evaluate: createStochOversoldEvaluator(20),
  requiredIndicators: ["stoch"],
};

export const stochOverbought: SignalDefinition = {
  name: "stochOverbought",
  displayName: "Stoch > 80",
  weight: 1.5,
  category: "momentum",
  evaluate: createStochOverboughtEvaluator(80),
  requiredIndicators: ["stoch"],
};
