/**
 * Dynamic slippage models for realistic backtest simulation.
 *
 * Instead of a flat percentage, slippage can adapt to market conditions
 * (volatility, volume) for more accurate cost estimation.
 */

import type { NormalizedCandle } from "../types";

// ============================================================================
// Types
// ============================================================================

/** Fixed slippage as a constant percentage of price. */
export type FixedSlippageModel = {
  type: "fixed";
  /** Slippage percentage (e.g., 0.1 = 0.1%) */
  percent: number;
};

/** Volatility-based slippage scaled by ATR relative to price. */
export type VolatilitySlippageModel = {
  type: "volatility";
  /** Multiplier applied to (ATR / close) ratio (default: 1) */
  atrMultiplier: number;
};

/** Volume-based slippage using square-root market impact model. */
export type VolumeSlippageModel = {
  type: "volume";
  /** Impact coefficient — higher means more slippage in thin markets (default: 0.1) */
  impactCoeff: number;
};

/** Composite model combining volatility and volume components with weights. */
export type CompositeSlippageModel = {
  type: "composite";
  /** Volatility component multiplier */
  atrMultiplier: number;
  /** Volume impact coefficient */
  impactCoeff: number;
  /** Weight for volatility component (0-1). Volume weight = 1 - volatilityWeight. Default: 0.5 */
  volatilityWeight?: number;
};

/** Union of all slippage model types. */
export type SlippageModel =
  | FixedSlippageModel
  | VolatilitySlippageModel
  | VolumeSlippageModel
  | CompositeSlippageModel;

// ============================================================================
// Core calculation
// ============================================================================

/**
 * Calculate dynamic slippage as a percentage based on the selected model.
 *
 * The returned value has the same semantics as the legacy `slippage` field:
 * a percentage to apply via `applySlippage(price, slippage%, side)`.
 *
 * @param model - The slippage model configuration
 * @param candle - Current candle (used for close price and volume)
 * @param atr - Current ATR value (required for "volatility" and "composite" models)
 * @returns Slippage as a percentage (e.g., 0.15 means 0.15%)
 *
 * @example
 * ```ts
 * // Fixed 0.1% slippage
 * const s1 = calculateDynamicSlippage({ type: "fixed", percent: 0.1 }, candle);
 * // => 0.1
 *
 * // Volatility-based: if ATR=2, close=100, multiplier=1 → 2%
 * const s2 = calculateDynamicSlippage(
 *   { type: "volatility", atrMultiplier: 1 },
 *   candle,
 *   2.0,
 * );
 * // => 2.0
 *
 * // Volume-based: impactCoeff=0.1, volume=10000 → 0.1/100 * 100 = 1%
 * const s3 = calculateDynamicSlippage(
 *   { type: "volume", impactCoeff: 0.1 },
 *   candle,
 * );
 * ```
 */
export function calculateDynamicSlippage(
  model: SlippageModel,
  candle: NormalizedCandle,
  atr?: number,
): number {
  switch (model.type) {
    case "fixed":
      return model.percent;

    case "volatility":
      return calculateVolatilitySlippage(model.atrMultiplier, candle.close, atr);

    case "volume":
      return calculateVolumeSlippage(model.impactCoeff, candle.volume);

    case "composite": {
      const volWeight = model.volatilityWeight ?? 0.5;
      const volumeWeight = 1 - volWeight;
      const volSlippage = calculateVolatilitySlippage(model.atrMultiplier, candle.close, atr);
      const volumeSlippage = calculateVolumeSlippage(model.impactCoeff, candle.volume);
      return volSlippage * volWeight + volumeSlippage * volumeWeight;
    }
  }
}

// ============================================================================
// Legacy compatibility
// ============================================================================

/**
 * Convert a legacy numeric `slippage` value or a `SlippageModel` into a
 * unified `SlippageModel`.
 *
 * This allows backtest configs to accept either the old `slippage: number`
 * field or the new `slippageModel: SlippageModel` field seamlessly.
 *
 * @param slippage - Legacy slippage percentage (e.g., 0.1 = 0.1%)
 * @param model - Explicit slippage model (takes precedence over `slippage`)
 * @returns A `SlippageModel` if either input is provided, otherwise `undefined`
 *
 * @example
 * ```ts
 * // Legacy numeric → FixedSlippageModel
 * resolveSlippageModel(0.1);
 * // => { type: "fixed", percent: 0.1 }
 *
 * // Explicit model takes precedence
 * resolveSlippageModel(0.1, { type: "volatility", atrMultiplier: 1.5 });
 * // => { type: "volatility", atrMultiplier: 1.5 }
 *
 * // Neither provided
 * resolveSlippageModel();
 * // => undefined
 * ```
 */
export function resolveSlippageModel(
  slippage?: number,
  model?: SlippageModel,
): SlippageModel | undefined {
  if (model !== undefined) {
    return model;
  }
  if (slippage !== undefined) {
    return { type: "fixed", percent: slippage };
  }
  return undefined;
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Volatility component: slippage% = (ATR / close) * 100 * atrMultiplier.
 * Returns 0 if ATR is not provided.
 */
function calculateVolatilitySlippage(atrMultiplier: number, close: number, atr?: number): number {
  if (atr === undefined || atr === 0) {
    return 0;
  }
  return (atr / close) * 100 * atrMultiplier;
}

/**
 * Volume component: slippage% = impactCoeff / sqrt(volume) * 100.
 * Falls back to impactCoeff * 100 when volume is 0 or undefined.
 */
function calculateVolumeSlippage(impactCoeff: number, volume?: number): number {
  if (!volume || volume <= 0) {
    return impactCoeff * 100;
  }
  return (impactCoeff / Math.sqrt(volume)) * 100;
}
