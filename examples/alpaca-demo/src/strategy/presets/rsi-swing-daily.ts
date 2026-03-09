/**
 * RSI Swing Strategy (Daily)
 *
 * Entry: RSI(14) < 35 AND price > EMA(50)
 * Exit: RSI(14) > 65
 * No time guard — positions held overnight (swing trade)
 */

import {
  type NormalizedCandle,
  type StrategyDefinition,
  rsiAbove as backtestRsiAbove,
  ema,
  incremental,
  rsi,
  streaming,
} from "trendcraft";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";

// Backtest entry: RSI < 35 AND price > EMA(50)
function rsiSwingEntry() {
  return (
    indicators: Record<string, unknown>,
    candle: NormalizedCandle,
    index: number,
    candles: NormalizedCandle[],
  ) => {
    if (!indicators._rsi14) {
      indicators._rsi14 = rsi(candles, { period: 14 });
    }
    if (!indicators._ema50) {
      indicators._ema50 = ema(candles, { period: 50 });
    }

    const rsiSeries = indicators._rsi14 as { time: number; value: number | null }[];
    const emaSeries = indicators._ema50 as { time: number; value: number | null }[];

    const rsiVal = rsiSeries[index]?.value;
    const emaVal = emaSeries[index]?.value;

    if (rsiVal === null || rsiVal === undefined) return false;
    if (emaVal === null || emaVal === undefined) return false;

    return rsiVal < 35 && candle.close > emaVal;
  };
}

export const rsiSwingDaily: StrategyDefinition = {
  id: "rsi-swing-daily",
  name: "RSI Swing (Daily)",
  description: "Daily RSI < 35 + price > EMA(50) entry, RSI > 65 exit — swing trade",
  intervalMs: 86_400_000,
  symbols: DEFAULT_SYMBOLS.slice(0, 4),

  pipeline: {
    indicators: [
      { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
      { name: "ema50", create: () => incremental.createEma({ period: 50 }) },
    ],
    entry: streaming.and(streaming.rsiBelow(35), streaming.priceAbove("ema50")),
    exit: streaming.rsiAbove(65),
  },

  guards: {
    riskGuard: {
      maxDailyLoss: -5_000,
      maxDailyTrades: 4,
    },
    // No timeGuard — swing strategy holds overnight
  },

  position: {
    capital: 100_000,
    sizing: { method: "risk-based", riskPercent: 0.5 },
    stopLoss: 5,
    takeProfit: 10,
    slippage: 0.05,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  backtestEntry: rsiSwingEntry(),
  backtestExit: backtestRsiAbove(65),
  backtestOptions: {
    stopLoss: 5,
    takeProfit: 10,
    slippage: 0.05,
  },
};
