import * as TrendCraft from "trendcraft";
import type {
  BosValue,
  FractalValue,
  FvgValue,
  HeikinAshiValue,
  LiquiditySweepValue,
  NormalizedCandle,
  OrderBlockValue,
  PatternSignal,
  PivotPointsValue,
  Series,
  SwingPointValue,
  VolumeAnomalyValue,
  VolumeTrendValue,
  ZigzagValue,
} from "trendcraft";
import {
  DEFAULT_INDICATOR_PARAMS,
  type IndicatorParams,
  type IndicatorSnapshot,
  type MarketContext,
} from "../types";

export interface IndicatorData {
  // Moving averages
  sma5?: (number | null)[];
  sma25?: (number | null)[];
  sma75?: (number | null)[];
  ema12?: (number | null)[];
  ema26?: (number | null)[];
  wma?: (number | null)[];
  vwma?: (number | null)[];
  kama?: (number | null)[];
  t3?: (number | null)[];
  hma?: (number | null)[];
  mcginley?: (number | null)[];
  emaRibbonValues?: (number | null)[][]; // array of EMA lines
  emaRibbonPeriods?: number[];

  // Bollinger Bands
  bbUpper?: (number | null)[];
  bbMiddle?: (number | null)[];
  bbLower?: (number | null)[];

  // Keltner Channel
  keltnerUpper?: (number | null)[];
  keltnerMiddle?: (number | null)[];
  keltnerLower?: (number | null)[];

  // Donchian Channel
  donchianUpper?: (number | null)[];
  donchianMiddle?: (number | null)[];
  donchianLower?: (number | null)[];

  // Chandelier Exit
  chandelierLongExit?: (number | null)[];
  chandelierShortExit?: (number | null)[];

  // VWAP
  vwapLine?: (number | null)[];
  vwapUpper?: (number | null)[];
  vwapLower?: (number | null)[];

  // ATR Stops
  atrStopsLong?: (number | null)[];
  atrStopsShort?: (number | null)[];

  // Super Smoother
  superSmootherLine?: (number | null)[];

  // Ichimoku
  ichimokuTenkan?: (number | null)[];
  ichimokuKijun?: (number | null)[];
  ichimokuSenkouA?: (number | null)[];
  ichimokuSenkouB?: (number | null)[];
  ichimokuChikou?: (number | null)[];

  // Supertrend
  supertrendLine?: (number | null)[];
  supertrendDirection?: (number | null)[];

  // Parabolic SAR
  parabolicSar?: (number | null)[];
  parabolicSarDirection?: (number | null)[];

  // RSI
  rsi?: (number | null)[];

  // MACD
  macdLine?: (number | null)[];
  macdSignal?: (number | null)[];
  macdHist?: (number | null)[];

  // Stochastics
  stochK?: (number | null)[];
  stochD?: (number | null)[];

  // Stochastic RSI
  stochRsiK?: (number | null)[];
  stochRsiD?: (number | null)[];

  // DMI/ADX
  dmiPlusDi?: (number | null)[];
  dmiMinusDi?: (number | null)[];
  dmiAdx?: (number | null)[];

  // CCI
  cci?: (number | null)[];

  // ATR
  atr?: (number | null)[];

  // Williams %R
  williams?: (number | null)[];

  // ROC
  rocData?: (number | null)[];

  // Connors RSI
  connorsRsiLine?: (number | null)[];

  // CMO
  cmoData?: (number | null)[];

  // IMI
  imiData?: (number | null)[];

  // TRIX
  trixLine?: (number | null)[];
  trixSignal?: (number | null)[];

  // Aroon
  aroonUp?: (number | null)[];
  aroonDown?: (number | null)[];

  // DPO
  dpoData?: (number | null)[];

  // Hurst
  hurstData?: (number | null)[];

  // ADXR
  adxrData?: (number | null)[];

  // Vortex
  vortexPlus?: (number | null)[];
  vortexMinus?: (number | null)[];

  // Roofing Filter
  roofingFilterData?: (number | null)[];

  // Choppiness Index
  choppinessData?: (number | null)[];

  // Volatility Regime (HMM)
  volatilityRegimeData?: { regime: number; label: string }[];

  // OBV
  obv?: (number | null)[];

  // MFI
  mfi?: (number | null)[];

  // CMF
  cmfData?: (number | null)[];

  // ADL
  adlData?: (number | null)[];

  // Klinger
  klingerLine?: (number | null)[];
  klingerSignal?: (number | null)[];

  // Elder Force Index
  elderForceData?: (number | null)[];

  // Volume Anomaly
  volumeAnomalyData?: VolumeAnomalyValue[];

  // Volume Profile
  volumeProfileData?: { poc: number; vah: number; val: number };
  volumeProfilePocLine?: (number | null)[];

  // Volume Trend
  volumeTrendData?: VolumeTrendValue[];

  // Price overlays
  swingPointData?: SwingPointValue[];
  pivotData?: PivotPointsValue[];
  fibRetracementData?: { levels: Record<string, number> | null }[];
  fibExtensionData?: { levels: Record<string, number> | null }[];
  highestLine?: (number | null)[];
  lowestLine?: (number | null)[];
  autoTrendResistance?: (number | null)[];
  autoTrendSupport?: (number | null)[];
  channelUpper?: (number | null)[];
  channelMiddle?: (number | null)[];
  channelLower?: (number | null)[];
  pitchforkMedian?: (number | null)[];
  pitchforkUpper?: (number | null)[];
  pitchforkLower?: (number | null)[];
  heikinAshiData?: HeikinAshiValue[];

  // Patterns
  fractalData?: FractalValue[];
  zigzagData?: ZigzagValue[];

  // SMC
  orderBlockData?: OrderBlockValue[];
  liquiditySweepData?: LiquiditySweepValue[];
  fvgData?: FvgValue[];
  bosData?: BosValue[];
  chochData?: BosValue[];

  // Price Patterns
  detectedPatterns?: PatternSignal[];
}

// Helper to extract values from Series
function extractValues<T>(series: Series<T>): T[] {
  return series.map((item) => item.value);
}

export function calculateIndicators(
  candles: NormalizedCandle[],
  enabledIndicators: string[],
  params: IndicatorParams = DEFAULT_INDICATOR_PARAMS,
): IndicatorData {
  const result: IndicatorData = {};

  // Merge with defaults
  const p = { ...DEFAULT_INDICATOR_PARAMS, ...params } as Required<IndicatorParams>;

  // Helper to calculate and store simple moving average indicators
  const calculateSma = (
    key: "sma5" | "sma25" | "sma75",
    periodKey: "sma5Period" | "sma25Period" | "sma75Period",
  ): void => {
    if (enabledIndicators.includes(key)) {
      result[key] = extractValues(TrendCraft.sma(candles, { period: p[periodKey] }));
    }
  };

  // Helper to calculate and store exponential moving average indicators
  const calculateEma = (key: "ema12" | "ema26", periodKey: "ema12Period" | "ema26Period"): void => {
    if (enabledIndicators.includes(key)) {
      result[key] = extractValues(TrendCraft.ema(candles, { period: p[periodKey] }));
    }
  };

  // ========== Trend ==========

  calculateSma("sma5", "sma5Period");
  calculateSma("sma25", "sma25Period");
  calculateSma("sma75", "sma75Period");
  calculateEma("ema12", "ema12Period");
  calculateEma("ema26", "ema26Period");

  if (enabledIndicators.includes("wma")) {
    result.wma = extractValues(TrendCraft.wma(candles, { period: p.wmaPeriod }));
  }

  if (enabledIndicators.includes("vwma")) {
    result.vwma = extractValues(TrendCraft.vwma(candles, { period: p.vwmaPeriod }));
  }

  if (enabledIndicators.includes("kama")) {
    result.kama = extractValues(TrendCraft.kama(candles, { period: p.kamaPeriod }));
  }

  if (enabledIndicators.includes("t3")) {
    result.t3 = extractValues(TrendCraft.t3(candles, { period: p.t3Period, vFactor: p.t3VFactor }));
  }

  if (enabledIndicators.includes("hma")) {
    result.hma = extractValues(TrendCraft.hma(candles, { period: p.hmaPeriod }));
  }

  if (enabledIndicators.includes("mcginley")) {
    result.mcginley = extractValues(
      TrendCraft.mcginleyDynamic(candles, { period: p.mcginleyPeriod }),
    );
  }

  if (enabledIndicators.includes("emaRibbon")) {
    const periods = (p.emaRibbonPeriods as string)
      .split(",")
      .map((s: string) => Number.parseInt(s.trim(), 10))
      .filter((n: number) => !Number.isNaN(n) && n > 0);
    const series = TrendCraft.emaRibbon(candles, { periods });
    result.emaRibbonPeriods = periods;
    // Extract each EMA line from the ribbon values
    result.emaRibbonValues = periods.map((_, idx) =>
      series.map((item) => item.value?.values?.[idx] ?? null),
    );
  }

  if (enabledIndicators.includes("ichimoku")) {
    const series = TrendCraft.ichimoku(candles);
    result.ichimokuTenkan = series.map((item) => item.value?.tenkan ?? null);
    result.ichimokuKijun = series.map((item) => item.value?.kijun ?? null);
    result.ichimokuSenkouA = series.map((item) => item.value?.senkouA ?? null);
    result.ichimokuSenkouB = series.map((item) => item.value?.senkouB ?? null);
    result.ichimokuChikou = series.map((item) => item.value?.chikou ?? null);
  }

  if (enabledIndicators.includes("supertrend")) {
    const series = TrendCraft.supertrend(candles, {
      period: p.supertrendPeriod,
      multiplier: p.supertrendMultiplier,
    });
    result.supertrendLine = series.map((item) => item.value?.supertrend ?? null);
    result.supertrendDirection = series.map((item) => item.value?.direction ?? null);
  }

  if (enabledIndicators.includes("parabolicSar")) {
    const series = TrendCraft.parabolicSar(candles);
    result.parabolicSar = series.map((item) => item.value?.sar ?? null);
    result.parabolicSarDirection = series.map((item) => item.value?.direction ?? null);
  }

  // ========== Volatility ==========

  if (enabledIndicators.includes("bb")) {
    const series = TrendCraft.bollingerBands(candles, {
      period: p.bbPeriod,
      stdDev: p.bbStdDev,
    });
    result.bbUpper = series.map((item) => item.value?.upper ?? null);
    result.bbMiddle = series.map((item) => item.value?.middle ?? null);
    result.bbLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("keltner")) {
    const series = TrendCraft.keltnerChannel(candles, {
      emaPeriod: p.keltnerEmaPeriod,
      atrPeriod: p.keltnerAtrPeriod,
      multiplier: p.keltnerMultiplier,
    });
    result.keltnerUpper = series.map((item) => item.value?.upper ?? null);
    result.keltnerMiddle = series.map((item) => item.value?.middle ?? null);
    result.keltnerLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("donchian")) {
    const series = TrendCraft.donchianChannel(candles, { period: p.donchianPeriod });
    result.donchianUpper = series.map((item) => item.value?.upper ?? null);
    result.donchianMiddle = series.map((item) => item.value?.middle ?? null);
    result.donchianLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("chandelierExit")) {
    const series = TrendCraft.chandelierExit(candles, {
      period: p.chandelierPeriod,
      multiplier: p.chandelierMultiplier,
    });
    result.chandelierLongExit = series.map((item) => item.value?.longExit ?? null);
    result.chandelierShortExit = series.map((item) => item.value?.shortExit ?? null);
  }

  if (enabledIndicators.includes("vwap")) {
    const options: { period?: number } = {};
    if (p.vwapPeriod > 0) options.period = p.vwapPeriod;
    const series = TrendCraft.vwap(candles, options);
    result.vwapLine = series.map((item) => item.value?.vwap ?? null);
    result.vwapUpper = series.map((item) => item.value?.upper ?? null);
    result.vwapLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("atrStops")) {
    const series = TrendCraft.atrStops(candles, {
      period: p.atrStopsPeriod,
      stopMultiplier: p.atrStopsMultiplier,
    });
    result.atrStopsLong = series.map((item) => item.value?.longStopLevel ?? null);
    result.atrStopsShort = series.map((item) => item.value?.shortStopLevel ?? null);
  }

  if (enabledIndicators.includes("superSmoother")) {
    result.superSmootherLine = extractValues(
      TrendCraft.superSmoother(candles, { period: p.superSmootherPeriod }),
    );
  }

  if (enabledIndicators.includes("atr")) {
    const series = TrendCraft.atr(candles, { period: p.atrPeriod });
    result.atr = extractValues(series);
  }

  if (enabledIndicators.includes("choppiness")) {
    result.choppinessData = extractValues(
      TrendCraft.choppinessIndex(candles, { period: p.choppinessPeriod }),
    );
  }

  if (enabledIndicators.includes("volatilityRegime")) {
    try {
      const series = TrendCraft.hmmRegimes(candles, { numStates: p.hmmNumStates });
      result.volatilityRegimeData = series.map((item) => ({
        regime: item.value?.regime ?? 0,
        label: item.value?.label ?? "",
      }));
    } catch {
      // HMM may fail with insufficient data
    }
  }

  // ========== Momentum ==========

  if (enabledIndicators.includes("rsi")) {
    const series = TrendCraft.rsi(candles, { period: p.rsiPeriod });
    result.rsi = extractValues(series);
  }

  if (enabledIndicators.includes("macd")) {
    const series = TrendCraft.macd(candles, {
      fastPeriod: p.macdFastPeriod,
      slowPeriod: p.macdSlowPeriod,
      signalPeriod: p.macdSignalPeriod,
    });
    result.macdLine = series.map((item) => item.value?.macd ?? null);
    result.macdSignal = series.map((item) => item.value?.signal ?? null);
    result.macdHist = series.map((item) => item.value?.histogram ?? null);
  }

  if (enabledIndicators.includes("stochastics")) {
    const series = TrendCraft.stochastics(candles, {
      kPeriod: p.stochKPeriod,
      dPeriod: p.stochDPeriod,
    });
    result.stochK = series.map((item) => item.value?.k ?? null);
    result.stochD = series.map((item) => item.value?.d ?? null);
  }

  if (enabledIndicators.includes("stochRsi")) {
    const series = TrendCraft.stochRsi(candles, {
      rsiPeriod: p.stochRsiRsiPeriod,
      stochPeriod: p.stochRsiStochPeriod,
      kPeriod: p.stochRsiKPeriod,
      dPeriod: p.stochRsiDPeriod,
    });
    result.stochRsiK = series.map((item) => item.value?.k ?? null);
    result.stochRsiD = series.map((item) => item.value?.d ?? null);
  }

  if (enabledIndicators.includes("dmi")) {
    const series = TrendCraft.dmi(candles, { period: p.dmiPeriod });
    result.dmiPlusDi = series.map((item) => item.value?.plusDi ?? null);
    result.dmiMinusDi = series.map((item) => item.value?.minusDi ?? null);
    result.dmiAdx = series.map((item) => item.value?.adx ?? null);
  }

  if (enabledIndicators.includes("cci")) {
    const series = TrendCraft.cci(candles, { period: p.cciPeriod });
    result.cci = extractValues(series);
  }

  if (enabledIndicators.includes("williams")) {
    result.williams = extractValues(TrendCraft.williamsR(candles, { period: p.williamsPeriod }));
  }

  if (enabledIndicators.includes("roc")) {
    result.rocData = extractValues(TrendCraft.roc(candles, { period: p.rocPeriod }));
  }

  if (enabledIndicators.includes("connorsRsi")) {
    const series = TrendCraft.connorsRsi(candles, {
      rsiPeriod: p.connorsRsiPeriod,
      streakPeriod: p.connorsStreakPeriod,
      rocPeriod: p.connorsRocPeriod,
    });
    result.connorsRsiLine = series.map((item) => item.value?.crsi ?? null);
  }

  if (enabledIndicators.includes("cmo")) {
    result.cmoData = extractValues(TrendCraft.cmo(candles, { period: p.cmoPeriod }));
  }

  if (enabledIndicators.includes("imi")) {
    result.imiData = extractValues(TrendCraft.imi(candles, { period: p.imiPeriod }));
  }

  if (enabledIndicators.includes("trix")) {
    const series = TrendCraft.trix(candles, {
      period: p.trixPeriod,
      signalPeriod: p.trixSignalPeriod,
    });
    result.trixLine = series.map((item) => item.value?.trix ?? null);
    result.trixSignal = series.map((item) => item.value?.signal ?? null);
  }

  if (enabledIndicators.includes("aroon")) {
    const series = TrendCraft.aroon(candles, { period: p.aroonPeriod });
    result.aroonUp = series.map((item) => item.value?.up ?? null);
    result.aroonDown = series.map((item) => item.value?.down ?? null);
  }

  if (enabledIndicators.includes("dpo")) {
    result.dpoData = extractValues(TrendCraft.dpo(candles, { period: p.dpoPeriod }));
  }

  if (enabledIndicators.includes("hurst")) {
    result.hurstData = extractValues(
      TrendCraft.hurst(candles, { minWindow: p.hurstMinWindow, maxWindow: p.hurstMaxWindow }),
    );
  }

  if (enabledIndicators.includes("adxr")) {
    result.adxrData = extractValues(TrendCraft.adxr(candles, { period: p.adxrPeriod }));
  }

  if (enabledIndicators.includes("vortex")) {
    const series = TrendCraft.vortex(candles, { period: p.vortexPeriod });
    result.vortexPlus = series.map((item) => item.value?.viPlus ?? null);
    result.vortexMinus = series.map((item) => item.value?.viMinus ?? null);
  }

  // ========== Filter ==========

  if (enabledIndicators.includes("roofingFilter")) {
    result.roofingFilterData = extractValues(
      TrendCraft.roofingFilter(candles, {
        highPassPeriod: p.roofingHighPassPeriod,
        lowPassPeriod: p.roofingLowPassPeriod,
      }),
    );
  }

  // ========== Volume ==========

  if (enabledIndicators.includes("obv")) {
    const series = TrendCraft.obv(candles);
    result.obv = extractValues(series);
  }

  if (enabledIndicators.includes("mfi")) {
    const series = TrendCraft.mfi(candles, { period: p.mfiPeriod });
    result.mfi = extractValues(series);
  }

  if (enabledIndicators.includes("cmf")) {
    result.cmfData = extractValues(TrendCraft.cmf(candles, { period: p.cmfPeriod }));
  }

  if (enabledIndicators.includes("adl")) {
    result.adlData = extractValues(TrendCraft.adl(candles));
  }

  if (enabledIndicators.includes("klinger")) {
    const series = TrendCraft.klinger(candles, {
      shortPeriod: p.klingerShortPeriod,
      longPeriod: p.klingerLongPeriod,
      signalPeriod: p.klingerSignalPeriod,
    });
    result.klingerLine = series.map((item) => item.value?.kvo ?? null);
    result.klingerSignal = series.map((item) => item.value?.signal ?? null);
  }

  if (enabledIndicators.includes("elderForce")) {
    result.elderForceData = extractValues(
      TrendCraft.elderForceIndex(candles, { period: p.elderForcePeriod }),
    );
  }

  if (enabledIndicators.includes("volumeAnomaly")) {
    const series = TrendCraft.volumeAnomaly(candles, {
      period: p.volumeAnomalyPeriod,
      highThreshold: p.volumeAnomalyThreshold,
    });
    result.volumeAnomalyData = extractValues(series);
  }

  if (enabledIndicators.includes("volumeProfile")) {
    try {
      const vp = TrendCraft.volumeProfile(candles, {
        levels: p.volumeProfileLevels,
        period: p.volumeProfilePeriod,
      });
      result.volumeProfileData = { poc: vp.poc, vah: vp.vah, val: vp.val };
      // Create a constant line for POC reference
      result.volumeProfilePocLine = new Array(candles.length).fill(null);
    } catch {
      // Volume profile may fail with too few candles
    }
  }

  if (enabledIndicators.includes("volumeTrend")) {
    const series = TrendCraft.volumeTrend(candles, {
      pricePeriod: p.volumeTrendPricePeriod,
      volumePeriod: p.volumeTrendVolumePeriod,
    });
    result.volumeTrendData = extractValues(series);
  }

  // ========== Price Overlays ==========

  if (enabledIndicators.includes("swingPoints")) {
    const series = TrendCraft.swingPoints(candles, {
      leftBars: p.swingLeftBars,
      rightBars: p.swingRightBars,
    });
    result.swingPointData = extractValues(series);
  }

  if (enabledIndicators.includes("pivotPoints")) {
    const series = TrendCraft.pivotPoints(candles, {
      method:
        (p.pivotMethod as "standard" | "fibonacci" | "woodie" | "camarilla" | "demark") ||
        "standard",
    });
    result.pivotData = extractValues(series);
  }

  if (enabledIndicators.includes("fibonacci")) {
    const series = TrendCraft.fibonacciRetracement(candles);
    result.fibRetracementData = series.map((item) => ({
      levels: item.value?.levels ?? null,
    }));
  }

  if (enabledIndicators.includes("fibExtension")) {
    const series = TrendCraft.fibonacciExtension(candles);
    result.fibExtensionData = series.map((item) => ({
      levels: item.value?.levels ?? null,
    }));
  }

  if (enabledIndicators.includes("highestLowest")) {
    const series = TrendCraft.highestLowest(candles, { period: p.highestLowestPeriod });
    result.highestLine = series.map((item) => item.value?.highest ?? null);
    result.lowestLine = series.map((item) => item.value?.lowest ?? null);
  }

  if (enabledIndicators.includes("autoTrendLine")) {
    const series = TrendCraft.autoTrendLine(candles);
    result.autoTrendResistance = series.map((item) => item.value?.resistance ?? null);
    result.autoTrendSupport = series.map((item) => item.value?.support ?? null);
  }

  if (enabledIndicators.includes("channelLine")) {
    const series = TrendCraft.channelLine(candles);
    result.channelUpper = series.map((item) => item.value?.upper ?? null);
    result.channelMiddle = series.map((item) => item.value?.middle ?? null);
    result.channelLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("andrewsPitchfork")) {
    const series = TrendCraft.andrewsPitchfork(candles);
    result.pitchforkMedian = series.map((item) => item.value?.median ?? null);
    result.pitchforkUpper = series.map((item) => item.value?.upper ?? null);
    result.pitchforkLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("heikinAshi")) {
    const series = TrendCraft.heikinAshi(candles);
    result.heikinAshiData = extractValues(series);
  }

  // ========== Patterns ==========

  if (enabledIndicators.includes("fractals")) {
    const series = TrendCraft.fractals(candles, { period: p.fractalPeriod });
    result.fractalData = extractValues(series);
  }

  if (enabledIndicators.includes("zigzag")) {
    const series = TrendCraft.zigzag(candles, { deviation: p.zigzagDeviation });
    result.zigzagData = extractValues(series);
  }

  // ========== SMC ==========

  if (enabledIndicators.includes("orderBlock")) {
    const series = TrendCraft.orderBlock(candles, {
      swingPeriod: p.obSwingPeriod,
      minVolumeRatio: p.obMinVolumeRatio,
      maxActiveOBs: p.obMaxActiveOBs,
    });
    result.orderBlockData = series.map((item) => item.value);
  }

  if (enabledIndicators.includes("liquiditySweep")) {
    const series = TrendCraft.liquiditySweep(candles, {
      swingPeriod: p.lsSwingPeriod,
      maxRecoveryBars: p.lsMaxRecoveryBars,
      minSweepDepth: p.lsMinSweepDepth,
    });
    result.liquiditySweepData = series.map((item) => item.value);
  }

  if (enabledIndicators.includes("fvg")) {
    const series = TrendCraft.fairValueGap(candles, {
      minGapPercent: p.fvgMinGapPercent,
    });
    result.fvgData = extractValues(series);
  }

  if (enabledIndicators.includes("bos")) {
    const series = TrendCraft.breakOfStructure(candles, {
      swingPeriod: p.bosSwingPeriod,
    });
    result.bosData = extractValues(series);
  }

  if (enabledIndicators.includes("choch")) {
    const series = TrendCraft.changeOfCharacter(candles, {
      swingPeriod: p.bosSwingPeriod,
    });
    result.chochData = extractValues(series);
  }

  // ========== Pattern Recognition ==========

  const patterns: PatternSignal[] = [];

  if (enabledIndicators.includes("doubleTopBottom")) {
    const strictMode = Boolean(p.dtStrictMode);

    const tops = TrendCraft.doubleTop(candles, {
      tolerance: p.dtTolerance,
      minDistance: p.dtMinDistance,
      maxDistance: p.dtMaxDistance,
      minMiddleDepth: p.dtMinMiddleDepth,
      swingLookback: p.dtSwingLookback,
      maxBreakoutDistance: p.dtMaxBreakoutDistance,
      validateNecklineViolation: p.dtValidateNecklineViolation,
      necklineViolationTolerance: p.dtNecklineViolationTolerance,
      strictMode,
    });
    const bottoms = TrendCraft.doubleBottom(candles, {
      tolerance: p.dtTolerance,
      minDistance: p.dtMinDistance,
      maxDistance: p.dtMaxDistance,
      minMiddleDepth: p.dtMinMiddleDepth,
      swingLookback: p.dtSwingLookback,
      maxBreakoutDistance: p.dtMaxBreakoutDistance,
      validateNecklineViolation: p.dtValidateNecklineViolation,
      necklineViolationTolerance: p.dtNecklineViolationTolerance,
      strictMode,
    });
    patterns.push(...tops, ...bottoms);
  }

  if (enabledIndicators.includes("headShoulders")) {
    const hs = TrendCraft.headAndShoulders(candles, {
      shoulderTolerance: p.hsShoulderTolerance,
      maxNecklineSlope: p.hsMaxNecklineSlope,
    });
    const ihs = TrendCraft.inverseHeadAndShoulders(candles, {
      shoulderTolerance: p.hsShoulderTolerance,
      maxNecklineSlope: p.hsMaxNecklineSlope,
    });
    patterns.push(...hs, ...ihs);
  }

  if (enabledIndicators.includes("cupHandle")) {
    const cups = TrendCraft.cupWithHandle(candles, {
      minCupDepth: p.chMinCupDepth,
      maxCupDepth: p.chMaxCupDepth,
      minCupLength: p.chMinCupLength,
    });
    patterns.push(...cups);
  }

  if (patterns.length > 0) {
    result.detectedPatterns = patterns;
  }

  return result;
}

/**
 * Get indicator value snapshot at a specific index
 */
export function getIndicatorSnapshot(
  indicatorData: IndicatorData,
  index: number,
): IndicatorSnapshot {
  return {
    sma5: indicatorData.sma5?.[index] ?? null,
    sma25: indicatorData.sma25?.[index] ?? null,
    sma75: indicatorData.sma75?.[index] ?? null,
    ema12: indicatorData.ema12?.[index] ?? null,
    ema26: indicatorData.ema26?.[index] ?? null,
    rsi: indicatorData.rsi?.[index] ?? null,
    macdLine: indicatorData.macdLine?.[index] ?? null,
    macdSignal: indicatorData.macdSignal?.[index] ?? null,
    macdHist: indicatorData.macdHist?.[index] ?? null,
    bbUpper: indicatorData.bbUpper?.[index] ?? null,
    bbMiddle: indicatorData.bbMiddle?.[index] ?? null,
    bbLower: indicatorData.bbLower?.[index] ?? null,
    atr: indicatorData.atr?.[index] ?? null,
    stochK: indicatorData.stochK?.[index] ?? null,
    stochD: indicatorData.stochD?.[index] ?? null,
    dmiPlusDi: indicatorData.dmiPlusDi?.[index] ?? null,
    dmiMinusDi: indicatorData.dmiMinusDi?.[index] ?? null,
    dmiAdx: indicatorData.dmiAdx?.[index] ?? null,
  };
}

/**
 * Analyze market context (chart pattern and trend state)
 */
export function analyzeMarketContext(
  candles: NormalizedCandle[],
  index: number,
  indicatorData: IndicatorData,
): MarketContext {
  const currentCandle = candles[index];
  const price = currentCandle.close;

  const sma25 = indicatorData.sma25?.[index];
  const sma75 = indicatorData.sma75?.[index];
  const rsi = indicatorData.rsi?.[index];
  const macdHist = indicatorData.macdHist?.[index];
  const bbUpper = indicatorData.bbUpper?.[index];
  const bbLower = indicatorData.bbLower?.[index];
  const bbMiddle = indicatorData.bbMiddle?.[index];

  let priceVsSma25: "above" | "below" | "at" = "at";
  if (sma25 != null) {
    const diff = ((price - sma25) / sma25) * 100;
    if (diff > 0.5) priceVsSma25 = "above";
    else if (diff < -0.5) priceVsSma25 = "below";
  }

  let priceVsSma75: "above" | "below" | "at" = "at";
  if (sma75 != null) {
    const diff = ((price - sma75) / sma75) * 100;
    if (diff > 0.5) priceVsSma75 = "above";
    else if (diff < -0.5) priceVsSma75 = "below";
  }

  let sma25VsSma75: "golden_cross" | "death_cross" | "above" | "below" = "above";
  if (sma25 != null && sma75 != null) {
    const prevSma25 = indicatorData.sma25?.[index - 1];
    const prevSma75 = indicatorData.sma75?.[index - 1];

    if (prevSma25 != null && prevSma75 != null) {
      if (prevSma25 < prevSma75 && sma25 > sma75) {
        sma25VsSma75 = "golden_cross";
      } else if (prevSma25 > prevSma75 && sma25 < sma75) {
        sma25VsSma75 = "death_cross";
      } else {
        sma25VsSma75 = sma25 > sma75 ? "above" : "below";
      }
    } else {
      sma25VsSma75 = sma25 > sma75 ? "above" : "below";
    }
  }

  const adx = indicatorData.dmiAdx?.[index];

  let trend: "uptrend" | "downtrend" | "range" = "range";
  let trendStrength: "strong" | "moderate" | "weak" = "weak";

  if (indicatorData.sma25 && index >= 5) {
    const recentSma25 = indicatorData.sma25
      .slice(index - 5, index + 1)
      .filter((v): v is number => v != null);
    if (recentSma25.length >= 5) {
      const slope = ((recentSma25[recentSma25.length - 1] - recentSma25[0]) / recentSma25[0]) * 100;

      if (slope > 2) {
        trend = "uptrend";
        trendStrength = slope > 5 ? "strong" : "moderate";
      } else if (slope < -2) {
        trend = "downtrend";
        trendStrength = slope < -5 ? "strong" : "moderate";
      } else {
        trend = "range";
        trendStrength = "weak";
      }
    }
  }

  const regimeMap: Record<typeof trend, "TREND_UP" | "TREND_DOWN" | "RANGE"> = {
    uptrend: "TREND_UP",
    downtrend: "TREND_DOWN",
    range: "RANGE",
  };
  const regime = regimeMap[trend];

  const strengthConfidence: Record<typeof trendStrength, number> = {
    strong: 0.8,
    moderate: 0.5,
    weak: 0.3,
  };
  const confidence = adx != null ? Math.min(adx / 50, 1) : strengthConfidence[trendStrength];

  let rsiZone: "overbought" | "oversold" | "neutral" | undefined;
  if (rsi != null) {
    if (rsi >= 70) rsiZone = "overbought";
    else if (rsi <= 30) rsiZone = "oversold";
    else rsiZone = "neutral";
  }

  let macdSignal: "bullish" | "bearish" | "neutral" | undefined;
  if (macdHist != null) {
    const prevMacdHist = indicatorData.macdHist?.[index - 1];
    if (prevMacdHist != null) {
      if (macdHist > 0 && macdHist > prevMacdHist) macdSignal = "bullish";
      else if (macdHist < 0 && macdHist < prevMacdHist) macdSignal = "bearish";
      else macdSignal = "neutral";
    }
  }

  let bbPosition: "upper" | "middle" | "lower" | undefined;
  if (bbUpper != null && bbLower != null && bbMiddle != null) {
    const totalRange = bbUpper - bbLower;

    if (totalRange > 0) {
      const position = (price - bbLower) / totalRange;
      if (position >= 0.8) bbPosition = "upper";
      else if (position <= 0.2) bbPosition = "lower";
      else bbPosition = "middle";
    }
  }

  const descParts: string[] = [];

  const trendLabel = {
    uptrend: "Uptrend",
    downtrend: "Downtrend",
    range: "Range",
  }[trend];
  const strengthLabel = {
    strong: "Strong ",
    moderate: "Moderate ",
    weak: "",
  }[trendStrength];
  descParts.push(`${strengthLabel}${trendLabel}`);

  if (sma25VsSma75 === "golden_cross") {
    descParts.push("Golden cross");
  } else if (sma25VsSma75 === "death_cross") {
    descParts.push("Death cross");
  } else if (sma25 != null && sma75 != null) {
    descParts.push(sma25 > sma75 ? "MA25>MA75" : "MA25<MA75");
  }

  if (priceVsSma25 !== "at") {
    descParts.push(`Price ${priceVsSma25 === "above" ? "above" : "below"} MA25`);
  }

  if (rsiZone === "overbought") {
    descParts.push("RSI overbought");
  } else if (rsiZone === "oversold") {
    descParts.push("RSI oversold");
  }

  if (bbPosition === "upper") {
    descParts.push("Near BB upper");
  } else if (bbPosition === "lower") {
    descParts.push("Near BB lower");
  }

  return {
    trend,
    trendStrength,
    regime,
    confidence,
    priceVsSma25,
    priceVsSma75,
    sma25VsSma75,
    rsiZone,
    macdSignal,
    bbPosition,
    description: descParts.join(", "),
  };
}
