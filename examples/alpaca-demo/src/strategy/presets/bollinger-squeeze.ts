/**
 * Bollinger Band Squeeze Strategy
 *
 * Entry: Price touches lower Bollinger Band (oversold bounce) + RSI < 40
 * Exit: Price touches upper Bollinger Band (overbought) or RSI > 70
 * Mean-reversion approach using Bollinger Bands
 */

import {
  incremental,
  bollingerTouch,
  rsiAbove as backtestRsiAbove,
} from "trendcraft";
import type { streaming, NormalizedCandle } from "trendcraft";
import type { StrategyDefinition } from "../types.js";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { US_MARKET_HOURS } from "../../config/market-hours.js";

const entryCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const bb = snapshot.bb as
    | { lower: number; upper: number; middle: number }
    | null;
  const rsi = snapshot.rsi as number | null;
  if (!bb || rsi === null) return false;
  return candle.close <= bb.lower && rsi < 40;
};

const exitCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const bb = snapshot.bb as
    | { lower: number; upper: number; middle: number }
    | null;
  const rsi = snapshot.rsi as number | null;
  if (!bb || rsi === null) return false;
  return candle.close >= bb.upper || rsi > 70;
};

export const bollingerSqueeze: StrategyDefinition = {
  id: "bollinger-squeeze",
  name: "Bollinger Squeeze",
  description:
    "Buy at lower Bollinger Band + RSI < 40, sell at upper band or RSI > 70",
  intervalMs: 60_000,
  symbols: DEFAULT_SYMBOLS,

  pipeline: {
    indicators: [
      {
        name: "bb",
        create: () =>
          incremental.createBollingerBands({ period: 20, stdDev: 2 }),
      },
      { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
    ],
    entry: entryCondition,
    exit: exitCondition,
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
    stopLoss: 2.5,
    takeProfit: 5,
    slippage: 0.05,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  backtestAdapter: {
    entryCondition: bollingerTouch("lower"),
    exitCondition: backtestRsiAbove(70),
    options: {
      stopLoss: 2.5,
      takeProfit: 5,
      slippage: 0.05,
    },
  },
};
