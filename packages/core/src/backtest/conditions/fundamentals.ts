/**
 * Fundamental metrics conditions for backtesting
 *
 * These conditions evaluate PER (Price-to-Earnings Ratio) and PBR (Price-to-Book Ratio)
 * to filter trades based on valuation metrics.
 */

import type { PresetCondition } from "../../types";

// ============================================
// PER Conditions
// ============================================

/**
 * PER below threshold (undervalued)
 *
 * @param threshold PER threshold (e.g., 15 = PER < 15 is considered undervalued)
 *
 * @example
 * ```ts
 * // Entry only when stock is undervalued (PER < 15)
 * const entry = and(goldenCross(), perBelow(15));
 * ```
 */
export function perBelow(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `perBelow(${threshold})`,
    evaluate: (indicators) => {
      const per = indicators.per as number | null | undefined;
      if (per === null || per === undefined) return false;
      return per < threshold;
    },
  };
}

/**
 * PER above threshold
 *
 * @param threshold PER threshold (e.g., 30 = PER > 30 is considered overvalued)
 *
 * @example
 * ```ts
 * // Exit when stock becomes overvalued (PER > 30)
 * const exit = perAbove(30);
 * ```
 */
export function perAbove(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `perAbove(${threshold})`,
    evaluate: (indicators) => {
      const per = indicators.per as number | null | undefined;
      if (per === null || per === undefined) return false;
      return per > threshold;
    },
  };
}

/**
 * PER within range (inclusive)
 *
 * @param min Minimum PER value
 * @param max Maximum PER value
 *
 * @example
 * ```ts
 * // Entry only when PER is in reasonable range (10-20)
 * const entry = and(goldenCross(), perBetween(10, 20));
 * ```
 */
export function perBetween(min: number, max: number): PresetCondition {
  return {
    type: "preset",
    name: `perBetween(${min},${max})`,
    evaluate: (indicators) => {
      const per = indicators.per as number | null | undefined;
      if (per === null || per === undefined) return false;
      return per >= min && per <= max;
    },
  };
}

// ============================================
// PBR Conditions
// ============================================

/**
 * PBR below threshold (undervalued)
 *
 * @param threshold PBR threshold (e.g., 1.0 = PBR < 1 means trading below book value)
 *
 * @example
 * ```ts
 * // Entry only when stock trades below book value
 * const entry = and(goldenCross(), pbrBelow(1.0));
 * ```
 */
export function pbrBelow(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `pbrBelow(${threshold})`,
    evaluate: (indicators) => {
      const pbr = indicators.pbr as number | null | undefined;
      if (pbr === null || pbr === undefined) return false;
      return pbr < threshold;
    },
  };
}

/**
 * PBR above threshold
 *
 * @param threshold PBR threshold (e.g., 3.0 = PBR > 3 may indicate overvaluation)
 *
 * @example
 * ```ts
 * // Exit when PBR becomes too high
 * const exit = pbrAbove(3.0);
 * ```
 */
export function pbrAbove(threshold: number): PresetCondition {
  return {
    type: "preset",
    name: `pbrAbove(${threshold})`,
    evaluate: (indicators) => {
      const pbr = indicators.pbr as number | null | undefined;
      if (pbr === null || pbr === undefined) return false;
      return pbr > threshold;
    },
  };
}

/**
 * PBR within range (inclusive)
 *
 * @param min Minimum PBR value
 * @param max Maximum PBR value
 *
 * @example
 * ```ts
 * // Entry only when PBR is in value range (0.5-1.5)
 * const entry = and(goldenCross(), pbrBetween(0.5, 1.5));
 * ```
 */
export function pbrBetween(min: number, max: number): PresetCondition {
  return {
    type: "preset",
    name: `pbrBetween(${min},${max})`,
    evaluate: (indicators) => {
      const pbr = indicators.pbr as number | null | undefined;
      if (pbr === null || pbr === undefined) return false;
      return pbr >= min && pbr <= max;
    },
  };
}
