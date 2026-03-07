/**
 * MACD Trend Following Strategy
 *
 * Entry: MACD histogram crosses above 0 (bullish momentum)
 * Exit: MACD histogram crosses below 0 (bearish momentum)
 * Uses trailing stop for profit protection
 */

import {
  incremental,
  streaming,
  macdCrossUp,
  macdCrossDown,
} from "trendcraft";
import type { StrategyDefinition } from "../types.js";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { US_MARKET_HOURS } from "../../config/market-hours.js";

export const macdTrend: StrategyDefinition = {
  id: "macd-trend",
  name: "MACD Trend Following",
  description:
    "Enter on MACD bullish cross, exit on bearish cross with trailing stop",
  intervalMs: 60_000,
  symbols: DEFAULT_SYMBOLS,

  pipeline: {
    indicators: [
      {
        name: "macd",
        create: () =>
          incremental.createMacd({
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
          }),
      },
    ],
    entry: streaming.macdPositive(),
    exit: streaming.macdNegative(),
  },

  guards: {
    riskGuard: {
      maxDailyLoss: -5_000,
      maxDailyTrades: 8,
    },
    timeGuard: US_MARKET_HOURS,
  },

  position: {
    capital: 100_000,
    sizing: { method: "risk-based", riskPercent: 1 },
    stopLoss: 2,
    trailingStop: 3,
    slippage: 0.05,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  backtestAdapter: {
    entryCondition: macdCrossUp(),
    exitCondition: macdCrossDown(),
    options: {
      stopLoss: 2,
      trailingStop: 3,
      slippage: 0.05,
    },
  },
};
