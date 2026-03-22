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
 * Condition definition with label, factory, and group
 */
type ConditionDef = { label: string; group: string; factory: () => Condition };

/**
 * Entry condition preset definitions
 */
export const ENTRY_CONDITIONS: Record<string, ConditionDef> = {
  // --- Moving Average Cross ---
  gc: {
    label: "Golden Cross (5/25)",
    group: "MA Cross",
    factory: () => TC.goldenCrossCondition(5, 25),
  },
  validatedGc: {
    label: "Validated GC",
    group: "MA Cross",
    factory: () => TC.validatedGoldenCross({ minScore: 50 }),
  },

  // --- RSI ---
  rsi30: { label: "RSI < 30", group: "RSI", factory: () => TC.rsiBelow(30) },
  rsi40: { label: "RSI < 40", group: "RSI", factory: () => TC.rsiBelow(40) },

  // --- MACD ---
  macdUp: { label: "MACD Cross Up", group: "MACD", factory: () => TC.macdCrossUp() },

  // --- Perfect Order ---
  poBullish: {
    label: "PO Bullish (Legacy)",
    group: "Perfect Order",
    factory: () => TC.perfectOrderBullish({ periods: [5, 25, 75] }),
  },
  poPlus: {
    label: "PO+ Entry",
    group: "Perfect Order",
    factory: () => TC.poPlusEntry({ periods: [5, 25, 75] }),
  },
  pb: {
    label: "Pullback Buy",
    group: "Perfect Order",
    factory: () => TC.pbEntry({ periods: [5, 25, 75] }),
  },
  poPlusPb: {
    label: "PO+ or PB",
    group: "Perfect Order",
    factory: () => TC.poPlusPbEntry({ periods: [5, 25, 75] }),
  },
  poRsi: {
    label: "PO+ + RSI<60",
    group: "Perfect Order",
    factory: () => TC.and(TC.poPlusEntry({ periods: [5, 25, 75] }), TC.rsiBelow(60)),
  },
  poActiveBullish: {
    label: "PO Active Bullish",
    group: "Perfect Order",
    factory: () => TC.perfectOrderActiveBullish({ periods: [5, 25, 75] }),
  },
  poBullishConfirmed: {
    label: "PO Bullish Confirmed",
    group: "Perfect Order",
    factory: () => TC.perfectOrderBullishConfirmed({ periods: [5, 25, 75] }),
  },
  poConfFormed: {
    label: "PO Confirmation Formed",
    group: "Perfect Order",
    factory: () => TC.perfectOrderConfirmationFormed({ periods: [5, 25, 75] }),
  },
  poPreBullish: {
    label: "PO Pre-Bullish",
    group: "Perfect Order",
    factory: () => TC.perfectOrderPreBullish({ periods: [5, 25, 75] }),
  },
  poPullback: {
    label: "PO Pullback Entry",
    group: "Perfect Order",
    factory: () => TC.perfectOrderPullbackEntry({ periods: [5, 25, 75] }),
  },

  // --- Bollinger Bands ---
  bbLower: {
    label: "BB Lower Touch",
    group: "Bollinger",
    factory: () => TC.bollingerTouch("lower"),
  },

  // --- Stochastics ---
  stoch20: { label: "Stoch < 20", group: "Stochastics", factory: () => TC.stochBelow(20) },
  stochCrossUp: { label: "Stoch Cross Up", group: "Stochastics", factory: () => TC.stochCrossUp() },
  stochOversoldCross: {
    label: "Stoch Oversold Cross",
    group: "Stochastics",
    factory: () => TC.and(TC.stochBelow(30), TC.stochCrossUp()),
  },

  // --- DMI/ADX ---
  dmiBullish: { label: "DMI Bullish", group: "DMI/ADX", factory: () => TC.dmiBullish(20) },
  dmiBullishStrong: {
    label: "DMI + ADX Strong",
    group: "DMI/ADX",
    factory: () => TC.and(TC.dmiBullish(25), TC.adxStrong(30)),
  },

  // --- Pattern Detection ---
  anyBullish: {
    label: "Any Bullish Pattern",
    group: "Patterns",
    factory: () => TC.anyBullishPattern(),
  },
  doubleBottom: {
    label: "Double Bottom",
    group: "Patterns",
    factory: () => TC.doubleBottomDetected(),
  },
  invHeadShoulders: {
    label: "Inv Head & Shoulders",
    group: "Patterns",
    factory: () => TC.inverseHeadShouldersDetected(),
  },
  cupHandle: { label: "Cup & Handle", group: "Patterns", factory: () => TC.cupHandleDetected() },
  patternHighConf: {
    label: "Pattern (Conf>70)",
    group: "Patterns",
    factory: () => TC.anyPatternConfidenceAbove(70),
  },

  // --- Volume ---
  volAnomaly: {
    label: "Volume Anomaly",
    group: "Volume",
    factory: () => TC.volumeAnomalyCondition(2.0, 20),
  },
  volTrend: { label: "Volume Trend", group: "Volume", factory: () => TC.volumeConfirmsTrend() },
  volExtreme: {
    label: "Volume Extreme (3x)",
    group: "Volume",
    factory: () => TC.volumeExtreme(3.0, 20),
  },
  bullVolDiv: {
    label: "Bullish Vol Divergence",
    group: "Volume",
    factory: () => TC.bullishVolumeDivergence(),
  },
  cmfPositive: { label: "CMF > 0", group: "Volume", factory: () => TC.cmfAbove(0) },
  obvRising: { label: "OBV Rising", group: "Volume", factory: () => TC.obvRising(10) },
  obvCrossUp: { label: "OBV Cross Up", group: "Volume", factory: () => TC.obvCrossUp(10) },

  // --- Volume Profile ---
  nearPoc: { label: "Near POC", group: "Volume Profile", factory: () => TC.nearPoc(0.02, 20) },
  breakoutVah: {
    label: "Breakout VAH",
    group: "Volume Profile",
    factory: () => TC.breakoutVah(20),
  },
  priceAbovePoc: {
    label: "Price Above POC",
    group: "Volume Profile",
    factory: () => TC.priceAbovePoc(20),
  },

  // --- Range-Bound ---
  rbBreakout: { label: "Range Breakout", group: "Range", factory: () => TC.rangeBreakout() },
  notInRange: { label: "Not In Range", group: "Range", factory: () => TC.not(TC.inRangeBound()) },
  rangeConfirmed: { label: "Range Confirmed", group: "Range", factory: () => TC.rangeConfirmed() },
  breakoutRiskUp: { label: "Breakout Risk Up", group: "Range", factory: () => TC.breakoutRiskUp() },
  tightRange: { label: "Tight Range", group: "Range", factory: () => TC.tightRange() },
  rangeScore60: {
    label: "Range Score > 60",
    group: "Range",
    factory: () => TC.rangeScoreAbove(60),
  },

  // --- Volatility Regime ---
  regimeLow: { label: "Low Volatility", group: "Volatility", factory: () => TC.regimeIs("low") },
  regimeNotHigh: {
    label: "Not High Volatility",
    group: "Volatility",
    factory: () => TC.regimeNot("high"),
  },
  volExpanding: {
    label: "Volatility Expanding",
    group: "Volatility",
    factory: () => TC.volatilityExpanding(),
  },
  volContracting: {
    label: "Volatility Contracting",
    group: "Volatility",
    factory: () => TC.volatilityContracting(),
  },
  atrPctlBelow25: {
    label: "ATR Percentile < 25",
    group: "Volatility",
    factory: () => TC.atrPercentileBelow(25),
  },

  // --- SMC (Smart Money Concepts) ---
  bullishOB: {
    label: "Bullish Order Block",
    group: "SMC",
    factory: () => TC.priceAtBullishOrderBlock(),
  },
  bullishSweep: {
    label: "Bullish Liquidity Sweep",
    group: "SMC",
    factory: () => TC.liquiditySweepDetected("bullish"),
  },
  sweepRecovered: {
    label: "Sweep Recovered",
    group: "SMC",
    factory: () => TC.liquiditySweepRecovered(),
  },

  // --- Price ---
  aboveSma200: { label: "Price > SMA200", group: "Price", factory: () => TC.priceAboveSma(200) },
  aboveSma50: { label: "Price > SMA50", group: "Price", factory: () => TC.priceAboveSma(50) },

  // --- Combination Strategies ---
  gcVolume: {
    label: "GC + Volume",
    group: "Combination",
    factory: () => TC.and(TC.goldenCrossCondition(5, 25), TC.volumeAboveAvg(1.5)),
  },
  macdRsi: {
    label: "MACD + RSI<50",
    group: "Combination",
    factory: () => TC.and(TC.macdCrossUp(), TC.rsiBelow(50)),
  },
  gcVolAnomaly: {
    label: "GC + Vol Anomaly",
    group: "Combination",
    factory: () => TC.and(TC.goldenCrossCondition(5, 25), TC.volumeAnomalyCondition(2.0, 20)),
  },
  atrGc: {
    label: "ATR% + GC",
    group: "Combination",
    factory: () => TC.and(TC.atrPercentAbove(2.3), TC.goldenCrossCondition(5, 25)),
  },
};

/**
 * Exit condition preset definitions
 */
export const EXIT_CONDITIONS: Record<string, ConditionDef> = {
  // --- MA Cross ---
  dc: {
    label: "Dead Cross (5/25)",
    group: "MA Cross",
    factory: () => TC.deadCrossCondition(5, 25),
  },
  validatedDc: {
    label: "Validated DC",
    group: "MA Cross",
    factory: () => TC.validatedDeadCross({ minScore: 50 }),
  },

  // --- RSI ---
  rsi70: { label: "RSI > 70", group: "RSI", factory: () => TC.rsiAbove(70) },
  rsi60: { label: "RSI > 60", group: "RSI", factory: () => TC.rsiAbove(60) },

  // --- MACD ---
  macdDown: { label: "MACD Cross Down", group: "MACD", factory: () => TC.macdCrossDown() },

  // --- Perfect Order ---
  poCollapsed: {
    label: "PO Collapsed",
    group: "Perfect Order",
    factory: () => TC.perfectOrderCollapsed({ periods: [5, 25, 75] }),
  },
  poBreakdown: {
    label: "PO Breakdown",
    group: "Perfect Order",
    factory: () => TC.perfectOrderBreakdown({ periods: [5, 25, 75] }),
  },
  poActiveBearish: {
    label: "PO Active Bearish",
    group: "Perfect Order",
    factory: () => TC.perfectOrderActiveBearish({ periods: [5, 25, 75] }),
  },
  poBearishConfirmed: {
    label: "PO Bearish Confirmed",
    group: "Perfect Order",
    factory: () => TC.perfectOrderBearishConfirmed({ periods: [5, 25, 75] }),
  },
  poMaCollapsed: {
    label: "PO MA Collapsed",
    group: "Perfect Order",
    factory: () => TC.perfectOrderMaCollapsed({ periods: [5, 25, 75] }),
  },
  poPreBearish: {
    label: "PO Pre-Bearish",
    group: "Perfect Order",
    factory: () => TC.perfectOrderPreBearish({ periods: [5, 25, 75] }),
  },
  poPullbackSell: {
    label: "PO Pullback Sell",
    group: "Perfect Order",
    factory: () => TC.perfectOrderPullbackSellEntry({ periods: [5, 25, 75] }),
  },

  // --- Bollinger Bands ---
  bbUpper: {
    label: "BB Upper Touch",
    group: "Bollinger",
    factory: () => TC.bollingerTouch("upper"),
  },

  // --- Stochastics ---
  stoch80: { label: "Stoch > 80", group: "Stochastics", factory: () => TC.stochAbove(80) },
  stochCrossDown: {
    label: "Stoch Cross Down",
    group: "Stochastics",
    factory: () => TC.stochCrossDown(),
  },
  stochOverboughtCross: {
    label: "Stoch Overbought Cross",
    group: "Stochastics",
    factory: () => TC.and(TC.stochAbove(70), TC.stochCrossDown()),
  },

  // --- DMI/ADX ---
  dmiBearish: { label: "DMI Bearish", group: "DMI/ADX", factory: () => TC.dmiBearish(20) },

  // --- Pattern Detection ---
  anyBearish: {
    label: "Any Bearish Pattern",
    group: "Patterns",
    factory: () => TC.anyBearishPattern(),
  },
  doubleTop: { label: "Double Top", group: "Patterns", factory: () => TC.doubleTopDetected() },
  headShoulders: {
    label: "Head & Shoulders",
    group: "Patterns",
    factory: () => TC.headShouldersDetected(),
  },

  // --- Volume ---
  bearVolDiv: {
    label: "Bearish Vol Divergence",
    group: "Volume",
    factory: () => TC.bearishVolumeDivergence(),
  },
  cmfNegative: { label: "CMF < 0", group: "Volume", factory: () => TC.cmfBelow(0) },
  obvFalling: { label: "OBV Falling", group: "Volume", factory: () => TC.obvFalling(10) },
  obvCrossDown: { label: "OBV Cross Down", group: "Volume", factory: () => TC.obvCrossDown(10) },

  // --- Volume Profile ---
  breakdownVal: {
    label: "Breakdown VAL",
    group: "Volume Profile",
    factory: () => TC.breakdownVal(20),
  },
  priceBelowPoc: {
    label: "Price Below POC",
    group: "Volume Profile",
    factory: () => TC.priceBelowPoc(20),
  },

  // --- Range-Bound ---
  rbForming: { label: "Range Forming", group: "Range", factory: () => TC.rangeForming() },
  inRange: { label: "In Range", group: "Range", factory: () => TC.inRangeBound() },
  breakoutRiskDown: {
    label: "Breakout Risk Down",
    group: "Range",
    factory: () => TC.breakoutRiskDown(),
  },

  // --- Volatility Regime ---
  regimeHigh: { label: "High Volatility", group: "Volatility", factory: () => TC.regimeIs("high") },
  regimeExtreme: {
    label: "Extreme Volatility",
    group: "Volatility",
    factory: () => TC.regimeIs("extreme"),
  },
  volExpandingExit: {
    label: "Volatility Expanding",
    group: "Volatility",
    factory: () => TC.volatilityExpanding(),
  },
  atrPctlAbove75: {
    label: "ATR Percentile > 75",
    group: "Volatility",
    factory: () => TC.atrPercentileAbove(75),
  },

  // --- ATR Stop ---
  atrStop15: {
    label: "ATR Stop 1.5x",
    group: "ATR Stop",
    factory: () => TC.priceDroppedAtr(1.5, 10, 14),
  },
  atrStop20: {
    label: "ATR Stop 2.0x",
    group: "ATR Stop",
    factory: () => TC.priceDroppedAtr(2.0, 10, 14),
  },
  atrStop25: {
    label: "ATR Stop 2.5x",
    group: "ATR Stop",
    factory: () => TC.priceDroppedAtr(2.5, 10, 14),
  },
  atrStop30: {
    label: "ATR Stop 3.0x",
    group: "ATR Stop",
    factory: () => TC.priceDroppedAtr(3.0, 10, 14),
  },

  // --- SMC (Smart Money Concepts) ---
  bearishOB: {
    label: "Bearish Order Block",
    group: "SMC",
    factory: () => TC.priceAtBearishOrderBlock(),
  },
  bearishSweep: {
    label: "Bearish Liquidity Sweep",
    group: "SMC",
    factory: () => TC.liquiditySweepDetected("bearish"),
  },

  // --- Price ---
  belowSma200: { label: "Price < SMA200", group: "Price", factory: () => TC.priceBelowSma(200) },
  belowSma50: { label: "Price < SMA50", group: "Price", factory: () => TC.priceBelowSma(50) },

  // --- Combination ---
  macdVolDiv: {
    label: "MACD + Vol Divergence",
    group: "Combination",
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
  // Expose current condition objects for explainability
  const currentEntryCondition = useMemo(() => {
    const factory = ENTRY_CONDITIONS[config.entryCondition]?.factory;
    return factory ? factory() : null;
  }, [config.entryCondition]);

  const currentExitCondition = useMemo(() => {
    const factory = EXIT_CONDITIONS[config.exitCondition]?.factory;
    return factory ? factory() : null;
  }, [config.exitCondition]);

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
    currentEntryCondition,
    currentExitCondition,
  };
}
