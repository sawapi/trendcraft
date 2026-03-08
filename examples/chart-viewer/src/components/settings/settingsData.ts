/**
 * Settings configuration data for the Indicator Settings Dialog
 */

import type { DisplayStartYears, OverlayType, SignalType, SubChartType } from "../../types";

/**
 * Props for the IndicatorSettingsDialog component
 */
export interface IndicatorSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Tab types for the settings dialog
 */
export type TabType = "overlay" | "subchart" | "signals" | "display";

/**
 * Display start years options
 */
export const DISPLAY_START_YEARS_OPTIONS: { value: DisplayStartYears; label: string }[] = [
  { value: null, label: "All Data" },
  { value: 5, label: "Last 5 Years" },
  { value: 10, label: "Last 10 Years" },
  { value: 20, label: "Last 20 Years" },
];

/**
 * Overlay option groups
 */
export const OVERLAY_GROUPS: { group: string; options: { key: OverlayType; label: string }[] }[] = [
  {
    group: "Moving Averages",
    options: [
      { key: "sma5", label: "SMA 5" },
      { key: "sma25", label: "SMA 25" },
      { key: "sma75", label: "SMA 75" },
      { key: "ema12", label: "EMA 12" },
      { key: "ema26", label: "EMA 26" },
      { key: "wma20", label: "WMA 20" },
      { key: "vwma20", label: "VWMA 20" },
      { key: "kama", label: "KAMA" },
      { key: "t3", label: "T3" },
    ],
  },
  {
    group: "Filter",
    options: [{ key: "superSmoother", label: "Super Smoother" }],
  },
  {
    group: "Bands / Channels",
    options: [
      { key: "bb", label: "Bollinger Bands" },
      { key: "donchian", label: "Donchian Channel" },
      { key: "keltner", label: "Keltner Channel" },
    ],
  },
  {
    group: "Trend",
    options: [
      { key: "ichimoku", label: "Ichimoku" },
      { key: "supertrend", label: "Supertrend" },
      { key: "psar", label: "Parabolic SAR" },
      { key: "chandelierExit", label: "Chandelier Exit" },
    ],
  },
  {
    group: "Volume",
    options: [{ key: "vwap", label: "VWAP" }],
  },
  {
    group: "Volatility",
    options: [{ key: "atrStops", label: "ATR Stops" }],
  },
  {
    group: "Price",
    options: [
      { key: "heikinAshi", label: "Heikin-Ashi" },
      { key: "swingPoints", label: "Swing Points" },
      { key: "pivotPoints", label: "Pivot Points" },
      { key: "fibonacci", label: "Fibonacci Retracement" },
      { key: "fibExtension", label: "Fibonacci Extension" },
      { key: "highestLowest", label: "Highest/Lowest" },
      { key: "autoTrendLine", label: "Auto Trend Line" },
      { key: "channelLine", label: "Channel Line" },
      { key: "andrewsPitchfork", label: "Andrew's Pitchfork" },
    ],
  },
  {
    group: "Patterns",
    options: [
      { key: "candlestickPatterns", label: "Candlestick Patterns" },
      { key: "fractals", label: "Fractals" },
      { key: "zigzag", label: "Zigzag" },
    ],
  },
  {
    group: "Smart Money (SMC)",
    options: [
      { key: "orderBlock", label: "Order Block" },
      { key: "fvg", label: "Fair Value Gap" },
      { key: "bos", label: "Break of Structure" },
      { key: "choch", label: "Change of Character" },
      { key: "liquiditySweep", label: "Liquidity Sweep" },
    ],
  },
];

/**
 * Signal options
 */
export const SIGNAL_OPTIONS: { key: SignalType; label: string; description: string }[] = [
  { key: "perfectOrder", label: "Perfect Order", description: "Trend detection by MA alignment" },
  { key: "rangeBound", label: "Range-Bound", description: "Sideways market detection" },
  { key: "cross", label: "GC/DC", description: "Golden/Death cross detection" },
  { key: "divergence", label: "Divergence", description: "RSI/MACD/OBV divergence detection" },
  {
    key: "bbSqueeze",
    label: "BB Squeeze",
    description: "Bollinger Band squeeze (breakout signal)",
  },
  { key: "volumeBreakout", label: "Volume Breakout", description: "Volume breaks N-period high" },
  { key: "volumeMaCross", label: "Volume MA Cross", description: "Short/Long volume MA cross" },
  {
    key: "chartPatterns",
    label: "Chart Patterns",
    description: "Double Top/Bottom, H&S, Cup & Handle",
  },
];

/**
 * Subchart indicator groups
 */
export const SUBCHART_GROUPS: { group: string; options: { key: SubChartType; label: string }[] }[] =
  [
    {
      group: "Momentum",
      options: [
        { key: "rsi", label: "RSI" },
        { key: "macd", label: "MACD" },
        { key: "stochastics", label: "Stochastics" },
        { key: "stochrsi", label: "Stochastic RSI" },
        { key: "cci", label: "CCI" },
        { key: "williams", label: "Williams %R" },
        { key: "roc", label: "ROC" },
        { key: "trix", label: "TRIX" },
        { key: "aroon", label: "Aroon" },
        { key: "dpo", label: "DPO" },
        { key: "hurst", label: "Hurst Exponent" },
      ],
    },
    {
      group: "Trend",
      options: [
        { key: "dmi", label: "DMI/ADX" },
        { key: "vortex", label: "Vortex" },
        { key: "rangebound", label: "Range-Bound" },
      ],
    },
    {
      group: "Filter",
      options: [{ key: "roofingFilter", label: "Roofing Filter" }],
    },
    {
      group: "Volatility",
      options: [
        { key: "atr", label: "ATR" },
        { key: "volatilityRegime", label: "Volatility Regime" },
      ],
    },
    {
      group: "Volume",
      options: [
        { key: "mfi", label: "MFI" },
        { key: "obv", label: "OBV" },
        { key: "cmf", label: "CMF" },
        { key: "volumeAnomaly", label: "Volume Anomaly" },
        { key: "volumeProfile", label: "Volume Profile" },
        { key: "volumeTrend", label: "Volume Trend" },
        { key: "adl", label: "ADL" },
      ],
    },
    {
      group: "Scoring",
      options: [{ key: "scoring", label: "Score" }],
    },
  ];

/**
 * Fundamentals group (only shown when CSV contains PER/PBR data)
 */
export const FUNDAMENTALS_GROUP: {
  group: string;
  options: { key: SubChartType; label: string }[];
} = {
  group: "Fundamentals",
  options: [
    { key: "per", label: "PER (Price-to-Earnings)" },
    { key: "pbr", label: "PBR (Price-to-Book)" },
    { key: "roe", label: "ROE (Return on Equity)" },
  ],
};
