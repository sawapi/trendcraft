/**
 * Perfect Order pullback and entry conditions
 */

import { type PerfectOrderValueEnhanced, perfectOrderEnhanced } from "../../signals/perfect-order";
import type { PresetCondition } from "../../types";
import type { PerfectOrderEnhancedConditionOptions } from "./po-enhanced";

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
