/**
 * RSI Mean Reversion Strategy
 *
 * Entry: RSI(14) crosses below 30
 * Exit: RSI(14) crosses above 70
 * Guard: Max daily loss -5000, max 10 trades/day
 */

import {
  type StrategyDefinition,
  rsiAbove as backtestRsiAbove,
  rsiBelow as backtestRsiBelow,
  incremental,
  streaming,
} from "trendcraft";
import { US_MARKET_HOURS } from "../../config/market-hours.js";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { DEFAULT_TRADING_COSTS } from "../../config/trading-costs.js";

export const rsiMeanReversion: StrategyDefinition = {
  id: "rsi-mean-reversion",
  name: "RSI Mean Reversion",
  description: "Buy when RSI(14) < 30, sell when RSI(14) > 70",
  intervalMs: 60_000,
  symbols: DEFAULT_SYMBOLS,

  pipeline: {
    indicators: [{ name: "rsi", create: () => incremental.createRsi({ period: 14 }) }],
    entry: streaming.rsiBelow(30),
    exit: streaming.rsiAbove(70),
  },

  guards: {
    riskGuard: {
      maxDailyLoss: -5_000,
      maxDailyTrades: 10,
    },
    timeGuard: US_MARKET_HOURS,
  },

  position: {
    capital: 100_000,
    sizing: { method: "risk-based", riskPercent: 1 },
    stopLoss: 3,
    takeProfit: 6,
    partialTakeProfit: { threshold: 3, sellPercent: 50 },
    breakevenStop: { threshold: 2, buffer: 0.5 },
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  metadata: { backtestTimeframe: "5Min", backtestPeriodDays: 5 },

  backtestEntry: backtestRsiBelow(30),
  backtestExit: backtestRsiAbove(70),
  backtestOptions: {
    stopLoss: 3,
    takeProfit: 6,
    partialTakeProfit: { threshold: 3, sellPercent: 50 },
    breakevenStop: { threshold: 2, buffer: 0.5 },
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },
};
