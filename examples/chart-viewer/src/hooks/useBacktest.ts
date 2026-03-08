/**
 * Backtest execution hook
 */

import { useCallback, useMemo } from "react";
import type {
  BacktestOptions,
  BacktestResult,
  Condition,
  NormalizedCandle,
  TradeAnalysis,
} from "trendcraft";
import * as TC from "trendcraft";
import type { BacktestConfig } from "../types";

/**
 * Entry condition preset definitions
 */
export const ENTRY_CONDITIONS: Record<string, { label: string; factory: () => Condition }> = {
  // Cross-based
  gc: { label: "Golden Cross (5/25)", factory: () => TC.goldenCrossCondition(5, 25) },
  validatedGc: { label: "Validated GC", factory: () => TC.validatedGoldenCross({ minScore: 50 }) },

  // RSI-based
  rsi30: { label: "RSI < 30", factory: () => TC.rsiBelow(30) },
  rsi40: { label: "RSI < 40", factory: () => TC.rsiBelow(40) },

  // MACD-based
  macdUp: { label: "MACD Cross Up", factory: () => TC.macdCrossUp() },

  // Perfect Order
  poBullish: {
    label: "PO Bullish (Legacy)",
    factory: () => TC.perfectOrderBullish({ periods: [5, 25, 75] }),
  },
  poPlus: { label: "PO+ Entry", factory: () => TC.poPlusEntry({ periods: [5, 25, 75] }) },
  pb: { label: "Pullback Buy", factory: () => TC.pbEntry({ periods: [5, 25, 75] }) },
  poPlusPb: { label: "PO+ or PB", factory: () => TC.poPlusPbEntry({ periods: [5, 25, 75] }) },
  poRsi: {
    label: "PO+ + RSI<60",
    factory: () => TC.and(TC.poPlusEntry({ periods: [5, 25, 75] }), TC.rsiBelow(60)),
  },

  // Bollinger Bands
  bbLower: { label: "BB Lower Touch", factory: () => TC.bollingerTouch("lower") },

  // Stochastics
  stoch20: { label: "Stoch < 20", factory: () => TC.stochBelow(20) },
  stochCrossUp: { label: "Stoch Cross Up", factory: () => TC.stochCrossUp() },
  stochOversoldCross: {
    label: "Stoch Oversold Cross",
    factory: () => TC.and(TC.stochBelow(30), TC.stochCrossUp()),
  },

  // DMI/ADX
  dmiBullish: { label: "DMI Bullish", factory: () => TC.dmiBullish(20) },
  dmiBullishStrong: {
    label: "DMI + ADX Strong",
    factory: () => TC.and(TC.dmiBullish(25), TC.adxStrong(30)),
  },

  // Volume combinations
  gcVolume: {
    label: "GC + Volume",
    factory: () => TC.and(TC.goldenCrossCondition(5, 25), TC.volumeAboveAvg(1.5)),
  },
  macdRsi: {
    label: "MACD + RSI<50",
    factory: () => TC.and(TC.macdCrossUp(), TC.rsiBelow(50)),
  },

  // Range-Bound
  rbBreakout: { label: "Range Breakout", factory: () => TC.rangeBreakout() },
  notInRange: { label: "Not In Range", factory: () => TC.not(TC.inRangeBound()) },

  // Volume conditions
  volAnomaly: { label: "Volume Anomaly", factory: () => TC.volumeAnomalyCondition(2.0, 20) },
  volTrend: { label: "Volume Trend", factory: () => TC.volumeConfirmsTrend() },

  // Combination strategies
  gcVolAnomaly: {
    label: "GC + Vol Anomaly",
    factory: () => TC.and(TC.goldenCrossCondition(5, 25), TC.volumeAnomalyCondition(2.0, 20)),
  },

  // ATR Filter
  atrGc: {
    label: "ATR% + GC",
    factory: () => TC.and(TC.atrPercentAbove(2.3), TC.goldenCrossCondition(5, 25)),
  },
};

/**
 * Exit condition preset definitions
 */
export const EXIT_CONDITIONS: Record<string, { label: string; factory: () => Condition }> = {
  // Cross-based
  dc: { label: "Dead Cross (5/25)", factory: () => TC.deadCrossCondition(5, 25) },
  validatedDc: { label: "Validated DC", factory: () => TC.validatedDeadCross({ minScore: 50 }) },

  // RSI-based
  rsi70: { label: "RSI > 70", factory: () => TC.rsiAbove(70) },
  rsi60: { label: "RSI > 60", factory: () => TC.rsiAbove(60) },

  // MACD-based
  macdDown: { label: "MACD Cross Down", factory: () => TC.macdCrossDown() },

  // Perfect Order
  poCollapsed: {
    label: "PO Collapsed",
    factory: () => TC.perfectOrderCollapsed({ periods: [5, 25, 75] }),
  },
  poBreakdown: {
    label: "PO Breakdown",
    factory: () => TC.perfectOrderBreakdown({ periods: [5, 25, 75] }),
  },

  // Bollinger Bands
  bbUpper: { label: "BB Upper Touch", factory: () => TC.bollingerTouch("upper") },

  // Stochastics
  stoch80: { label: "Stoch > 80", factory: () => TC.stochAbove(80) },
  stochCrossDown: { label: "Stoch Cross Down", factory: () => TC.stochCrossDown() },
  stochOverboughtCross: {
    label: "Stoch Overbought Cross",
    factory: () => TC.and(TC.stochAbove(70), TC.stochCrossDown()),
  },

  // DMI/ADX
  dmiBearish: { label: "DMI Bearish", factory: () => TC.dmiBearish(20) },

  // Range-Bound
  rbForming: { label: "Range Forming", factory: () => TC.rangeForming() },
  inRange: { label: "In Range", factory: () => TC.inRangeBound() },

  // ATR Stop
  atrStop15: { label: "ATR Stop 1.5x", factory: () => TC.priceDroppedAtr(1.5, 10, 14) },
  atrStop20: { label: "ATR Stop 2.0x", factory: () => TC.priceDroppedAtr(2.0, 10, 14) },
  atrStop25: { label: "ATR Stop 2.5x", factory: () => TC.priceDroppedAtr(2.5, 10, 14) },
  atrStop30: { label: "ATR Stop 3.0x", factory: () => TC.priceDroppedAtr(3.0, 10, 14) },

  // Combined exits
  macdVolDiv: {
    label: "MACD + Vol Divergence",
    factory: () => TC.and(TC.macdCrossDown(), TC.volumeDivergence()),
  },
};

/**
 * Backtest execution result including trade analysis
 */
export type BacktestExecutionResult = {
  result: BacktestResult;
  tradeAnalysis: TradeAnalysis;
};

/**
 * Run backtest with given configuration
 */
export function executeBacktest(
  candles: NormalizedCandle[],
  config: BacktestConfig,
): BacktestExecutionResult | null {
  if (candles.length < 50) {
    console.warn("Not enough data for backtest (minimum 50 candles required)");
    return null;
  }

  // Get conditions
  const entryFactory = ENTRY_CONDITIONS[config.entryCondition]?.factory;
  const exitFactory = EXIT_CONDITIONS[config.exitCondition]?.factory;

  if (!entryFactory || !exitFactory) {
    console.error("Invalid condition selected:", config.entryCondition, config.exitCondition);
    return null;
  }

  const entryCondition = entryFactory();
  const exitCondition = exitFactory();

  // Filter by start date
  let filteredCandles = candles;
  if (config.startDate) {
    const startTime = new Date(config.startDate).getTime();
    filteredCandles = candles.filter((c) => c.time >= startTime);
  }

  if (filteredCandles.length < 50) {
    console.warn("Not enough data after date filter (minimum 50 candles required)");
    return null;
  }

  // Build options
  const options: BacktestOptions = {
    capital: config.capital,
    stopLoss: config.stopLoss,
    takeProfit: config.takeProfit,
    trailingStop: config.trailingStop,
    commissionRate: config.commissionRate,
    taxRate: config.taxRate,
  };

  if (config.atrTrailMultiplier !== undefined) {
    options.atrTrailingStop = {
      multiplier: config.atrTrailMultiplier,
      period: config.atrTrailPeriod,
    };
  }

  if (config.partialThreshold !== undefined) {
    options.partialTakeProfit = {
      threshold: config.partialThreshold,
      sellPercent: config.partialSellPercent,
    };
  }

  try {
    const result = TC.TrendCraft.from(filteredCandles)
      .strategy()
      .entry(entryCondition)
      .exit(exitCondition)
      .backtest(options);

    // Compute trade analysis
    const tradeAnalysis = TC.analyzeAllTrades(result.trades);

    return { result, tradeAnalysis };
  } catch (error) {
    console.error("Backtest error:", error);
    return null;
  }
}

/**
 * Hook to manage backtest execution
 */
export function useBacktest(
  candles: NormalizedCandle[],
  config: BacktestConfig,
  setResult: (result: BacktestResult | null) => void,
  setTradeAnalysis: (analysis: TradeAnalysis | null) => void,
  setRunning: (running: boolean) => void,
) {
  const run = useCallback(() => {
    setRunning(true);
    try {
      const execResult = executeBacktest(candles, config);
      if (execResult) {
        setResult(execResult.result);
        setTradeAnalysis(execResult.tradeAnalysis);
      } else {
        setResult(null);
        setTradeAnalysis(null);
      }
    } finally {
      setRunning(false);
    }
  }, [candles, config, setResult, setTradeAnalysis, setRunning]);

  const clear = useCallback(() => {
    setResult(null);
    setTradeAnalysis(null);
  }, [setResult, setTradeAnalysis]);

  // Memoized condition lists
  const entryOptions = useMemo(() => {
    return Object.entries(ENTRY_CONDITIONS).map(([key, value]) => ({
      key,
      label: value.label,
    }));
  }, []);

  const exitOptions = useMemo(() => {
    return Object.entries(EXIT_CONDITIONS).map(([key, value]) => ({
      key,
      label: value.label,
    }));
  }, []);

  return {
    run,
    clear,
    entryOptions,
    exitOptions,
  };
}
