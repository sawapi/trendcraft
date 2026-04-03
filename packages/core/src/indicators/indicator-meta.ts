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

// ============================================
// Regime
// ============================================

export const HMM_REGIME_META: SeriesMeta = { overlay: false, label: "HMM Regime" };
