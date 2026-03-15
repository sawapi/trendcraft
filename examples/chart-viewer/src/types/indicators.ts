import type { ScoringPreset } from "./chart";

/**
 * Indicator parameter configuration
 */
export interface IndicatorParams {
  // Overlays - Moving Averages
  sma5Period: number;
  sma25Period: number;
  sma75Period: number;
  ema12Period: number;
  ema26Period: number;
  wma20Period: number;
  vwma20Period: number;
  // Overlays - Filter
  superSmootherPeriod: number;
  // Subcharts - Filter
  roofingFilterHighPassPeriod: number;
  roofingFilterLowPassPeriod: number;
  // Overlays - Bands
  bbPeriod: number;
  bbStdDev: number;
  donchianPeriod: number;
  keltnerEmaPeriod: number;
  keltnerAtrPeriod: number;
  keltnerMultiplier: number;
  // Overlays - Trend
  ichimokuTenkan: number;
  ichimokuKijun: number;
  ichimokuSenkou: number;
  ichimokuDisplacement: number;
  supertrendPeriod: number;
  supertrendMultiplier: number;
  psarStep: number;
  psarMax: number;
  // Subcharts
  rsiPeriod: number;
  macdFastPeriod: number;
  macdSlowPeriod: number;
  macdSignalPeriod: number;
  stochKPeriod: number;
  stochDPeriod: number;
  dmiPeriod: number;
  stochRsiRsiPeriod: number;
  stochRsiStochPeriod: number;
  stochRsiKPeriod: number;
  stochRsiDPeriod: number;
  mfiPeriod: number;
  cciPeriod: number;
  williamsPeriod: number;
  rocPeriod: number;
  cmfPeriod: number;
  volumeAnomalyPeriod: number;
  volumeAnomalyZScore: number;
  volumeProfilePeriod: number;
  volumeProfileLevels: number;
  volumeTrendPricePeriod: number;
  volumeTrendVolumePeriod: number;
  // ATR
  atrPeriod: number;
  // VWAP
  vwapResetPeriod: "session" | "rolling";
  vwapRollingPeriod: number;
  // Swing Points
  swingLeftBars: number;
  swingRightBars: number;
  // SMC - Order Block
  orderBlockSwingPeriod: number;
  orderBlockVolumePeriod: number;
  orderBlockMinVolumeRatio: number;
  orderBlockMaxActive: number;
  orderBlockDisplacementAtr: number;
  orderBlockMaxBarsActive: number;
  // SMC - Fair Value Gap
  fvgMinGapPercent: number;
  fvgMaxActive: number;
  fvgShowMitigated: boolean;
  // SMC - BOS/CHoCH
  bosSwingPeriod: number;
  // SMC - Liquidity Sweep
  liquiditySweepSwingPeriod: number;
  liquiditySweepMaxRecoveryBars: number;
  // Fibonacci Retracement
  fibLeftBars: number;
  fibRightBars: number;
  // Auto Trend Line
  autoTrendLineLeftBars: number;
  autoTrendLineRightBars: number;
  // Channel Line
  channelLineLeftBars: number;
  channelLineRightBars: number;
  // Fibonacci Extension
  fibExtLeftBars: number;
  fibExtRightBars: number;
  // Andrew's Pitchfork
  pitchforkLeftBars: number;
  pitchforkRightBars: number;
  // Pivot Points
  pivotPointsMethod: number;
  // Highest/Lowest Channel
  highestLowestPeriod: number;
  // Chandelier Exit
  chandelierPeriod: number;
  chandelierMultiplier: number;
  // ATR Stops
  atrStopsPeriod: number;
  atrStopsMultiplier: number;
  atrStopsTpMultiplier: number;
  // Volatility Regime
  volatilityRegimeAtrPeriod: number;
  volatilityRegimeLookback: number;
  // Divergence
  divergenceSwingLookback: number;
  divergenceMinDistance: number;
  divergenceMaxDistance: number;
  divergenceIndicator: "rsi" | "macd" | "obv";
  // Bollinger Squeeze
  bbSqueezePeriod: number;
  bbSqueezeStdDev: number;
  bbSqueezeLookback: number;
  bbSqueezeThreshold: number;
  // Volume Breakout
  volumeBreakoutPeriod: number;
  volumeBreakoutMinRatio: number;
  // Volume MA Cross
  volumeMaCrossShortPeriod: number;
  volumeMaCrossLongPeriod: number;
  // Scoring
  scoringPreset: ScoringPreset;
  // KAMA
  kamaPeriod: number;
  kamaFastPeriod: number;
  kamaSlowPeriod: number;
  // T3
  t3Period: number;
  t3VFactor: number;
  // Fractals
  fractalsPeriod: number;
  // Zigzag
  zigzagDeviation: number;
  // Chart Patterns
  chartPatternSwingLookback: number;
  chartPatternTolerance: number;
  chartPatternMinDistance: number;
  chartPatternMaxDistance: number;
  // TRIX
  trixPeriod: number;
  trixSignalPeriod: number;
  // Aroon
  aroonPeriod: number;
  // DPO
  dpoPeriod: number;
  // Hurst
  hurstMinWindow: number;
  hurstMaxWindow: number;
  // Vortex
  vortexPeriod: number;
}

/**
 * Default indicator parameters
 */
export const DEFAULT_INDICATOR_PARAMS: IndicatorParams = {
  // Overlays - Moving Averages
  sma5Period: 5,
  sma25Period: 25,
  sma75Period: 75,
  ema12Period: 12,
  ema26Period: 26,
  wma20Period: 20,
  vwma20Period: 20,
  // Overlays - Filter
  superSmootherPeriod: 10,
  // Subcharts - Filter
  roofingFilterHighPassPeriod: 48,
  roofingFilterLowPassPeriod: 10,
  // Overlays - Bands
  bbPeriod: 20,
  bbStdDev: 2,
  donchianPeriod: 20,
  keltnerEmaPeriod: 20,
  keltnerAtrPeriod: 10,
  keltnerMultiplier: 2,
  // Overlays - Trend
  ichimokuTenkan: 9,
  ichimokuKijun: 26,
  ichimokuSenkou: 52,
  ichimokuDisplacement: 26,
  supertrendPeriod: 10,
  supertrendMultiplier: 3,
  psarStep: 0.02,
  psarMax: 0.2,
  // Subcharts
  rsiPeriod: 14,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
  stochKPeriod: 14,
  stochDPeriod: 3,
  dmiPeriod: 14,
  stochRsiRsiPeriod: 14,
  stochRsiStochPeriod: 14,
  stochRsiKPeriod: 3,
  stochRsiDPeriod: 3,
  mfiPeriod: 14,
  cciPeriod: 20,
  williamsPeriod: 14,
  rocPeriod: 12,
  cmfPeriod: 20,
  volumeAnomalyPeriod: 20,
  volumeAnomalyZScore: 2,
  volumeProfilePeriod: 100,
  volumeProfileLevels: 24,
  volumeTrendPricePeriod: 5,
  volumeTrendVolumePeriod: 20,
  // ATR
  atrPeriod: 14,
  // VWAP
  vwapResetPeriod: "rolling",
  vwapRollingPeriod: 20,
  // Swing Points
  swingLeftBars: 5,
  swingRightBars: 5,
  // SMC - Order Block
  orderBlockSwingPeriod: 5,
  orderBlockVolumePeriod: 20,
  orderBlockMinVolumeRatio: 1.0,
  orderBlockMaxActive: 10,
  orderBlockDisplacementAtr: 0,
  orderBlockMaxBarsActive: 500,
  // SMC - Fair Value Gap
  fvgMinGapPercent: 0,
  fvgMaxActive: 10,
  fvgShowMitigated: false,
  // SMC - BOS/CHoCH
  bosSwingPeriod: 5,
  // SMC - Liquidity Sweep
  liquiditySweepSwingPeriod: 5,
  liquiditySweepMaxRecoveryBars: 3,
  // Fibonacci Retracement
  fibLeftBars: 10,
  fibRightBars: 10,
  // Auto Trend Line
  autoTrendLineLeftBars: 10,
  autoTrendLineRightBars: 10,
  // Channel Line
  channelLineLeftBars: 10,
  channelLineRightBars: 10,
  // Fibonacci Extension
  fibExtLeftBars: 10,
  fibExtRightBars: 10,
  // Andrew's Pitchfork
  pitchforkLeftBars: 10,
  pitchforkRightBars: 10,
  // Pivot Points
  pivotPointsMethod: 0,
  // Highest/Lowest Channel
  highestLowestPeriod: 20,
  // Chandelier Exit
  chandelierPeriod: 22,
  chandelierMultiplier: 3.0,
  // ATR Stops
  atrStopsPeriod: 14,
  atrStopsMultiplier: 2.0,
  atrStopsTpMultiplier: 3.0,
  // Volatility Regime
  volatilityRegimeAtrPeriod: 14,
  volatilityRegimeLookback: 100,
  // Divergence
  divergenceSwingLookback: 5,
  divergenceMinDistance: 5,
  divergenceMaxDistance: 60,
  divergenceIndicator: "rsi",
  // Bollinger Squeeze
  bbSqueezePeriod: 20,
  bbSqueezeStdDev: 2,
  bbSqueezeLookback: 120,
  bbSqueezeThreshold: 5,
  // Volume Breakout
  volumeBreakoutPeriod: 20,
  volumeBreakoutMinRatio: 1.5,
  // Volume MA Cross
  volumeMaCrossShortPeriod: 5,
  volumeMaCrossLongPeriod: 20,
  // Scoring
  scoringPreset: "balanced",
  // Chart Patterns
  chartPatternSwingLookback: 10,
  chartPatternTolerance: 0.03,
  chartPatternMinDistance: 10,
  chartPatternMaxDistance: 100,
  // KAMA
  kamaPeriod: 10,
  kamaFastPeriod: 2,
  kamaSlowPeriod: 30,
  // T3
  t3Period: 5,
  t3VFactor: 0.7,
  // Fractals
  fractalsPeriod: 2,
  // Zigzag
  zigzagDeviation: 5,
  // TRIX
  trixPeriod: 15,
  trixSignalPeriod: 9,
  // Aroon
  aroonPeriod: 25,
  // DPO
  dpoPeriod: 20,
  // Hurst
  hurstMinWindow: 20,
  hurstMaxWindow: 100,
  // Vortex
  vortexPeriod: 14,
};

/**
 * Parameter config for UI
 */
export type ParamConfig = NumericParamConfig | BooleanParamConfig;

export interface NumericParamConfig {
  key: keyof IndicatorParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

export interface BooleanParamConfig {
  key: keyof IndicatorParams;
  label: string;
  type: "boolean";
}

/**
 * Parameter configurations for each indicator
 */
export const INDICATOR_PARAM_CONFIGS: Record<string, ParamConfig[]> = {
  // Overlays - Moving Averages
  sma5: [{ key: "sma5Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma25: [{ key: "sma25Period", label: "Period", min: 2, max: 200, step: 1 }],
  sma75: [{ key: "sma75Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema12: [{ key: "ema12Period", label: "Period", min: 2, max: 200, step: 1 }],
  ema26: [{ key: "ema26Period", label: "Period", min: 2, max: 200, step: 1 }],
  wma20: [{ key: "wma20Period", label: "Period", min: 2, max: 200, step: 1 }],
  vwma20: [{ key: "vwma20Period", label: "Period", min: 2, max: 200, step: 1 }],
  superSmoother: [{ key: "superSmootherPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  roofingFilter: [
    { key: "roofingFilterHighPassPeriod", label: "High-Pass Period", min: 10, max: 100, step: 1 },
    { key: "roofingFilterLowPassPeriod", label: "Low-Pass Period", min: 2, max: 50, step: 1 },
  ],
  // Overlays - Bands
  bb: [
    { key: "bbPeriod", label: "Period", min: 2, max: 100, step: 1 },
    { key: "bbStdDev", label: "Std Dev", min: 0.5, max: 4, step: 0.5 },
  ],
  donchian: [{ key: "donchianPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  keltner: [
    { key: "keltnerEmaPeriod", label: "EMA Period", min: 2, max: 100, step: 1 },
    { key: "keltnerAtrPeriod", label: "ATR Period", min: 2, max: 50, step: 1 },
    { key: "keltnerMultiplier", label: "Multiplier", min: 0.5, max: 5, step: 0.5 },
  ],
  // Overlays - Trend
  ichimoku: [
    { key: "ichimokuTenkan", label: "Tenkan", min: 5, max: 20, step: 1 },
    { key: "ichimokuKijun", label: "Kijun", min: 10, max: 60, step: 1 },
    { key: "ichimokuSenkou", label: "Senkou", min: 20, max: 120, step: 1 },
    { key: "ichimokuDisplacement", label: "Displacement", min: 10, max: 60, step: 1 },
  ],
  supertrend: [
    { key: "supertrendPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "supertrendMultiplier", label: "Multiplier", min: 1, max: 10, step: 0.5 },
  ],
  psar: [
    { key: "psarStep", label: "Step", min: 0.01, max: 0.1, step: 0.01 },
    { key: "psarMax", label: "Max", min: 0.1, max: 0.5, step: 0.05 },
  ],
  // Subcharts
  rsi: [{ key: "rsiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  macd: [
    { key: "macdFastPeriod", label: "Fast", min: 2, max: 50, step: 1 },
    { key: "macdSlowPeriod", label: "Slow", min: 2, max: 100, step: 1 },
    { key: "macdSignalPeriod", label: "Signal", min: 2, max: 50, step: 1 },
  ],
  stochastics: [
    { key: "stochKPeriod", label: "K Period", min: 2, max: 50, step: 1 },
    { key: "stochDPeriod", label: "D Period", min: 2, max: 20, step: 1 },
  ],
  dmi: [{ key: "dmiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  stochrsi: [
    { key: "stochRsiRsiPeriod", label: "RSI Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiStochPeriod", label: "Stoch Period", min: 2, max: 50, step: 1 },
    { key: "stochRsiKPeriod", label: "K", min: 2, max: 20, step: 1 },
    { key: "stochRsiDPeriod", label: "D", min: 2, max: 20, step: 1 },
  ],
  mfi: [{ key: "mfiPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  cci: [{ key: "cciPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  williams: [{ key: "williamsPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  roc: [{ key: "rocPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  cmf: [{ key: "cmfPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  volumeAnomaly: [
    { key: "volumeAnomalyPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "volumeAnomalyZScore", label: "Z-Score", min: 1, max: 4, step: 0.5 },
  ],
  volumeProfile: [
    { key: "volumeProfilePeriod", label: "Period", min: 20, max: 200, step: 10 },
    { key: "volumeProfileLevels", label: "Levels", min: 10, max: 50, step: 2 },
  ],
  volumeTrend: [
    { key: "volumeTrendPricePeriod", label: "Price Period", min: 2, max: 20, step: 1 },
    { key: "volumeTrendVolumePeriod", label: "Vol Period", min: 5, max: 50, step: 1 },
  ],
  atr: [{ key: "atrPeriod", label: "Period", min: 1, max: 50, step: 1 }],
  vwap: [{ key: "vwapRollingPeriod", label: "Rolling Period", min: 5, max: 100, step: 1 }],
  swingPoints: [
    { key: "swingLeftBars", label: "Left Bars", min: 1, max: 20, step: 1 },
    { key: "swingRightBars", label: "Right Bars", min: 1, max: 20, step: 1 },
  ],
  // SMC indicators
  orderBlock: [
    { key: "orderBlockSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
    { key: "orderBlockVolumePeriod", label: "Volume Period", min: 5, max: 50, step: 1 },
    { key: "orderBlockMinVolumeRatio", label: "Min Vol Ratio", min: 0.5, max: 3, step: 0.1 },
    { key: "orderBlockMaxActive", label: "Max Active", min: 1, max: 20, step: 1 },
    { key: "orderBlockDisplacementAtr", label: "Displacement ATR", min: 0, max: 5, step: 0.1 },
    { key: "orderBlockMaxBarsActive", label: "Max Bars Active", min: 50, max: 2000, step: 50 },
  ],
  fvg: [
    { key: "fvgMinGapPercent", label: "Min Gap %", min: 0, max: 2, step: 0.1 },
    { key: "fvgMaxActive", label: "Max Active", min: 1, max: 20, step: 1 },
    { key: "fvgShowMitigated", label: "Show Filled", type: "boolean" },
  ],
  bos: [{ key: "bosSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 }],
  choch: [{ key: "bosSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 }],
  liquiditySweep: [
    { key: "liquiditySweepSwingPeriod", label: "Swing Period", min: 1, max: 20, step: 1 },
    { key: "liquiditySweepMaxRecoveryBars", label: "Max Recovery Bars", min: 1, max: 10, step: 1 },
  ],
  fibonacci: [
    { key: "fibLeftBars", label: "Left Bars", min: 1, max: 30, step: 1 },
    { key: "fibRightBars", label: "Right Bars", min: 1, max: 30, step: 1 },
  ],
  autoTrendLine: [
    { key: "autoTrendLineLeftBars", label: "Left Bars", min: 1, max: 30, step: 1 },
    { key: "autoTrendLineRightBars", label: "Right Bars", min: 1, max: 30, step: 1 },
  ],
  channelLine: [
    { key: "channelLineLeftBars", label: "Left Bars", min: 1, max: 30, step: 1 },
    { key: "channelLineRightBars", label: "Right Bars", min: 1, max: 30, step: 1 },
  ],
  fibExtension: [
    { key: "fibExtLeftBars", label: "Left Bars", min: 1, max: 30, step: 1 },
    { key: "fibExtRightBars", label: "Right Bars", min: 1, max: 30, step: 1 },
  ],
  andrewsPitchfork: [
    { key: "pitchforkLeftBars", label: "Left Bars", min: 1, max: 30, step: 1 },
    { key: "pitchforkRightBars", label: "Right Bars", min: 1, max: 30, step: 1 },
  ],
  pivotPoints: [
    {
      key: "pivotPointsMethod",
      label: "Method (0:Std 1:Fib 2:Woodie 3:Cama 4:DeMark)",
      min: 0,
      max: 4,
      step: 1,
    },
  ],
  highestLowest: [{ key: "highestLowestPeriod", label: "Period", min: 2, max: 200, step: 1 }],
  chandelierExit: [
    { key: "chandelierPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "chandelierMultiplier", label: "Multiplier", min: 1, max: 5, step: 0.5 },
  ],
  atrStops: [
    { key: "atrStopsPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "atrStopsMultiplier", label: "Stop Multi", min: 0.5, max: 5, step: 0.5 },
    { key: "atrStopsTpMultiplier", label: "TP Multi", min: 1, max: 10, step: 0.5 },
  ],
  volatilityRegime: [
    { key: "volatilityRegimeAtrPeriod", label: "ATR Period", min: 5, max: 50, step: 1 },
    { key: "volatilityRegimeLookback", label: "Lookback", min: 50, max: 200, step: 10 },
  ],
  // Signals
  divergence: [
    { key: "divergenceSwingLookback", label: "Swing Lookback", min: 3, max: 20, step: 1 },
    { key: "divergenceMinDistance", label: "Min Distance", min: 3, max: 20, step: 1 },
    { key: "divergenceMaxDistance", label: "Max Distance", min: 20, max: 120, step: 10 },
  ],
  bbSqueeze: [
    { key: "bbSqueezePeriod", label: "BB Period", min: 10, max: 50, step: 1 },
    { key: "bbSqueezeLookback", label: "Lookback", min: 50, max: 200, step: 10 },
    { key: "bbSqueezeThreshold", label: "Threshold %", min: 1, max: 20, step: 1 },
  ],
  volumeBreakout: [
    { key: "volumeBreakoutPeriod", label: "Period", min: 5, max: 50, step: 1 },
    { key: "volumeBreakoutMinRatio", label: "Min Ratio", min: 1.0, max: 5.0, step: 0.1 },
  ],
  volumeMaCross: [
    { key: "volumeMaCrossShortPeriod", label: "Short Period", min: 2, max: 20, step: 1 },
    { key: "volumeMaCrossLongPeriod", label: "Long Period", min: 10, max: 50, step: 1 },
  ],
  // New overlays
  kama: [
    { key: "kamaPeriod", label: "Period", min: 2, max: 100, step: 1 },
    { key: "kamaFastPeriod", label: "Fast Period", min: 2, max: 10, step: 1 },
    { key: "kamaSlowPeriod", label: "Slow Period", min: 10, max: 50, step: 1 },
  ],
  t3: [
    { key: "t3Period", label: "Period", min: 2, max: 100, step: 1 },
    { key: "t3VFactor", label: "V-Factor", min: 0.1, max: 1.0, step: 0.1 },
  ],
  fractals: [{ key: "fractalsPeriod", label: "Period", min: 1, max: 10, step: 1 }],
  zigzag: [{ key: "zigzagDeviation", label: "Deviation %", min: 1, max: 20, step: 0.5 }],
  // Chart Patterns
  chartPatterns: [
    { key: "chartPatternSwingLookback", label: "Swing Lookback", min: 2, max: 20, step: 1 },
    { key: "chartPatternTolerance", label: "Tolerance", min: 0.01, max: 0.1, step: 0.01 },
    { key: "chartPatternMinDistance", label: "Min Distance", min: 5, max: 30, step: 1 },
    { key: "chartPatternMaxDistance", label: "Max Distance", min: 20, max: 100, step: 5 },
  ],
  // Overlay Chart Patterns (share swingLookback)
  trianglePattern: [
    { key: "chartPatternSwingLookback", label: "Swing Lookback", min: 2, max: 20, step: 1 },
  ],
  wedgePattern: [
    { key: "chartPatternSwingLookback", label: "Swing Lookback", min: 2, max: 20, step: 1 },
  ],
  channelPattern: [
    { key: "chartPatternSwingLookback", label: "Swing Lookback", min: 2, max: 20, step: 1 },
  ],
  flagPattern: [
    { key: "chartPatternSwingLookback", label: "Swing Lookback", min: 2, max: 20, step: 1 },
  ],
  // New subcharts
  trix: [
    { key: "trixPeriod", label: "Period", min: 2, max: 50, step: 1 },
    { key: "trixSignalPeriod", label: "Signal", min: 2, max: 20, step: 1 },
  ],
  aroon: [{ key: "aroonPeriod", label: "Period", min: 2, max: 50, step: 1 }],
  dpo: [{ key: "dpoPeriod", label: "Period", min: 2, max: 100, step: 1 }],
  hurst: [
    { key: "hurstMinWindow", label: "Min Window", min: 10, max: 50, step: 5 },
    { key: "hurstMaxWindow", label: "Max Window", min: 50, max: 200, step: 10 },
  ],
  vortex: [{ key: "vortexPeriod", label: "Period", min: 2, max: 50, step: 1 }],
};
