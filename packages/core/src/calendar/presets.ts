/**
 * Preset trading calendars for common markets.
 *
 * Values are conventional periods-per-year used in industry for Sharpe /
 * volatility annualization. They do not carry holiday tables — core
 * intentionally avoids year-by-year data that would go stale.
 */

import type { TradingCalendar } from "./types";

/** US equities (NYSE / Nasdaq): ~252 trading days per year. */
export const US_EQUITY_CALENDAR: TradingCalendar = {
  name: "US Equity",
  tradingDaysPerYear: 252,
};

/** Japan Exchange Group (JPX): ~245 trading days per year (more holidays than US). */
export const JPX_CALENDAR: TradingCalendar = {
  name: "JPX",
  tradingDaysPerYear: 245,
};

/** Hong Kong Exchange (HKEX): ~247 trading days per year. */
export const HKEX_CALENDAR: TradingCalendar = {
  name: "HKEX",
  tradingDaysPerYear: 247,
};

/** Crypto (24/7 continuous): 365 periods per year for daily bars. */
export const CRYPTO_CALENDAR: TradingCalendar = {
  name: "Crypto",
  tradingDaysPerYear: 365,
};

/** Spot FX (24/5 Mon-Fri): ~260 trading days per year. */
export const FX_CALENDAR: TradingCalendar = {
  name: "FX",
  tradingDaysPerYear: 260,
};
