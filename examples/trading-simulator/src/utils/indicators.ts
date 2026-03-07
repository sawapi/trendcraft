import * as TrendCraft from "trendcraft";
import type {
  LiquiditySweepValue,
  NormalizedCandle,
  OrderBlockValue,
  PatternSignal,
  Series,
} from "trendcraft";
import {
  DEFAULT_INDICATOR_PARAMS,
  type IndicatorParams,
  type IndicatorSnapshot,
  type MarketContext,
} from "../types";

export interface IndicatorData {
  // 移動平均
  sma5?: (number | null)[];
  sma25?: (number | null)[];
  sma75?: (number | null)[];
  ema12?: (number | null)[];
  ema26?: (number | null)[];

  // ボリンジャーバンド
  bbUpper?: (number | null)[];
  bbMiddle?: (number | null)[];
  bbLower?: (number | null)[];

  // ケルトナーチャネル
  keltnerUpper?: (number | null)[];
  keltnerMiddle?: (number | null)[];
  keltnerLower?: (number | null)[];

  // ドンチャンチャネル
  donchianUpper?: (number | null)[];
  donchianMiddle?: (number | null)[];
  donchianLower?: (number | null)[];

  // 一目均衡表
  ichimokuTenkan?: (number | null)[];
  ichimokuKijun?: (number | null)[];
  ichimokuSenkouA?: (number | null)[];
  ichimokuSenkouB?: (number | null)[];
  ichimokuChikou?: (number | null)[];

  // Supertrend
  supertrendLine?: (number | null)[];
  supertrendDirection?: (number | null)[]; // 1: up, -1: down

  // Parabolic SAR
  parabolicSar?: (number | null)[];
  parabolicSarDirection?: (number | null)[]; // 1: up, -1: down

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

  // OBV
  obv?: (number | null)[];

  // MFI
  mfi?: (number | null)[];

  // SMC Order Block
  orderBlockData?: OrderBlockValue[];

  // SMC Liquidity Sweep
  liquiditySweepData?: LiquiditySweepValue[];

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
  const p = { ...DEFAULT_INDICATOR_PARAMS, ...params };

  // Helper to calculate and store simple moving average indicators
  const calculateSma = (
    key: "sma5" | "sma25" | "sma75",
    periodKey: "sma5Period" | "sma25Period" | "sma75Period",
  ): void => {
    if (enabledIndicators.includes(key)) {
      result[key] = extractValues(TrendCraft.sma(candles, { period: p[periodKey]! }));
    }
  };

  // Helper to calculate and store exponential moving average indicators
  const calculateEma = (key: "ema12" | "ema26", periodKey: "ema12Period" | "ema26Period"): void => {
    if (enabledIndicators.includes(key)) {
      result[key] = extractValues(TrendCraft.ema(candles, { period: p[periodKey]! }));
    }
  };

  // ========== トレンド系 ==========

  calculateSma("sma5", "sma5Period");
  calculateSma("sma25", "sma25Period");
  calculateSma("sma75", "sma75Period");
  calculateEma("ema12", "ema12Period");
  calculateEma("ema26", "ema26Period");

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
      period: p.supertrendPeriod!,
      multiplier: p.supertrendMultiplier!,
    });
    result.supertrendLine = series.map((item) => item.value?.supertrend ?? null);
    result.supertrendDirection = series.map((item) => item.value?.direction ?? null);
  }

  if (enabledIndicators.includes("parabolicSar")) {
    const series = TrendCraft.parabolicSar(candles);
    result.parabolicSar = series.map((item) => item.value?.sar ?? null);
    result.parabolicSarDirection = series.map((item) => item.value?.direction ?? null);
  }

  // ========== ボラティリティ系 ==========

  if (enabledIndicators.includes("bb")) {
    const series = TrendCraft.bollingerBands(candles, {
      period: p.bbPeriod!,
      stdDev: p.bbStdDev!,
    });
    result.bbUpper = series.map((item) => item.value?.upper ?? null);
    result.bbMiddle = series.map((item) => item.value?.middle ?? null);
    result.bbLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("keltner")) {
    const series = TrendCraft.keltnerChannel(candles, {
      emaPeriod: p.keltnerEmaPeriod!,
      atrPeriod: p.keltnerAtrPeriod!,
      multiplier: p.keltnerMultiplier!,
    });
    result.keltnerUpper = series.map((item) => item.value?.upper ?? null);
    result.keltnerMiddle = series.map((item) => item.value?.middle ?? null);
    result.keltnerLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("donchian")) {
    const series = TrendCraft.donchianChannel(candles, { period: p.donchianPeriod! });
    result.donchianUpper = series.map((item) => item.value?.upper ?? null);
    result.donchianMiddle = series.map((item) => item.value?.middle ?? null);
    result.donchianLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("atr")) {
    const series = TrendCraft.atr(candles, { period: p.atrPeriod! });
    result.atr = extractValues(series);
  }

  // ========== モメンタム系 ==========

  if (enabledIndicators.includes("rsi")) {
    const series = TrendCraft.rsi(candles, { period: p.rsiPeriod! });
    result.rsi = extractValues(series);
  }

  if (enabledIndicators.includes("macd")) {
    const series = TrendCraft.macd(candles, {
      fastPeriod: p.macdFastPeriod!,
      slowPeriod: p.macdSlowPeriod!,
      signalPeriod: p.macdSignalPeriod!,
    });
    result.macdLine = series.map((item) => item.value?.macd ?? null);
    result.macdSignal = series.map((item) => item.value?.signal ?? null);
    result.macdHist = series.map((item) => item.value?.histogram ?? null);
  }

  if (enabledIndicators.includes("stochastics")) {
    const series = TrendCraft.stochastics(candles, {
      kPeriod: p.stochKPeriod!,
      dPeriod: p.stochDPeriod!,
    });
    result.stochK = series.map((item) => item.value?.k ?? null);
    result.stochD = series.map((item) => item.value?.d ?? null);
  }

  if (enabledIndicators.includes("stochRsi")) {
    const series = TrendCraft.stochRsi(candles, {
      rsiPeriod: p.stochRsiRsiPeriod!,
      stochPeriod: p.stochRsiStochPeriod!,
      kPeriod: p.stochRsiKPeriod!,
      dPeriod: p.stochRsiDPeriod!,
    });
    result.stochRsiK = series.map((item) => item.value?.k ?? null);
    result.stochRsiD = series.map((item) => item.value?.d ?? null);
  }

  if (enabledIndicators.includes("dmi")) {
    const series = TrendCraft.dmi(candles, { period: p.dmiPeriod! });
    result.dmiPlusDi = series.map((item) => item.value?.plusDi ?? null);
    result.dmiMinusDi = series.map((item) => item.value?.minusDi ?? null);
    result.dmiAdx = series.map((item) => item.value?.adx ?? null);
  }

  if (enabledIndicators.includes("cci")) {
    const series = TrendCraft.cci(candles, { period: p.cciPeriod! });
    result.cci = extractValues(series);
  }

  // ========== 出来高系 ==========

  if (enabledIndicators.includes("obv")) {
    const series = TrendCraft.obv(candles);
    result.obv = extractValues(series);
  }

  if (enabledIndicators.includes("mfi")) {
    const series = TrendCraft.mfi(candles, { period: p.mfiPeriod! });
    result.mfi = extractValues(series);
  }

  // ========== SMC系 ==========

  if (enabledIndicators.includes("orderBlock")) {
    const series = TrendCraft.orderBlock(candles, {
      swingPeriod: p.obSwingPeriod!,
      minVolumeRatio: p.obMinVolumeRatio!,
      maxActiveOBs: p.obMaxActiveOBs!,
    });
    result.orderBlockData = series.map((item) => item.value);
  }

  if (enabledIndicators.includes("liquiditySweep")) {
    const series = TrendCraft.liquiditySweep(candles, {
      swingPeriod: p.lsSwingPeriod!,
      maxRecoveryBars: p.lsMaxRecoveryBars!,
      minSweepDepth: p.lsMinSweepDepth!,
    });
    result.liquiditySweepData = series.map((item) => item.value);
  }

  // ========== パターン認識 ==========

  const patterns: PatternSignal[] = [];

  if (enabledIndicators.includes("doubleTopBottom")) {
    // Convert to boolean for strictMode (UI may pass 0/1 or true/false)
    const strictMode = Boolean(p.dtStrictMode);

    const tops = TrendCraft.doubleTop(candles, {
      tolerance: p.dtTolerance!,
      minDistance: p.dtMinDistance!,
      maxDistance: p.dtMaxDistance!,
      minMiddleDepth: p.dtMinMiddleDepth!,
      swingLookback: p.dtSwingLookback!,
      maxBreakoutDistance: p.dtMaxBreakoutDistance!,
      validateNecklineViolation: p.dtValidateNecklineViolation!,
      necklineViolationTolerance: p.dtNecklineViolationTolerance!,
      strictMode,
    });
    const bottoms = TrendCraft.doubleBottom(candles, {
      tolerance: p.dtTolerance!,
      minDistance: p.dtMinDistance!,
      maxDistance: p.dtMaxDistance!,
      minMiddleDepth: p.dtMinMiddleDepth!,
      swingLookback: p.dtSwingLookback!,
      maxBreakoutDistance: p.dtMaxBreakoutDistance!,
      validateNecklineViolation: p.dtValidateNecklineViolation!,
      necklineViolationTolerance: p.dtNecklineViolationTolerance!,
      strictMode,
    });
    patterns.push(...tops, ...bottoms);
  }

  if (enabledIndicators.includes("headShoulders")) {
    const hs = TrendCraft.headAndShoulders(candles, {
      shoulderTolerance: p.hsShoulderTolerance!,
      maxNecklineSlope: p.hsMaxNecklineSlope!,
    });
    const ihs = TrendCraft.inverseHeadAndShoulders(candles, {
      shoulderTolerance: p.hsShoulderTolerance!,
      maxNecklineSlope: p.hsMaxNecklineSlope!,
    });
    patterns.push(...hs, ...ihs);
  }

  if (enabledIndicators.includes("cupHandle")) {
    const cups = TrendCraft.cupWithHandle(candles, {
      minCupDepth: p.chMinCupDepth!,
      maxCupDepth: p.chMaxCupDepth!,
      minCupLength: p.chMinCupLength!,
    });
    patterns.push(...cups);
  }

  if (patterns.length > 0) {
    result.detectedPatterns = patterns;
  }

  return result;
}

/**
 * 特定のインデックスでのインジケーター値のスナップショットを取得
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
 * 市場コンテキスト（チャートパターン・トレンド状態）を分析
 */
export function analyzeMarketContext(
  candles: NormalizedCandle[],
  index: number,
  indicatorData: IndicatorData,
): MarketContext {
  const currentCandle = candles[index];
  const price = currentCandle.close;

  // SMA値を取得
  const sma25 = indicatorData.sma25?.[index];
  const sma75 = indicatorData.sma75?.[index];
  const rsi = indicatorData.rsi?.[index];
  const macdHist = indicatorData.macdHist?.[index];
  const bbUpper = indicatorData.bbUpper?.[index];
  const bbLower = indicatorData.bbLower?.[index];
  const bbMiddle = indicatorData.bbMiddle?.[index];

  // 価格 vs SMA25
  let priceVsSma25: "above" | "below" | "at" = "at";
  if (sma25 != null) {
    const diff = ((price - sma25) / sma25) * 100;
    if (diff > 0.5) priceVsSma25 = "above";
    else if (diff < -0.5) priceVsSma25 = "below";
  }

  // 価格 vs SMA75
  let priceVsSma75: "above" | "below" | "at" = "at";
  if (sma75 != null) {
    const diff = ((price - sma75) / sma75) * 100;
    if (diff > 0.5) priceVsSma75 = "above";
    else if (diff < -0.5) priceVsSma75 = "below";
  }

  // SMA25 vs SMA75 (ゴールデンクロス/デッドクロス検出)
  let sma25VsSma75: "golden_cross" | "death_cross" | "above" | "below" = "above";
  if (sma25 != null && sma75 != null) {
    const prevSma25 = indicatorData.sma25?.[index - 1];
    const prevSma75 = indicatorData.sma75?.[index - 1];

    if (prevSma25 != null && prevSma75 != null) {
      // クロス判定（直近でクロスしたか）
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

  // ADX（confidence計算用）
  const adx = indicatorData.dmiAdx?.[index];

  // トレンド判定（SMA25の傾きで判定）
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

  // regime（機械可読用enum）
  const regimeMap: Record<typeof trend, "TREND_UP" | "TREND_DOWN" | "RANGE"> = {
    uptrend: "TREND_UP",
    downtrend: "TREND_DOWN",
    range: "RANGE",
  };
  const regime = regimeMap[trend];

  // confidence（0-1、ADXベースまたはtrendStrengthから推定）
  const strengthConfidence: Record<typeof trendStrength, number> = {
    strong: 0.8,
    moderate: 0.5,
    weak: 0.3,
  };
  const confidence = adx != null ? Math.min(adx / 50, 1) : strengthConfidence[trendStrength];

  // RSIゾーン
  let rsiZone: "overbought" | "oversold" | "neutral" | undefined;
  if (rsi != null) {
    if (rsi >= 70) rsiZone = "overbought";
    else if (rsi <= 30) rsiZone = "oversold";
    else rsiZone = "neutral";
  }

  // MACDシグナル
  let macdSignal: "bullish" | "bearish" | "neutral" | undefined;
  if (macdHist != null) {
    const prevMacdHist = indicatorData.macdHist?.[index - 1];
    if (prevMacdHist != null) {
      if (macdHist > 0 && macdHist > prevMacdHist) macdSignal = "bullish";
      else if (macdHist < 0 && macdHist < prevMacdHist) macdSignal = "bearish";
      else macdSignal = "neutral";
    }
  }

  // BBポジション
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

  // 説明テキスト生成
  const descParts: string[] = [];

  // トレンド
  const trendLabel = {
    uptrend: "上昇トレンド",
    downtrend: "下降トレンド",
    range: "レンジ相場",
  }[trend];
  const strengthLabel = {
    strong: "強い",
    moderate: "やや",
    weak: "",
  }[trendStrength];
  descParts.push(`${strengthLabel}${trendLabel}`);

  // MA関係
  if (sma25VsSma75 === "golden_cross") {
    descParts.push("ゴールデンクロス発生");
  } else if (sma25VsSma75 === "death_cross") {
    descParts.push("デッドクロス発生");
  } else if (sma25 != null && sma75 != null) {
    descParts.push(sma25 > sma75 ? "MA25>MA75" : "MA25<MA75");
  }

  // 価格位置
  if (priceVsSma25 !== "at") {
    descParts.push(`価格はMA25の${priceVsSma25 === "above" ? "上" : "下"}`);
  }

  // RSI
  if (rsiZone === "overbought") {
    descParts.push("RSI買われすぎ圏");
  } else if (rsiZone === "oversold") {
    descParts.push("RSI売られすぎ圏");
  }

  // BB
  if (bbPosition === "upper") {
    descParts.push("BB上限付近");
  } else if (bbPosition === "lower") {
    descParts.push("BB下限付近");
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
    description: descParts.join("、"),
  };
}
