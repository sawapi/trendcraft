/**
 * VWAP Bounce Strategy (Day Trade)
 *
 * Classic intraday mean-reversion around VWAP.
 *
 * Entry: Price pulls back below VWAP and RSI < 35 (oversold dip into VWAP support)
 * Exit:  Price rises above EMA(9) while above VWAP, or RSI > 65
 *
 * Rationale:
 * - VWAP acts as intraday "fair value" — institutional traders anchor to it
 * - Buying below VWAP + oversold RSI catches mean-reversion bounces
 * - EMA(9) above VWAP confirms short-term momentum recovery for exit
 */

import { incremental } from "trendcraft";
import type { streaming, NormalizedCandle } from "trendcraft";
import type { StrategyDefinition } from "../types.js";
import { DEFAULT_SYMBOLS } from "../../config/symbols.js";
import { US_MARKET_HOURS } from "../../config/market-hours.js";

const entryCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const vwap = (snapshot.vwap as { vwap: number | null } | null)?.vwap;
  const rsi = snapshot.rsi as number | null;
  if (vwap === null || vwap === undefined || rsi === null) return false;

  // Price below VWAP + RSI oversold
  return candle.close < vwap && rsi < 35;
};

const exitCondition: streaming.StreamingConditionFn = (
  snapshot: streaming.IndicatorSnapshot,
  candle: NormalizedCandle,
) => {
  const vwap = (snapshot.vwap as { vwap: number | null } | null)?.vwap;
  const ema9 = snapshot.ema9 as number | null;
  const rsi = snapshot.rsi as number | null;
  if (vwap === null || vwap === undefined) return false;

  // Exit if RSI overbought
  if (rsi !== null && rsi > 65) return true;

  // Exit if price above VWAP and above EMA(9) — momentum confirmed
  if (ema9 !== null && candle.close > vwap && candle.close > ema9) return true;

  return false;
};

export const vwapBounce: StrategyDefinition = {
  id: "vwap-bounce",
  name: "VWAP Bounce",
  description:
    "Buy dips below VWAP + RSI < 35, exit above VWAP + EMA(9) or RSI > 65",
  intervalMs: 60_000,
  symbols: DEFAULT_SYMBOLS,

  pipeline: {
    indicators: [
      { name: "vwap", create: () => incremental.createVwap() },
      { name: "rsi", create: () => incremental.createRsi({ period: 14 }) },
      { name: "ema9", create: () => incremental.createEma({ period: 9 }) },
    ],
    entry: entryCondition,
    exit: exitCondition,
  },

  guards: {
    riskGuard: {
      maxDailyLoss: -3_000,
      maxDailyTrades: 12,
    },
    timeGuard: US_MARKET_HOURS,
  },

  position: {
    capital: 100_000,
    sizing: { method: "risk-based", riskPercent: 0.5 },
    stopLoss: 1.5,
    takeProfit: 3,
    slippage: 0.05,
  },

  signalLifecycle: { cooldown: { bars: 3 } },

  backtestAdapter: {
    entryCondition: (indicators, candle) => {
      const vwapSeries = indicators.vwap as
        | { time: number; value: { vwap: number | null } }[]
        | undefined;
      const rsiSeries = indicators.rsi as
        | { time: number; value: number | null }[]
        | undefined;
      if (!vwapSeries || !rsiSeries) return false;

      const vwapEntry = vwapSeries.find((v) => v.time === candle.time);
      const rsiEntry = rsiSeries.find((r) => r.time === candle.time);
      if (!vwapEntry?.value.vwap || !rsiEntry?.value) return false;

      return candle.close < vwapEntry.value.vwap && rsiEntry.value < 35;
    },
    exitCondition: (indicators, candle) => {
      const vwapSeries = indicators.vwap as
        | { time: number; value: { vwap: number | null } }[]
        | undefined;
      const rsiSeries = indicators.rsi as
        | { time: number; value: number | null }[]
        | undefined;
      if (!vwapSeries || !rsiSeries) return false;

      const vwapEntry = vwapSeries.find((v) => v.time === candle.time);
      const rsiEntry = rsiSeries.find((r) => r.time === candle.time);

      if (rsiEntry?.value && rsiEntry.value > 65) return true;
      if (vwapEntry?.value.vwap && candle.close > vwapEntry.value.vwap)
        return true;

      return false;
    },
    options: {
      stopLoss: 1.5,
      takeProfit: 3,
      slippage: 0.05,
    },
  },
};
