/**
 * Trading calendar module.
 *
 * Lightweight API for market-specific annualization factors. Presets cover
 * the most common markets (US equities, JPX, HKEX, crypto, FX); users who
 * need bar-level holiday gap detection can build their own `TradingCalendar`
 * with a custom `isTradingDay` predicate.
 */

export type { TradingCalendar } from "./types";
export type { AnnualizationOptions } from "./annualize";
export { annualizationFactor } from "./annualize";
export {
  CRYPTO_CALENDAR,
  FX_CALENDAR,
  HKEX_CALENDAR,
  JPX_CALENDAR,
  US_EQUITY_CALENDAR,
} from "./presets";
