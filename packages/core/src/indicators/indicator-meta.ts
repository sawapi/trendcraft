/**
 * Indicator Metadata Constants
 *
 * Single source of truth for indicator domain metadata (label, overlay,
 * yRange, referenceLines). Used by both batch functions (via tagSeries)
 * and live presets (via livePresets).
 *
 * These describe the DATA nature of each indicator, NOT visual styling.
 * Visual config (colors, lineWidth) belongs in the chart package.
 */

import type { SeriesMeta } from "../types/candle";

// ============================================
// Moving Averages
// ============================================

export const SMA_META: SeriesMeta = { overlay: true, label: "SMA" };
export const EMA_META: SeriesMeta = { overlay: true, label: "EMA" };
export const WMA_META: SeriesMeta = { overlay: true, label: "WMA" };
export const VWMA_META: SeriesMeta = { overlay: true, label: "VWMA" };
export const KAMA_META: SeriesMeta = { overlay: true, label: "KAMA" };
export const HMA_META: SeriesMeta = { overlay: true, label: "HMA" };
export const T3_META: SeriesMeta = { overlay: true, label: "T3" };
export const MCGINLEY_META: SeriesMeta = { overlay: true, label: "McGinley" };
export const EMA_RIBBON_META: SeriesMeta = { overlay: true, label: "EMA Ribbon" };
export const DEMA_META: SeriesMeta = { overlay: true, label: "DEMA" };
export const TEMA_META: SeriesMeta = { overlay: true, label: "TEMA" };
export const ZLEMA_META: SeriesMeta = { overlay: true, label: "ZLEMA" };
export const ALMA_META: SeriesMeta = { overlay: true, label: "ALMA" };
export const FRAMA_META: SeriesMeta = { overlay: true, label: "FRAMA" };

// ============================================
// Momentum
// ============================================

export const RSI_META: SeriesMeta = {
  overlay: false,
  label: "RSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const MACD_META: SeriesMeta = { overlay: false, label: "MACD" };
export const STOCHASTICS_META: SeriesMeta = {
  overlay: false,
  label: "Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const DMI_META: SeriesMeta = { overlay: false, label: "DMI", yRange: [0, 100] };
export const ROC_META: SeriesMeta = { overlay: false, label: "ROC", referenceLines: [0] };
export const WILLIAMS_R_META: SeriesMeta = {
  overlay: false,
  label: "Williams %R",
  yRange: [-100, 0],
  referenceLines: [-20, -80],
};
export const CCI_META: SeriesMeta = { overlay: false, label: "CCI", referenceLines: [100, -100] };
export const STOCH_RSI_META: SeriesMeta = {
  overlay: false,
  label: "StochRSI",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const TRIX_META: SeriesMeta = { overlay: false, label: "TRIX", referenceLines: [0] };
export const AROON_META: SeriesMeta = { overlay: false, label: "Aroon", yRange: [0, 100] };
export const CONNORS_RSI_META: SeriesMeta = {
  overlay: false,
  label: "CRSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const CMO_META: SeriesMeta = {
  overlay: false,
  label: "CMO",
  yRange: [-100, 100],
  referenceLines: [50, -50],
};
export const ADXR_META: SeriesMeta = { overlay: false, label: "ADXR", yRange: [0, 100] };
export const IMI_META: SeriesMeta = {
  overlay: false,
  label: "IMI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const VORTEX_META: SeriesMeta = { overlay: false, label: "Vortex" };
export const AO_META: SeriesMeta = { overlay: false, label: "AO", referenceLines: [0] };
export const BOP_META: SeriesMeta = {
  overlay: false,
  label: "BOP",
  yRange: [-1, 1],
  referenceLines: [0],
};
export const COPPOCK_META: SeriesMeta = { overlay: false, label: "Coppock", referenceLines: [0] };
export const DPO_META: SeriesMeta = { overlay: false, label: "DPO", referenceLines: [0] };
export const HURST_META: SeriesMeta = {
  overlay: false,
  label: "Hurst",
  yRange: [0, 1],
  referenceLines: [0.5],
};
export const KST_META: SeriesMeta = { overlay: false, label: "KST", referenceLines: [0] };
export const MASS_INDEX_META: SeriesMeta = {
  overlay: false,
  label: "Mass Index",
  referenceLines: [27, 26.5],
};
export const PPO_META: SeriesMeta = { overlay: false, label: "PPO", referenceLines: [0] };
export const QSTICK_META: SeriesMeta = { overlay: false, label: "QStick", referenceLines: [0] };
export const TSI_META: SeriesMeta = { overlay: false, label: "TSI", referenceLines: [0] };
export const UO_META: SeriesMeta = {
  overlay: false,
  label: "UO",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const STC_META: SeriesMeta = {
  overlay: false,
  label: "STC",
  yRange: [0, 100],
  referenceLines: [25, 75],
};

// ============================================
// Volatility
// ============================================

export const ATR_META: SeriesMeta = { overlay: false, label: "ATR" };
export const BB_META: SeriesMeta = { overlay: true, label: "BB" };
export const DONCHIAN_META: SeriesMeta = { overlay: true, label: "Donchian" };
export const KELTNER_META: SeriesMeta = { overlay: true, label: "Keltner" };
export const CHANDELIER_EXIT_META: SeriesMeta = { overlay: true, label: "Chandelier Exit" };
export const CHOPPINESS_META: SeriesMeta = {
  overlay: false,
  label: "Chop",
  yRange: [0, 100],
  referenceLines: [38.2, 61.8],
};
export const EWMA_VOL_META: SeriesMeta = { overlay: false, label: "EWMA Vol" };
export const GARMAN_KLASS_META: SeriesMeta = { overlay: false, label: "GK Vol" };
export const HV_META: SeriesMeta = { overlay: false, label: "HV" };
export const ATR_STOPS_META: SeriesMeta = { overlay: true, label: "ATR Stops" };
export const ULCER_META: SeriesMeta = { overlay: false, label: "Ulcer" };

// ============================================
// Trend
// ============================================

export const SUPERTREND_META: SeriesMeta = { overlay: true, label: "Supertrend" };
export const PARABOLIC_SAR_META: SeriesMeta = { overlay: true, label: "Parabolic SAR" };
export const ICHIMOKU_META: SeriesMeta = { overlay: true, label: "Ichimoku" };

// ============================================
// Volume
// ============================================

export const OBV_META: SeriesMeta = { overlay: false, label: "OBV" };
export const CMF_META: SeriesMeta = {
  overlay: false,
  label: "CMF",
  yRange: [-1, 1],
  referenceLines: [0],
};
export const MFI_META: SeriesMeta = {
  overlay: false,
  label: "MFI",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const VWAP_META: SeriesMeta = { overlay: true, label: "VWAP" };
export const ADL_META: SeriesMeta = { overlay: false, label: "ADL" };
export const TWAP_META: SeriesMeta = { overlay: true, label: "TWAP" };
export const ELDER_FORCE_INDEX_META: SeriesMeta = {
  overlay: false,
  label: "EFI",
  referenceLines: [0],
};
export const VOLUME_ANOMALY_META: SeriesMeta = { overlay: false, label: "Vol Anomaly" };
export const KLINGER_META: SeriesMeta = { overlay: false, label: "Klinger", referenceLines: [0] };
export const PVT_META: SeriesMeta = { overlay: false, label: "PVT" };
export const NVI_META: SeriesMeta = { overlay: false, label: "NVI" };
export const CVD_META: SeriesMeta = { overlay: false, label: "CVD" };
export const WEIS_WAVE_META: SeriesMeta = { overlay: false, label: "Weis Wave" };
export const ANCHORED_VWAP_META: SeriesMeta = { overlay: true, label: "AVWAP" };
export const EMV_META: SeriesMeta = { overlay: false, label: "EMV", referenceLines: [0] };
export const VOLUME_TREND_META: SeriesMeta = { overlay: false, label: "Vol Trend" };

// ============================================
// Price
// ============================================

export const HIGHEST_LOWEST_META: SeriesMeta = { overlay: true, label: "HiLo" };
export const PIVOT_POINTS_META: SeriesMeta = { overlay: true, label: "Pivot" };
export const FRACTALS_META: SeriesMeta = { overlay: true, label: "Fractals" };
export const GAP_ANALYSIS_META: SeriesMeta = { overlay: false, label: "Gap" };
export const ORB_META: SeriesMeta = { overlay: true, label: "ORB" };
export const FVG_META: SeriesMeta = { overlay: true, label: "FVG" };

// ============================================
// Wyckoff
// ============================================

export const VSA_META: SeriesMeta = { overlay: false, label: "VSA" };

// ============================================
// SMC
// ============================================

export const ORDER_BLOCK_META: SeriesMeta = { overlay: true, label: "Order Block" };
export const LIQUIDITY_SWEEP_META: SeriesMeta = { overlay: false, label: "Liq Sweep" };

// ============================================
// Regime
// ============================================

export const HMM_REGIME_META: SeriesMeta = { overlay: false, label: "HMM Regime" };

// ============================================
// Adaptive
// ============================================

export const ADAPTIVE_RSI_META: SeriesMeta = {
  overlay: false,
  label: "Adaptive RSI",
  yRange: [0, 100],
  referenceLines: [30, 70],
};
export const ADAPTIVE_MA_META: SeriesMeta = { overlay: true, label: "Adaptive MA" };
export const ADAPTIVE_BB_META: SeriesMeta = { overlay: true, label: "Adaptive BB" };
export const ADAPTIVE_STOCH_META: SeriesMeta = {
  overlay: false,
  label: "Adaptive Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};

// ============================================
// Additional Volatility
// ============================================

export const STD_DEV_META: SeriesMeta = { overlay: false, label: "StdDev" };
export const VOL_REGIME_META: SeriesMeta = { overlay: false, label: "Vol Regime" };

// ============================================
// Additional Trend
// ============================================

export const LINEAR_REG_META: SeriesMeta = { overlay: true, label: "LinReg" };

// ============================================
// Additional Volume
// ============================================

export const VOLUME_MA_META: SeriesMeta = { overlay: false, label: "Vol MA" };
export const CVD_SIGNAL_META: SeriesMeta = { overlay: false, label: "CVD Signal" };
export const MARKET_PROFILE_META: SeriesMeta = { overlay: true, label: "Market Profile" };

// ============================================
// Additional Momentum
// ============================================

export const FAST_STOCH_META: SeriesMeta = {
  overlay: false,
  label: "Fast Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};
export const SLOW_STOCH_META: SeriesMeta = {
  overlay: false,
  label: "Slow Stoch",
  yRange: [0, 100],
  referenceLines: [20, 80],
};

// ============================================
// Additional Price
// ============================================

export const HEIKIN_ASHI_META: SeriesMeta = { overlay: true, label: "Heikin-Ashi" };
export const SWING_POINTS_META: SeriesMeta = { overlay: true, label: "Swing Points" };
export const ZIGZAG_META: SeriesMeta = { overlay: true, label: "Zigzag" };

// ============================================
// Session
// ============================================

export const SESSION_BREAKOUT_META: SeriesMeta = { overlay: true, label: "Session BO" };
