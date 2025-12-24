/**
 * Perfect Order conditions
 */

import {
  type PerfectOrderValue,
  type PerfectOrderValueEnhanced,
  perfectOrder,
  perfectOrderEnhanced,
} from "../../signals/perfect-order";
import type { PresetCondition } from "../../types";

// ============================================
// Perfect Order Conditions
// ============================================

/**
 * Options for perfect order conditions
 */
export type PerfectOrderConditionOptions = {
  /** MA periods (default: [5, 25, 75]) */
  periods?: number[];
  /** MA type (default: 'sma') */
  maType?: "sma" | "ema" | "wma";
  /** Minimum strength score to trigger (default: 0) */
  minStrength?: number;
};

/**
 * Perfect Order formed (bullish)
 * Triggers when bullish perfect order is formed (short > medium > long MA)
 *
 * @example
 * ```ts
 * // Entry when bullish perfect order forms
 * const entry = perfectOrderBullish();
 *
 * // With minimum strength requirement
 * const strongEntry = perfectOrderBullish({ minStrength: 30 });
 *
 * // Custom periods
 * const customEntry = perfectOrderBullish({ periods: [10, 20, 50, 200] });
 * ```
 */
export function perfectOrderBullish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order formed (bearish)
 * Triggers when bearish perfect order is formed (short < medium < long MA)
 *
 * @example
 * ```ts
 * // Entry when bearish perfect order forms (for short selling)
 * const entry = perfectOrderBearish();
 * ```
 */
export function perfectOrderBearish(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.formed && po.type === "bearish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order collapsed
 * Triggers when a perfect order collapses (MAs no longer in order)
 *
 * Useful as an exit condition - exit when the trend structure breaks down.
 *
 * @example
 * ```ts
 * // Exit when perfect order collapses
 * const exit = perfectOrderCollapsed();
 * ```
 */
export function perfectOrderCollapsed(options: PerfectOrderConditionOptions = {}): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma" } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderCollapsed(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.collapsed;
    },
  };
}

/**
 * Perfect Order active (bullish)
 * Returns true while bullish perfect order is active (not just when it forms)
 *
 * @example
 * ```ts
 * // Hold position while perfect order is active
 * const holdCondition = perfectOrderActiveBullish();
 * ```
 */
export function perfectOrderActiveBullish(
  options: PerfectOrderConditionOptions = {},
): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBullish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bullish" && po.strength >= minStrength;
    },
  };
}

/**
 * Perfect Order active (bearish)
 * Returns true while bearish perfect order is active
 */
export function perfectOrderActiveBearish(
  options: PerfectOrderConditionOptions = {},
): PresetCondition {
  const { periods = [5, 25, 75], maType = "sma", minStrength = 0 } = options;
  const cacheKey = `po_${periods.join("_")}_${maType}`;

  return {
    type: "preset",
    name: `perfectOrderActiveBearish(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      let poData = indicators[cacheKey] as { time: number; value: PerfectOrderValue }[] | undefined;

      if (!poData) {
        poData = perfectOrder(candles, { periods, maType });
        indicators[cacheKey] = poData;
      }

      const po = poData[index]?.value;
      if (!po) return false;

      return po.type === "bearish" && po.strength >= minStrength;
    },
  };
}

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

// ============================================
// Perfect Order Pullback Entry
// ============================================

/**
 * Perfect Order pullback buy entry
 * Triggers when 5-day MA slope changes from DOWN to UP while maintaining bullish order
 * (i.e., pullback recovery without touching 25-day MA)
 *
 * @example
 * ```ts
 * // Entry on pullback recovery during bullish perfect order
 * const entry = perfectOrderPullbackEntry();
 *
 * // With stricter gap requirement
 * const strictEntry = perfectOrderPullbackEntry({ minGapPercent: 1.0 });
 * ```
 */
export function perfectOrderPullbackEntry(
  options: PerfectOrderEnhancedConditionOptions & {
    /** Minimum gap between short MA and mid MA as percentage (default: 0.5%) */
    minGapPercent?: number;
    /** Maximum bars to look back for DOWN slope (default: 5) */
    lookbackBars?: number;
  } = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minGapPercent = 0.5,
    lookbackBars = 5,
  } = options;
  const cacheKey = `poe_pullback_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;
  const stateKey = `poe_pullback_state_${periods.join("_")}`;

  return {
    type: "preset",
    name: `perfectOrderPullbackEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      // Need at least 2 bars to detect slope change
      if (index < 1) return false;

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

      // Track state: has PO+ been confirmed since last breakdown?
      let state = indicators[stateKey] as
        | { hasConfirmedSinceBreakdown: boolean; lastProcessedIndex: number }
        | undefined;
      if (!state) {
        state = { hasConfirmedSinceBreakdown: false, lastProcessedIndex: -1 };
        indicators[stateKey] = state;
      }

      // Update state for all indices from last processed to current
      for (let i = state.lastProcessedIndex + 1; i <= index; i++) {
        const val = poData[i]?.value;
        if (!val) continue;

        // Reset on breakdown
        if (val.breakdownDetected) {
          state.hasConfirmedSinceBreakdown = false;
        }
        // Mark confirmed on PO+ (confirmationFormed)
        if (val.confirmationFormed && val.state === "BULLISH_PO") {
          state.hasConfirmedSinceBreakdown = true;
        }
      }
      state.lastProcessedIndex = index;

      const current = poData[index]?.value;
      const prev = poData[index - 1]?.value;

      if (!current || !prev) return false;

      // 1. Must have had a PO+ confirmation since the last breakdown
      if (!state.hasConfirmedSinceBreakdown) return false;

      // 2. Must be in bullish state (BULLISH_PO or PRE_BULLISH_PO)
      if (current.type !== "bullish") return false;

      // 3. Check if slope just changed to UP (from DOWN or FLAT)
      const shortSlope = current.slopes[0];
      const prevShortSlope = prev.slopes[0];

      // Trigger when slope becomes UP (from non-UP state)
      if (shortSlope !== "UP" || prevShortSlope === "UP") return false;

      // 4. Look back to find if there was a recent DOWN slope (within lookbackBars)
      // This allows for DOWN -> FLAT -> UP pattern
      let hadDownSlope = false;
      for (let i = 1; i <= lookbackBars && index - i >= 0; i++) {
        const pastValue = poData[index - i]?.value;
        if (!pastValue) break;

        // Must have been in bullish state throughout
        if (pastValue.type !== "bullish") break;

        if (pastValue.slopes[0] === "DOWN") {
          hadDownSlope = true;
          break;
        }
        // If we hit UP before DOWN, this is not a pullback recovery
        if (pastValue.slopes[0] === "UP") break;
      }

      if (!hadDownSlope) return false;

      // 5. Short MA must not have touched mid MA (maintain gap)
      const shortMa = current.maValues[0];
      const midMa = current.maValues[1];
      // Guard against null and zero values to prevent division by zero
      if (shortMa === null || midMa === null || midMa === 0) return false;

      const gapPercent = ((shortMa - midMa) / midMa) * 100;
      if (gapPercent < minGapPercent) return false;

      return true;
    },
  };
}

/**
 * Perfect Order pullback sell entry (bearish version)
 * Triggers when 5-day MA slope changes from UP to DOWN while maintaining bearish order
 */
export function perfectOrderPullbackSellEntry(
  options: PerfectOrderEnhancedConditionOptions & {
    /** Minimum gap between short MA and mid MA as percentage (default: 0.5%) */
    minGapPercent?: number;
    /** Maximum bars to look back for UP slope (default: 5) */
    lookbackBars?: number;
  } = {},
): PresetCondition {
  const {
    periods = [5, 25, 75],
    maType = "sma",
    slopeLookback = 3,
    persistBars = 3,
    collapseEps = 0.003,
    minGapPercent = 0.5,
    lookbackBars = 5,
  } = options;
  const cacheKey = `poe_pullback_${periods.join("_")}_${maType}_${slopeLookback}_${persistBars}`;
  const stateKey = `poe_pullback_sell_state_${periods.join("_")}`;

  return {
    type: "preset",
    name: `perfectOrderPullbackSellEntry(${periods.join(",")})`,
    evaluate: (indicators, candle, index, candles) => {
      if (index < 1) return false;

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

      // Track state: has PO+ (bearish) been confirmed since last breakdown?
      let state = indicators[stateKey] as
        | { hasConfirmedSinceBreakdown: boolean; lastProcessedIndex: number }
        | undefined;
      if (!state) {
        state = { hasConfirmedSinceBreakdown: false, lastProcessedIndex: -1 };
        indicators[stateKey] = state;
      }

      // Update state for all indices from last processed to current
      for (let i = state.lastProcessedIndex + 1; i <= index; i++) {
        const val = poData[i]?.value;
        if (!val) continue;

        // Reset on breakdown
        if (val.breakdownDetected) {
          state.hasConfirmedSinceBreakdown = false;
        }
        // Mark confirmed on PO+ (confirmationFormed for bearish)
        if (val.confirmationFormed && val.state === "BEARISH_PO") {
          state.hasConfirmedSinceBreakdown = true;
        }
      }
      state.lastProcessedIndex = index;

      const current = poData[index]?.value;
      const prev = poData[index - 1]?.value;

      if (!current || !prev) return false;

      // 1. Must have had a PO+ (bearish) confirmation since the last breakdown
      if (!state.hasConfirmedSinceBreakdown) return false;

      // 2. Must be in bearish state
      if (current.type !== "bearish") return false;

      // 3. Check if slope just changed to DOWN (from UP or FLAT)
      const shortSlope = current.slopes[0];
      const prevShortSlope = prev.slopes[0];

      // Trigger when slope becomes DOWN (from non-DOWN state)
      if (shortSlope !== "DOWN" || prevShortSlope === "DOWN") return false;

      // 4. Look back to find if there was a recent UP slope (within lookbackBars)
      // This allows for UP -> FLAT -> DOWN pattern
      let hadUpSlope = false;
      for (let i = 1; i <= lookbackBars && index - i >= 0; i++) {
        const pastValue = poData[index - i]?.value;
        if (!pastValue) break;

        // Must have been in bearish state throughout
        if (pastValue.type !== "bearish") break;

        if (pastValue.slopes[0] === "UP") {
          hadUpSlope = true;
          break;
        }
        // If we hit DOWN before UP, this is not a pullback recovery
        if (pastValue.slopes[0] === "DOWN") break;
      }

      if (!hadUpSlope) return false;

      // 5. Short MA must not have touched mid MA (maintain gap below)
      const shortMa = current.maValues[0];
      const midMa = current.maValues[1];
      // Guard against null and zero values to prevent division by zero
      if (shortMa === null || midMa === null || midMa === 0) return false;

      const gapPercent = ((midMa - shortMa) / midMa) * 100;
      if (gapPercent < minGapPercent) return false;

      return true;
    },
  };
}

// ============================================
// PO+ and PB Signal Entry Conditions
// ============================================

/**
 * Entry on PO+ signal (bullish perfect order confirmation)
 * Uses the pre-computed confirmationFormed flag from perfectOrderEnhanced
 *
 * @example
 * ```ts
 * // Simple PO+ entry
 * const entry = poPlusEntry();
 *
 * // Combined with PB for pyramid entries
 * const entry = or(poPlusEntry(), pbEntry());
 * ```
 */
export function poPlusEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
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
    name: `poPlusEntry(${periods.join(",")})`,
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

      // Fire on bullish PO confirmation
      return po.confirmationFormed && po.state === "BULLISH_PO";
    },
  };
}

/**
 * Entry on PB signal (pullback buy during perfect order)
 * Uses the pre-computed pullbackBuySignal flag from perfectOrderEnhanced
 *
 * This fires when 5-day MA slope changes from DOWN to UP while maintaining
 * bullish order and sufficient gap from 25-day MA.
 *
 * @example
 * ```ts
 * // Simple PB entry
 * const entry = pbEntry();
 *
 * // Combined with PO+ for initial + pyramid entries
 * const entry = or(poPlusEntry(), pbEntry());
 * ```
 */
export function pbEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
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
    name: `pbEntry(${periods.join(",")})`,
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

      // Fire on pullback buy signal
      return po.pullbackBuySignal;
    },
  };
}

/**
 * Entry on PO+ or PB signal (combined entry)
 * Combines both initial PO+ confirmation and pullback buy signals
 *
 * @example
 * ```ts
 * // Single condition for both initial entry and pyramid
 * const entry = poPlusPbEntry();
 * ```
 */
export function poPlusPbEntry(options: PerfectOrderEnhancedConditionOptions = {}): PresetCondition {
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
    name: `poPlusPbEntry(${periods.join(",")})`,
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

      // Fire on PO+ (bullish confirmation) or PB signal
      const isPOPlus = po.confirmationFormed && po.state === "BULLISH_PO";
      return isPOPlus || po.pullbackBuySignal;
    },
  };
}
