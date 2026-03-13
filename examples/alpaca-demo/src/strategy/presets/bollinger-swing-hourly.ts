/**
 * Bollinger + ADX Trend Strategy (Hourly)
 *
 * Entry: Price < BB lower band AND ADX > 25
 * Exit: Price > BB upper band
 * No time guard — positions held overnight (swing trade)
 */

import {
  type NormalizedCandle,
  type StrategyDefinition,
  bollingerBands,
  dmi,
  incremental,
  type streaming,
} from "trendcraft";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { DEFAULT_TRADING_COSTS } from "../../config/trading-costs.js";

// Streaming entry: price < BB lower AND ADX > 25
const entryCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const bb = snapshot.bb as { lower: number; upper: number; middle: number } | null;
  const dmiVal = snapshot.dmi as { adx: number; plusDi: number; minusDi: number } | null;
  if (!bb || !dmiVal) return false;
  return candle.close < bb.lower && dmiVal.adx > 25;
};

// Streaming exit: price > BB upper
const exitCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const bb = snapshot.bb as { lower: number; upper: number; middle: number } | null;
  if (!bb) return false;
  return candle.close > bb.upper;
};

// Backtest entry: price < BB lower AND ADX > 25
function bollingerAdxEntry() {
  return (
    indicators: Record<string, unknown>,
    candle: NormalizedCandle,
    index: number,
    candles: NormalizedCandle[],
  ) => {
    if (!indicators._bb20) {
      indicators._bb20 = bollingerBands(candles, { period: 20, stdDev: 2 });
    }
    if (!indicators._dmi14) {
      indicators._dmi14 = dmi(candles, { period: 14 });
    }

    const bbSeries = indicators._bb20 as {
      time: number;
      value: { upper: number; middle: number; lower: number } | null;
    }[];
    const dmiSeries = indicators._dmi14 as {
      time: number;
      value: { plusDi: number | null; minusDi: number | null; adx: number | null };
    }[];

    const bb = bbSeries[index]?.value;
    const dmiVal = dmiSeries[index]?.value;

    if (!bb || !dmiVal || dmiVal.adx === null) return false;
    return candle.close < bb.lower && dmiVal.adx > 25;
  };
}

// Backtest exit: price > BB upper
function bollingerUpperExit() {
  return (
    indicators: Record<string, unknown>,
    candle: NormalizedCandle,
    index: number,
    candles: NormalizedCandle[],
  ) => {
    if (!indicators._bb20) {
      indicators._bb20 = bollingerBands(candles, { period: 20, stdDev: 2 });
    }

    const bbSeries = indicators._bb20 as {
      time: number;
      value: { upper: number; middle: number; lower: number } | null;
    }[];
    const bb = bbSeries[index]?.value;

    if (!bb) return false;
    return candle.close > bb.upper;
  };
}

export const bollingerSwingHourly: StrategyDefinition = {
  id: "bollinger-swing-hourly",
  name: "Bollinger + ADX Trend (Hourly)",
  description: "Hourly BB(20,2) lower band + ADX > 25 entry, BB upper band exit — swing trade",
  intervalMs: 3_600_000,
  symbols: DEFAULT_SYMBOLS.slice(0, 4),

  pipeline: {
    indicators: [
      {
        name: "bb",
        create: () => incremental.createBollingerBands({ period: 20, stdDev: 2 }),
      },
      { name: "dmi", create: () => incremental.createDmi({ period: 14 }) },
      { name: "atr", create: () => incremental.createAtr({ period: 14 }) },
    ],
    entry: entryCondition,
    exit: exitCondition,
  },

  guards: {
    riskGuard: {
      maxDailyLoss: -5_000,
      maxDailyTrades: 6,
    },
    // No timeGuard — swing strategy holds overnight
  },

  position: {
    capital: 100_000,
    sizing: { method: "risk-based", riskPercent: 0.75 },
    stopLoss: 4,
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  metadata: { backtestTimeframe: "1Hour", backtestPeriodDays: 90 },

  backtestEntry: bollingerAdxEntry(),
  backtestExit: bollingerUpperExit(),
  backtestOptions: {
    stopLoss: 4,
    atrTrailingStop: { period: 14, multiplier: 2.5 },
    slippage: DEFAULT_TRADING_COSTS.slippage,
    commission: DEFAULT_TRADING_COSTS.commission,
    commissionRate: DEFAULT_TRADING_COSTS.commissionRate,
    taxRate: DEFAULT_TRADING_COSTS.taxRate,
  },
};
