/**
 * Annualization helpers.
 *
 * Single source of truth for "how many periods per year" across risk,
 * volatility, and runtime-metrics modules. Each consuming function accepts
 * an `AnnualizationOptions` bag and resolves it here, so the fallback
 * default (`252`) only lives in one place.
 */

import type { TradingCalendar } from "./types";

/**
 * Options for controlling how a scalar metric is annualized.
 *
 * Resolution order when both are supplied: `calendar` wins. Omitting both
 * yields the US-equity convention (`252`).
 */
export type AnnualizationOptions = {
  /** Calendar preset supplying `tradingDaysPerYear`. */
  calendar?: TradingCalendar;
  /** Raw override (bars per year). Useful for non-daily bar frequencies. */
  periodsPerYear?: number;
};

/**
 * Resolve a concrete periods-per-year factor from the options bag.
 *
 * @returns `calendar.tradingDaysPerYear` if provided, otherwise
 *          `periodsPerYear`, otherwise `252`.
 */
export function annualizationFactor(opts: AnnualizationOptions = {}): number {
  if (opts.calendar) return opts.calendar.tradingDaysPerYear;
  return opts.periodsPerYear ?? 252;
}
