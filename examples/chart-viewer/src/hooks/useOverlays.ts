/**
 * Hook for calculating overlay indicators (displayed on main chart)
 */

import { useMemo } from "react";
import type {
  AndrewsPitchforkValue,
  AtrStopsValue,
  AutoTrendLineValue,
  BollingerBandsValue,
  BosValue,
  CandlestickPatternValue,
  ChandelierExitValue,
  ChannelLineValue,
  DonchianValue,
  FibonacciExtensionValue,
  FibonacciRetracementValue,
  FvgValue,
  HeikinAshiValue,
  HighestLowestValue,
  IchimokuValue,
  KeltnerChannelValue,
  LiquiditySweepValue,
  NormalizedCandle,
  OrderBlockValue,
  ParabolicSarValue,
  PivotPointsValue,
  SupertrendValue,
  SwingPointValue,
  VwapValue,
} from "trendcraft";
import {
  andrewsPitchfork,
  atrStops,
  autoTrendLine,
  bollingerBands,
  breakOfStructure,
  candlestickPatterns,
  chandelierExit,
  changeOfCharacter,
  channelLine,
  donchianChannel,
  ema,
  fairValueGap,
  fibonacciExtension,
  fibonacciRetracement,
  heikinAshi,
  highestLowest,
  ichimoku,
  keltnerChannel,
  liquiditySweep,
  orderBlock,
  parabolicSar,
  pivotPoints,
  sma,
  superSmoother,
  supertrend,
  swingPoints,
  vwap,
  vwma,
  wma,
} from "trendcraft";
import { useChartStore } from "../store/chartStore";
import type { OverlayType } from "../types";

/**
 * Overlay indicator data structure
 */
export interface OverlayData {
  // Moving Averages
  sma5?: (number | null)[];
  sma25?: (number | null)[];
  sma75?: (number | null)[];
  ema12?: (number | null)[];
  ema26?: (number | null)[];
  wma20?: (number | null)[];
  // Bands/Channels
  bb?: BollingerBandsValue[];
  donchian?: DonchianValue[];
  keltner?: KeltnerChannelValue[];
  // Trend
  ichimoku?: IchimokuValue[];
  supertrend?: SupertrendValue[];
  psar?: ParabolicSarValue[];
  // VWAP
  vwap?: VwapValue[];
  // Swing Points
  swingPoints?: SwingPointValue[];
  // Pivot Points
  pivotPoints?: PivotPointsValue[];
  // SMC
  orderBlock?: OrderBlockValue[];
  fvg?: FvgValue[];
  bos?: BosValue[];
  choch?: BosValue[];
  liquiditySweep?: LiquiditySweepValue[];
  // Highest/Lowest Channel
  highestLowest?: HighestLowestValue[];
  // Volatility
  chandelierExit?: ChandelierExitValue[];
  atrStops?: AtrStopsValue[];
  // Fibonacci Retracement
  fibonacci?: FibonacciRetracementValue[];
  // Auto Trend Line
  autoTrendLine?: AutoTrendLineValue[];
  // Channel Line
  channelLine?: ChannelLineValue[];
  // Fibonacci Extension
  fibExtension?: FibonacciExtensionValue[];
  // Andrew's Pitchfork
  andrewsPitchfork?: AndrewsPitchforkValue[];
  // VWMA
  vwma20?: (number | null)[];
  // Ehlers Filter
  superSmoother?: (number | null)[];
  // Heikin-Ashi
  heikinAshi?: HeikinAshiValue[];
  // Candlestick Patterns
  candlestickPatterns?: CandlestickPatternValue[];
}

/**
 * Calculate overlay indicators based on candles and enabled overlays
 */
export function useOverlays(
  candles: NormalizedCandle[],
  enabledOverlays: OverlayType[],
): OverlayData {
  const indicatorParams = useChartStore((s) => s.indicatorParams);

  return useMemo(() => {
    if (candles.length === 0) {
      return {};
    }

    const data: OverlayData = {};
    const p = indicatorParams;

    // SMA 5
    if (enabledOverlays.includes("sma5")) {
      const series = sma(candles, { period: p.sma5Period });
      data.sma5 = series.map((s) => s.value);
    }

    // SMA 25
    if (enabledOverlays.includes("sma25")) {
      const series = sma(candles, { period: p.sma25Period });
      data.sma25 = series.map((s) => s.value);
    }

    // SMA 75
    if (enabledOverlays.includes("sma75")) {
      const series = sma(candles, { period: p.sma75Period });
      data.sma75 = series.map((s) => s.value);
    }

    // EMA 12
    if (enabledOverlays.includes("ema12")) {
      const series = ema(candles, { period: p.ema12Period });
      data.ema12 = series.map((s) => s.value);
    }

    // EMA 26
    if (enabledOverlays.includes("ema26")) {
      const series = ema(candles, { period: p.ema26Period });
      data.ema26 = series.map((s) => s.value);
    }

    // WMA 20
    if (enabledOverlays.includes("wma20")) {
      const series = wma(candles, { period: p.wma20Period });
      data.wma20 = series.map((s) => s.value);
    }

    // Bollinger Bands
    if (enabledOverlays.includes("bb")) {
      const series = bollingerBands(candles, { period: p.bbPeriod, stdDev: p.bbStdDev });
      data.bb = series.map((s) => s.value);
    }

    // Donchian Channel
    if (enabledOverlays.includes("donchian")) {
      const series = donchianChannel(candles, { period: p.donchianPeriod });
      data.donchian = series.map((s) => s.value);
    }

    // Keltner Channel
    if (enabledOverlays.includes("keltner")) {
      const series = keltnerChannel(candles, {
        emaPeriod: p.keltnerEmaPeriod,
        atrPeriod: p.keltnerAtrPeriod,
        multiplier: p.keltnerMultiplier,
      });
      data.keltner = series.map((s) => s.value);
    }

    // Ichimoku
    if (enabledOverlays.includes("ichimoku")) {
      const series = ichimoku(candles, {
        tenkanPeriod: p.ichimokuTenkan,
        kijunPeriod: p.ichimokuKijun,
        senkouBPeriod: p.ichimokuSenkou,
        displacement: p.ichimokuDisplacement,
      });
      data.ichimoku = series.map((s) => s.value);
    }

    // Supertrend
    if (enabledOverlays.includes("supertrend")) {
      const series = supertrend(candles, {
        period: p.supertrendPeriod,
        multiplier: p.supertrendMultiplier,
      });
      data.supertrend = series.map((s) => s.value);
    }

    // Parabolic SAR
    if (enabledOverlays.includes("psar")) {
      const series = parabolicSar(candles, { step: p.psarStep, max: p.psarMax });
      data.psar = series.map((s) => s.value);
    }

    // VWAP
    if (enabledOverlays.includes("vwap")) {
      const series = vwap(candles, {
        resetPeriod: p.vwapResetPeriod,
        period: p.vwapRollingPeriod,
      });
      data.vwap = series.map((s) => s.value);
    }

    // Swing Points
    if (enabledOverlays.includes("swingPoints")) {
      const series = swingPoints(candles, {
        leftBars: p.swingLeftBars,
        rightBars: p.swingRightBars,
      });
      data.swingPoints = series.map((s) => s.value);
    }

    // Pivot Points
    if (enabledOverlays.includes("pivotPoints")) {
      const methodMap = ["standard", "fibonacci", "woodie", "camarilla", "demark"] as const;
      const series = pivotPoints(candles, {
        method: methodMap[p.pivotPointsMethod],
      });
      data.pivotPoints = series.map((s) => s.value);
    }

    // Order Block
    if (enabledOverlays.includes("orderBlock")) {
      const series = orderBlock(candles, {
        swingPeriod: p.orderBlockSwingPeriod,
        volumePeriod: p.orderBlockVolumePeriod,
        minVolumeRatio: p.orderBlockMinVolumeRatio,
        maxActiveOBs: p.orderBlockMaxActive,
        displacementAtr: p.orderBlockDisplacementAtr,
        maxBarsActive: p.orderBlockMaxBarsActive,
      });
      data.orderBlock = series.map((s) => s.value);
    }

    // Fair Value Gap
    if (enabledOverlays.includes("fvg")) {
      const series = fairValueGap(candles, {
        minGapPercent: p.fvgMinGapPercent,
        maxActiveFvgs: p.fvgMaxActive,
      });
      data.fvg = series.map((s) => s.value);
    }

    // Break of Structure
    if (enabledOverlays.includes("bos")) {
      const series = breakOfStructure(candles, {
        swingPeriod: p.bosSwingPeriod,
      });
      data.bos = series.map((s) => s.value);
    }

    // Change of Character
    if (enabledOverlays.includes("choch")) {
      const series = changeOfCharacter(candles, {
        swingPeriod: p.bosSwingPeriod,
      });
      data.choch = series.map((s) => s.value);
    }

    // Liquidity Sweep
    if (enabledOverlays.includes("liquiditySweep")) {
      const series = liquiditySweep(candles, {
        swingPeriod: p.liquiditySweepSwingPeriod,
        maxRecoveryBars: p.liquiditySweepMaxRecoveryBars,
      });
      data.liquiditySweep = series.map((s) => s.value);
    }

    // Highest/Lowest Channel
    if (enabledOverlays.includes("highestLowest")) {
      const series = highestLowest(candles, {
        period: p.highestLowestPeriod,
      });
      data.highestLowest = series.map((s) => s.value);
    }

    // Chandelier Exit
    if (enabledOverlays.includes("chandelierExit")) {
      const series = chandelierExit(candles, {
        period: p.chandelierPeriod,
        multiplier: p.chandelierMultiplier,
      });
      data.chandelierExit = series.map((s) => s.value);
    }

    // Fibonacci Retracement
    if (enabledOverlays.includes("fibonacci")) {
      const series = fibonacciRetracement(candles, {
        leftBars: p.fibLeftBars,
        rightBars: p.fibRightBars,
      });
      data.fibonacci = series.map((s) => s.value);
    }

    // Auto Trend Line
    if (enabledOverlays.includes("autoTrendLine")) {
      const series = autoTrendLine(candles, {
        leftBars: p.autoTrendLineLeftBars,
        rightBars: p.autoTrendLineRightBars,
      });
      data.autoTrendLine = series.map((s) => s.value);
    }

    // Channel Line
    if (enabledOverlays.includes("channelLine")) {
      const series = channelLine(candles, {
        leftBars: p.channelLineLeftBars,
        rightBars: p.channelLineRightBars,
      });
      data.channelLine = series.map((s) => s.value);
    }

    // Fibonacci Extension
    if (enabledOverlays.includes("fibExtension")) {
      const series = fibonacciExtension(candles, {
        leftBars: p.fibExtLeftBars,
        rightBars: p.fibExtRightBars,
      });
      data.fibExtension = series.map((s) => s.value);
    }

    // Andrew's Pitchfork
    if (enabledOverlays.includes("andrewsPitchfork")) {
      const series = andrewsPitchfork(candles, {
        leftBars: p.pitchforkLeftBars,
        rightBars: p.pitchforkRightBars,
      });
      data.andrewsPitchfork = series.map((s) => s.value);
    }

    // VWMA 20
    if (enabledOverlays.includes("vwma20")) {
      const series = vwma(candles, { period: p.vwma20Period });
      data.vwma20 = series.map((s) => s.value);
    }

    // Super Smoother
    if (enabledOverlays.includes("superSmoother")) {
      const series = superSmoother(candles, { period: p.superSmootherPeriod });
      data.superSmoother = series.map((s) => s.value);
    }

    // Heikin-Ashi
    if (enabledOverlays.includes("heikinAshi")) {
      const series = heikinAshi(candles);
      data.heikinAshi = series.map((s) => s.value);
    }

    // Candlestick Patterns
    if (enabledOverlays.includes("candlestickPatterns")) {
      const series = candlestickPatterns(candles);
      data.candlestickPatterns = series.map((s) => s.value);
    }

    // ATR Stops
    if (enabledOverlays.includes("atrStops")) {
      const series = atrStops(candles, {
        period: p.atrStopsPeriod,
        stopMultiplier: p.atrStopsMultiplier,
        takeProfitMultiplier: p.atrStopsTpMultiplier,
      });
      data.atrStops = series.map((s) => s.value);
    }

    return data;
  }, [candles, enabledOverlays, indicatorParams]);
}
