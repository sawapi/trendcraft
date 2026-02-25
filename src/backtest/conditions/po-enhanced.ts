/**
 * Enhanced Perfect Order conditions
 */

import {
  type PerfectOrderValueEnhanced,
  perfectOrderEnhanced,
} from "../../signals/perfect-order";
import type { PresetCondition } from "../../types";
import type { PerfectOrderConditionOptions } from "./po-basic";

// ============================================
// Enhanced Perfect Order Conditions
// ============================================

/**
 * Options for enhanced perfect order conditions
 */
export type PerfectOrderEnhancedConditionOptions = PerfectOrderConditionOptions & {
  /** Lookback period for slope calculation (default: 3) */
  slopeLookback?: number;
  /** Number of consecutive bars required for confirmation (default: 3) */
  persistBars?: number;
  /** Threshold for MA convergence detection as ratio (default: 0.003 = 0.3%) */
  collapseEps?: number;
  /** Minimum confidence score (default: 0) */
  minConfidence?: number;
};

/**
 * Enhanced Perfect Order confirmed (bullish)
 * Triggers when bullish perfect order is confirmed (all slopes UP + persistence)
 *
 * @example
 * ```ts
 * // Entry when confirmed bullish perfect order
 * const entry = perfectOrderBullishConfirmed();
 *
 * // With minimum confidence
 * const highConfEntry = perfectOrderBullishConfirmed({ minConfidence: 0.9 });
 * ```
 */
export function perfectOrderBullishConfirmed(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    minStrength = 0,
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minConfidence = 0,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBullishConfirmed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return (
        po.state === "BULLISH_PO" &&
        po.isConfirmed &&
        po.strength >= minStrength &&
        po.confidence >= minConfidence
      );
    },
  };
}

/**
 * Enhanced Perfect Order confirmed (bearish)
 * Triggers when bearish perfect order is confirmed (all slopes DOWN + persistence)
 */
export function perfectOrderBearishConfirmed(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    minStrength = 0,
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minConfidence = 0,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBearishConfirmed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return (
        po.state === "BEARISH_PO" &&
        po.isConfirmed &&
        po.strength >= minStrength &&
        po.confidence >= minConfidence
      );
    },
  };
}

/**
 * Enhanced Perfect Order confirmation formed
 * Triggers at the moment when a perfect order becomes confirmed
 *
 * This is useful as an entry signal - fires exactly once when PO becomes confirmed
 */
export function perfectOrderConfirmationFormed(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderConfirmationFormed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.confirmationFormed;
    },
  };
}

/**
 * Enhanced Perfect Order breakdown detected
 * Triggers when perfect order starts breaking down
 *
 * This is useful as an early exit signal - fires when PO structure degrades
 */
export function perfectOrderBreakdown(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderBreakdown(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.breakdownDetected;
    },
  };
}

/**
 * Enhanced Perfect Order MA convergence (squeeze) detected
 * Triggers when all MAs converge (COLLAPSED state)
 *
 * This indicates energy accumulation before next move - useful for anticipating breakouts
 */
export function perfectOrderMaCollapsed(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderMaCollapsed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.collapseDetected;
    },
  };
}

/**
 * Enhanced Perfect Order in pre-bullish state
 * Triggers when conditions are forming for bullish PO (not yet confirmed)
 *
 * Useful for early entries with tighter stops
 */
export function perfectOrderPreBullish(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderPreBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.state === "PRE_BULLISH_PO";
    },
  };
}

/**
 * Enhanced Perfect Order in pre-bearish state
 * Triggers when conditions are forming for bearish PO (not yet confirmed)
 */
export function perfectOrderPreBearish(
  options: PerfectOrderEnhancedConditionOptions = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
  } = options;
  const cacheKey = `poe_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;

  return {
    type: "preset",
    name: `perfectOrderPreBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as
        | { time: number; value: PerfectOrderValueEnhanced }[]
        | undefined;

      if (!poData) {
        poData = perfectOrderEnhanced(candles, {
          enhanced: true,
          periods,
          maType,
          slopeLookback,
          persistBars,
          collapseEps,
        });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.state === "PRE_BEARISH_PO";
    },
  };
}
