/**
 * Indicator Presets — Default visual configuration for known TrendCraft indicators.
 *
 * This file maps known introspection rule names to recommended colors,
 * pane placements, labels, and line widths. It is optional: unknown
 * indicators still render via introspection with default styling.
 */

import type { SeriesType } from "../core/types";

export type IndicatorPreset = {
  /** Visual series type override */
  seriesType?: SeriesType;
  /** Default pane placement */
  pane?: "main" | "new";
  /** Primary color */
  color?: string;
  /** Line width */
  lineWidth?: number;
  /** Display label */
  label?: string;
  /** Multi-channel color map (e.g., { upper: '#color', lower: '#color' }) */
  channelColors?: Record<string, string>;
  /** Fixed Y-range for subchart panes */
  yRange?: [number, number];
  /** Reference lines */
  referenceLines?: number[];
};

/** Preset map keyed by introspection rule name */
export const INDICATOR_PRESETS = new Map<string, IndicatorPreset>([
  // Band types
  [
    "band",
    {
      pane: "main",
      label: "Bollinger Bands",
      channelColors: {
        upper: "#2196F3",
        middle: "#FF9800",
        lower: "#2196F3",
      },
      lineWidth: 1,
    },
  ],

  // Ichimoku
  [
    "ichimoku",
    {
      pane: "main",
      label: "Ichimoku",
      channelColors: {
        tenkan: "#0496ff",
        kijun: "#991515",
        senkouA: "rgba(76,175,80,0.4)",
        senkouB: "rgba(244,67,54,0.4)",
        chikou: "#9c27b0",
      },
      lineWidth: 1,
    },
  ],

  // MACD
  [
    "macd",
    {
      pane: "new",
      label: "MACD",
      channelColors: {
        macd: "#2196F3",
        signal: "#FF9800",
        histogram: "#26a69a",
      },
    },
  ],

  // DMI
  [
    "dmi",
    {
      pane: "new",
      label: "DMI",
      channelColors: {
        adx: "#FF9800",
        plusDi: "#26a69a",
        minusDi: "#ef5350",
      },
      yRange: [0, 100],
    },
  ],

  // Stochastics
  [
    "oscillator",
    {
      pane: "new",
      label: "Stochastics",
      channelColors: {
        k: "#2196F3",
        d: "#FF9800",
      },
      yRange: [0, 100],
      referenceLines: [20, 80],
    },
  ],

  // Aroon
  [
    "aroon",
    {
      pane: "new",
      label: "Aroon",
      channelColors: {
        up: "#26a69a",
        down: "#ef5350",
      },
      yRange: [0, 100],
    },
  ],

  // Supertrend
  [
    "supertrend",
    {
      pane: "main",
      label: "Supertrend",
      channelColors: {
        upperBand: "#ef5350",
        lowerBand: "#26a69a",
      },
    },
  ],

  // Parabolic SAR
  [
    "parabolicSar",
    {
      pane: "main",
      label: "Parabolic SAR",
      color: "#FF9800",
    },
  ],

  // Pivot Points
  [
    "pivotPoints",
    {
      pane: "main",
      label: "Pivot Points",
      channelColors: {
        pivot: "#FF9800",
        r1: "#ef5350",
        r2: "#ef5350",
        s1: "#26a69a",
        s2: "#26a69a",
      },
      lineWidth: 1,
    },
  ],

  // HMM Regime
  [
    "hmmRegime",
    {
      pane: "new",
      label: "Regime",
      color: "#9c27b0",
    },
  ],

  // Simple number (RSI, CCI, ATR, etc.) — default for scalar series
  [
    "number",
    {
      pane: "new",
      label: "Indicator",
      color: "#2196F3",
      lineWidth: 1.5,
    },
  ],
]);
