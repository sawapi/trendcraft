/**
 * Trading cost configuration
 *
 * Centralizes commission, tax, and slippage settings.
 * US stock gains for Japan residents: no US tax, Japan 申告分離課税 20.315% only.
 */

export type TradingCostConfig = {
  /** Fixed per-trade commission ($) */
  commission: number;
  /** Proportional commission rate (%) */
  commissionRate: number;
  /** Tax rate on realized gains (%) */
  taxRate: number;
  /** Slippage (%) */
  slippage: number;
};

export const DEFAULT_TRADING_COSTS: TradingCostConfig = {
  commission: 0, // Alpaca paper = commission-free
  commissionRate: 0,
  taxRate: 20.315, // Japan 申告分離課税
  slippage: 0.05,
};
