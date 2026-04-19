/**
 * Indicator Metadata Constants
 *
 * Single source of truth for indicator domain metadata (kind, label, overlay,
 * yRange, referenceLines). Used by both batch functions (via tagSeries)
 * and live presets (via livePresets).
 *
 * These describe the DATA nature of each indicator, NOT visual styling.
 * Visual config (colors, lineWidth) belongs in the chart package.
 *
 * `kind` is a parameter-independent identifier matching the corresponding
 * key in `livePresets` / `indicatorPresets`. Use it for identity matching
 * (e.g. `series.__meta.kind === "rsi"`); `label` is for display and
 * changes with parameter values (`"RSI(14)"`, `"SMA(20)"`, etc.).
 */

import type { SeriesMeta } from "../types/candle";

// ============================================
// Moving Averages
// ============================================

export const SMA_META: SeriesMeta = { kind: "sma", overlay: true, label: "SMA" };
export const EMA_META: SeriesMeta = { kind: "ema", overlay: true, label: "EMA" };
export const WMA_META: SeriesMeta = { kind: "wma", overlay: true, label: "WMA" };
export const VWMA_META: SeriesMeta = { kind: "vwma", overlay: true, label: "VWMA" };
export const KAMA_META: SeriesMeta = { kind: "kama", overlay: true, label: "KAMA" };
export const HMA_META: SeriesMeta = { kind: "hma", overlay: true, label: "HMA" };
export const T3_META: SeriesMeta = { kind: "t3", overlay: true, label: "T3" };
export const MCGINLEY_META: SeriesMeta = { kind: "mcginley", overlay: true, label: "McGinley" };
export const EMA_RIBBON_META: SeriesMeta = {
  kind: "emaRibbon",
  overlay: true,
  label: "EMA Ribbon",
};
export const DEMA_META: SeriesMeta = { kind: "dema", overlay: true, label: "DEMA" };
export const TEMA_META: SeriesMeta = { kind: "tema", overlay: true, label: "TEMA" };
export const ZLEMA_META: SeriesMeta = { kind: "zlema", overlay: true, label: "ZLEMA" };
export const ALMA_META: SeriesMeta = { kind: "alma", overlay: true, label: "ALMA" };
export const FRAMA_META: SeriesMeta = { kind: "frama", overlay: true, label: "FRAMA" };

// ============================================
// Momentum
// ============================================

export const RSI_META: SeriesMeta = {
  kind: "rsi",
  overlay: false,
  label: "RSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const MACD_META: SeriesMeta = { kind: "macd", overlay: false, label: "MACD" };
export const STOCHASTICS_META: SeriesMeta = {
  kind: "stochastics",
  overlay: false,
  label: "Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const DMI_META: SeriesMeta = {
  kind: "dmi",
  overlay: false,
  label: "DMI",
  yRange: [0, 100],
};
export const ROC_META: SeriesMeta = {
  kind: "roc",
  overlay: false,
  label: "ROC",
  referenceLines: [0],
};
export const WILLIAMS_R_META: SeriesMeta = {
  kind: "williamsR",
  overlay: false,
  label: "Williams %R",
  yRange: [-100, 0],
  referenceLines: [-20, -80],
};
export const CCI_META: SeriesMeta = {
  kind: "cci",
  overlay: false,
  label: "CCI",
  referenceLines: [100, -100],
};
export const STOCH_RSI_META: SeriesMeta = {
  kind: "stochRsi",
  overlay: false,
  label: "StochRSI",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const TRIX_META: SeriesMeta = {
  kind: "trix",
  overlay: false,
  label: "TRIX",
  referenceLines: [0],
};
export const AROON_META: SeriesMeta = {
  kind: "aroon",
  overlay: false,
  label: "Aroon",
  yRange: [0, 100],
};
export const CONNORS_RSI_META: SeriesMeta = {
  kind: "connorsRsi",
  overlay: false,
  label: "CRSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const CMO_META: SeriesMeta = {
  kind: "cmo",
  overlay: false,
  label: "CMO",
  yRange: [-100, 100],
  referenceLines: [50, -50],
};
export const ADXR_META: SeriesMeta = {
  kind: "adxr",
  overlay: false,
  label: "ADXR",
  yRange: [0, 100],
};
export const IMI_META: SeriesMeta = {
  kind: "imi",
  overlay: false,
  label: "IMI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const VORTEX_META: SeriesMeta = { kind: "vortex", overlay: false, label: "Vortex" };
export const AO_META: SeriesMeta = {
  kind: "awesomeOscillator",
  overlay: false,
  label: "AO",
  referenceLines: [0],
};
export const BOP_META: SeriesMeta = {
  kind: "balanceOfPower",
  overlay: false,
  label: "BOP",
  yRange: [-1, 1],
  referenceLines: [0],
};
export const COPPOCK_META: SeriesMeta = {
  kind: "coppockCurve",
  overlay: false,
  label: "Coppock",
  referenceLines: [0],
};
export const DPO_META: SeriesMeta = {
  kind: "dpo",
  overlay: false,
  label: "DPO",
  referenceLines: [0],
};
export const HURST_META: SeriesMeta = {
  kind: "hurst",
  overlay: false,
  label: "Hurst",
  yRange: [0, 1],
  referenceLines: [0.5],
};
export const KST_META: SeriesMeta = {
  kind: "kst",
  overlay: false,
  label: "KST",
  referenceLines: [0],
};
export const MASS_INDEX_META: SeriesMeta = {
  kind: "massIndex",
  overlay: false,
  label: "Mass Index",
  referenceLines: [27, 26.5],
};
export const PPO_META: SeriesMeta = {
  kind: "ppo",
  overlay: false,
  label: "PPO",
  referenceLines: [0],
};
export const QSTICK_META: SeriesMeta = {
  kind: "qstick",
  overlay: false,
  label: "QStick",
  referenceLines: [0],
};
export const TSI_META: SeriesMeta = {
  kind: "tsi",
  overlay: false,
  label: "TSI",
  referenceLines: [0],
};
export const UO_META: SeriesMeta = {
  kind: "ultimateOscillator",
  overlay: false,
  label: "UO",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const STC_META: SeriesMeta = {
  kind: "stc",
  overlay: false,
  label: "STC",
  yRange: [0, 100],
  referenceLines: [25, 75],
};

// ============================================
// Volatility
// ============================================

export const ATR_META: SeriesMeta = { kind: "atr", overlay: false, label: "ATR" };
export const BB_META: SeriesMeta = { kind: "bollingerBands", overlay: true, label: "BB" };
export const DONCHIAN_META: SeriesMeta = {
  kind: "donchianChannel",
  overlay: true,
  label: "Donchian",
};
export const KELTNER_META: SeriesMeta = {
  kind: "keltnerChannel",
  overlay: true,
  label: "Keltner",
};
export const CHANDELIER_EXIT_META: SeriesMeta = {
  kind: "chandelierExit",
  overlay: true,
  label: "Chandelier Exit",
};
export const CHOPPINESS_META: SeriesMeta = {
  kind: "choppinessIndex",
  overlay: false,
  label: "Chop",
  yRange: [0, 100],
  referenceLines: [38.2, 61.8],
};
export const EWMA_VOL_META: SeriesMeta = {
  kind: "ewmaVolatility",
  overlay: false,
  label: "EWMA Vol",
};
export const GARMAN_KLASS_META: SeriesMeta = {
  kind: "garmanKlass",
  overlay: false,
  label: "GK Vol",
};
export const HV_META: SeriesMeta = {
  kind: "historicalVolatility",
  overlay: false,
  label: "HV",
};
export const ATR_STOPS_META: SeriesMeta = { kind: "atrStops", overlay: true, label: "ATR Stops" };
export const ULCER_META: SeriesMeta = { kind: "ulcerIndex", overlay: false, label: "Ulcer" };

// ============================================
// Trend
// ============================================

export const SUPERTREND_META: SeriesMeta = {
  kind: "supertrend",
  overlay: true,
  label: "Supertrend",
};
export const PARABOLIC_SAR_META: SeriesMeta = {
  kind: "parabolicSar",
  overlay: true,
  label: "Parabolic SAR",
};
export const ICHIMOKU_META: SeriesMeta = { kind: "ichimoku", overlay: true, label: "Ichimoku" };

// ============================================
// Volume
// ============================================

export const OBV_META: SeriesMeta = { kind: "obv", overlay: false, label: "OBV" };
export const CMF_META: SeriesMeta = {
  kind: "cmf",
  overlay: false,
  label: "CMF",
  yRange: [-1, 1],
  referenceLines: [0],
};
export const MFI_META: SeriesMeta = {
  kind: "mfi",
  overlay: false,
  label: "MFI",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const VWAP_META: SeriesMeta = { kind: "vwap", overlay: true, label: "VWAP" };
export const ADL_META: SeriesMeta = { kind: "adl", overlay: false, label: "ADL" };
export const TWAP_META: SeriesMeta = { kind: "twap", overlay: true, label: "TWAP" };
export const ELDER_FORCE_INDEX_META: SeriesMeta = {
  kind: "elderForceIndex",
  overlay: false,
  label: "EFI",
  referenceLines: [0],
};
export const VOLUME_ANOMALY_META: SeriesMeta = {
  kind: "volumeAnomaly",
  overlay: false,
  label: "Vol Anomaly",
};
export const KLINGER_META: SeriesMeta = {
  kind: "klinger",
  overlay: false,
  label: "Klinger",
  referenceLines: [0],
};
export const PVT_META: SeriesMeta = { kind: "pvt", overlay: false, label: "PVT" };
export const NVI_META: SeriesMeta = { kind: "nvi", overlay: false, label: "NVI" };
export const CVD_META: SeriesMeta = { kind: "cvd", overlay: false, label: "CVD" };
export const WEIS_WAVE_META: SeriesMeta = {
  kind: "weisWave",
  overlay: false,
  label: "Weis Wave",
};
export const ANCHORED_VWAP_META: SeriesMeta = {
  kind: "anchoredVwap",
  overlay: true,
  label: "AVWAP",
};
export const EMV_META: SeriesMeta = {
  kind: "easeOfMovement",
  overlay: false,
  label: "EMV",
  referenceLines: [0],
};
export const VOLUME_TREND_META: SeriesMeta = {
  kind: "volumeTrend",
  overlay: false,
  label: "Vol Trend",
};

// ============================================
// Price
// ============================================

export const HIGHEST_LOWEST_META: SeriesMeta = {
  kind: "highestLowest",
  overlay: true,
  label: "HiLo",
};
export const PIVOT_POINTS_META: SeriesMeta = {
  kind: "pivotPoints",
  overlay: true,
  label: "Pivot",
};
export const FRACTALS_META: SeriesMeta = { kind: "fractals", overlay: true, label: "Fractals" };
export const GAP_ANALYSIS_META: SeriesMeta = {
  kind: "gapAnalysis",
  overlay: false,
  label: "Gap",
};
export const ORB_META: SeriesMeta = { kind: "openingRange", overlay: true, label: "ORB" };
export const FVG_META: SeriesMeta = { kind: "fairValueGap", overlay: true, label: "FVG" };

// ============================================
// Wyckoff
// ============================================

export const VSA_META: SeriesMeta = { kind: "vsa", overlay: false, label: "VSA" };

// ============================================
// SMC
// ============================================

export const ORDER_BLOCK_META: SeriesMeta = {
  kind: "orderBlock",
  overlay: true,
  label: "Order Block",
};
export const LIQUIDITY_SWEEP_META: SeriesMeta = {
  kind: "liquiditySweep",
  overlay: false,
  label: "Liq Sweep",
};

// ============================================
// Regime
// ============================================

export const HMM_REGIME_META: SeriesMeta = {
  kind: "hmmRegimes",
  overlay: false,
  label: "HMM Regime",
};

// ============================================
// Adaptive
// ============================================

export const ADAPTIVE_RSI_META: SeriesMeta = {
  kind: "adaptiveRsi",
  overlay: false,
  label: "Adaptive RSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const ADAPTIVE_MA_META: SeriesMeta = {
  kind: "adaptiveMa",
  overlay: true,
  label: "Adaptive MA",
};
export const ADAPTIVE_BB_META: SeriesMeta = {
  kind: "adaptiveBollinger",
  overlay: true,
  label: "Adaptive BB",
};
export const ADAPTIVE_STOCH_META: SeriesMeta = {
  kind: "adaptiveStochastics",
  overlay: false,
  label: "Adaptive Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};

// ============================================
// Additional Volatility
// ============================================

export const STD_DEV_META: SeriesMeta = {
  kind: "standardDeviation",
  overlay: false,
  label: "StdDev",
};
export const VOL_REGIME_META: SeriesMeta = {
  kind: "volatilityRegime",
  overlay: false,
  label: "Vol Regime",
};

// ============================================
// Additional Trend
// ============================================

export const LINEAR_REG_META: SeriesMeta = {
  kind: "linearRegression",
  overlay: true,
  label: "LinReg",
};

// ============================================
// Additional Volume
// ============================================

export const VOLUME_MA_META: SeriesMeta = { kind: "volumeMa", overlay: false, label: "Vol MA" };
export const CVD_SIGNAL_META: SeriesMeta = {
  kind: "cvdWithSignal",
  overlay: false,
  label: "CVD Signal",
};

// ============================================
// Additional Momentum
// ============================================

export const FAST_STOCH_META: SeriesMeta = {
  kind: "fastStochastics",
  overlay: false,
  label: "Fast Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const SLOW_STOCH_META: SeriesMeta = {
  kind: "slowStochastics",
  overlay: false,
  label: "Slow Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};

// ============================================
// Additional Price
// ============================================

export const HEIKIN_ASHI_META: SeriesMeta = {
  kind: "heikinAshi",
  overlay: true,
  label: "Heikin-Ashi",
};
export const SWING_POINTS_META: SeriesMeta = {
  kind: "swingPoints",
  overlay: true,
  label: "Swing Points",
};
export const ZIGZAG_META: SeriesMeta = { kind: "zigzag", overlay: true, label: "Zigzag" };

// ============================================
// Session
// ============================================

export const SESSION_BREAKOUT_META: SeriesMeta = {
  kind: "sessionBreakout",
  overlay: true,
  label: "Session BO",
};
