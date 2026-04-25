/**
 * Trading calendar types.
 *
 * The calendar module is intentionally tiny: it only provides the
 * "periods per year" factor used for annualizing volatility / Sharpe /
 * return metrics. Holiday tables are not shipped in core — users can
 * supply their own `isTradingDay` predicate when they need gap-aware
 * analysis.
 */

/**
 * A market-specific annualization calendar.
 *
 * @example
 * ```ts
 * import { JPX_CALENDAR, calculateVaR } from "trendcraft";
 *
 * // Use ~245 days/year for a Japanese-market strategy instead of US 252
 * const result = calculateVaR(returns, { confidence: 0.95, calendar: JPX_CALENDAR });
 * ```
 */
export interface TradingCalendar {
  /** Human-readable name, surfaced in logs / reports. */
  name: string;
  /**
   * Number of trading periods per year used for annualization:
   * - Sharpe/Sortino: `mean/sd * sqrt(tradingDaysPerYear)`
   * - Annualized return: `(1 + total) ** (tradingDaysPerYear / n) - 1`
   * - Historical volatility: `stdDev * sqrt(tradingDaysPerYear)`
   */
  tradingDaysPerYear: number;
  /**
   * Optional holiday predicate. When omitted, every day is considered a
   * trading day — sufficient for pure annualization math. Provide a custom
   * predicate only when the consumer needs bar-level gap detection.
   */
  isTradingDay?(date: Date): boolean;
}
