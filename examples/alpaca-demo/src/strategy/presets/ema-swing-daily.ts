/**
 * EMA Crossover Swing Strategy (Daily)
 *
 * Entry: EMA(10) crosses above EMA(30)
 * Exit: EMA(10) crosses below EMA(30)
 * No time guard — positions held overnight (swing trade)
 */

import {
  type NormalizedCandle,
  type StrategyDefinition,
  ema,
  incremental,
  streaming,
} from "trendcraft";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { DEFAULT_TRADING_COSTS } from "../../config/trading-costs.js";

// Custom backtest condition for EMA cross (golden)
function emaCross(direction: "golden" | "dead", shortPeriod: number, longPeriod: number) {
  return (
    indicators: Record<string, unknown>,
    _candle: NormalizedCandle,
    index: number,
    candles: NormalizedCandle[],
  ) => {
    if (index < 1) return false;

    const shortKey = `ema${shortPeriod}`;
    const longKey = `ema${longPeriod}`;

    if (!indicators[shortKey]) {
      indicators[shortKey] = ema(candles, { period: shortPeriod });
    }
    if (!indicators[longKey]) {
      indicators[longKey] = ema(candles, { period: longPeriod });
    }

    const shortEma = indicators[shortKey] as { time: number; value: number | null }[];
    const longEma = indicators[longKey] as { time: number; value: number | null }[];

    const currShort = shortEma[index]?.value;
    const currLong = longEma[index]?.value;
    const prevShort = shortEma[index - 1]?.value;
    const prevLong = longEma[index - 1]?.value;

    if (currShort === null || currLong === null || prevShort === null || prevLong === null) {
      return false;
    }

    if (direction === "golden") {
      return prevShort <= prevLong && currShort > currLong;
    }
    return prevShort >= prevLong && currShort < currLong;
  };
}

export const emaSwingDaily: StrategyDefinition = {
  id: "ema-swing-daily",
  name: "EMA Crossover Swing (Daily)",
  description: "Daily EMA(10)/EMA(30) crossover swing trade — no intraday time guard",
  intervalMs: 86_400_000,
  symbols: DEFAULT_SYMBOLS.slice(0, 4),

  pipeline: {
    indicators: [
      { name: "ema10", create: () => incremental.createEma({ period: 10 }) },
      { name: "ema30", create: () => incremental.createEma({ period: 30 }) },
    ],
    entry: streaming.crossOver("ema10", "ema30"),
    exit: streaming.crossUnder("ema10", "ema30"),
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
    trailingStop: 6,
    partialTakeProfit: { threshold: 4, sellPercent: 50 },
    breakevenStop: { threshold: 3, buffer: 0.5 },
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },

  signalLifecycle: { cooldown: { bars: 2 } },

  metadata: { backtestTimeframe: "1Day", backtestPeriodDays: 180 },

  backtestEntry: emaCross("golden", 10, 30),
  backtestExit: emaCross("dead", 10, 30),
  backtestOptions: {
    stopLoss: 5,
    trailingStop: 6,
    partialTakeProfit: { threshold: 4, sellPercent: 50 },
    breakevenStop: { threshold: 3, buffer: 0.5 },
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },
};
