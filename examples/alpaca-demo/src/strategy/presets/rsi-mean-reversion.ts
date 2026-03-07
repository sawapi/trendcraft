/**
 * RSI Mean Reversion Strategy
 *
 * Entry: RSI(14) crosses below 30
 * Exit: RSI(14) crosses above 70
 * Guard: Max daily loss -5000, max 10 trades/day
 */

import {
  incremental,
  streaming,
  rsiBelow as backtestRsiBelow,
  rsiAbove as backtestRsiAbove,
} from "trendcraft";
import type { StrategyDefinition } from "../types.js";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { US_MARKET_HOURS } from "../../config/market-hours.js";

export const rsiMeanReversion: StrategyDefinition = {
  id: "rsi-mean-reversion",
  name: "RSI Mean Reversion",
  description: "Buy when RSI(14) < 30, sell when RSI(14) > 70",
  intervalMs: 60_000,
  symbols: DEFAULT_SYMBOLS,

  pipeline: {
    indicators: [
      { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
    ],
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
    slippage: 0.05,
  },

  backtestAdapter: {
    entryCondition: backtestRsiBelow(30),
    exitCondition: backtestRsiAbove(70),
    options: {
      stopLoss: 3,
      takeProfit: 6,
      slippage: 0.05,
    },
  },
};
