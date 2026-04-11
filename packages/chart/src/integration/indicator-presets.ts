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
  pane?: "main" | "sub";
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
      pane: "sub",
      label: "MACD",
      channelColors: {
        macd: "#2196F3",
        signal: "#FF9800",
        histogramUp: "#26a69a",
        histogramDown: "#ef5350",
      },
    },
  ],

  // ATR Stops
  [
    "atrStops",
    {
      pane: "main",
      label: "ATR Stops",
      channelColors: {
        longStop: "#ef5350",
        shortStop: "#26a69a",
        longTP: "#66bb6a",
        shortTP: "#ffa726",
      },
      lineWidth: 1,
    },
  ],

  // Fractals
  [
    "fractals",
    {
      pane: "main",
      label: "Fractals",
      channelColors: {
        upPrice: "#ef5350",
        downPrice: "#26a69a",
      },
    },
  ],

  // VSA
  [
    "vsa",
    {
      pane: "sub",
      label: "VSA",
      channelColors: {
        spread: "#2196F3",
        volume: "#FF9800",
      },
      referenceLines: [1],
    },
  ],

  // PPO (MACD-like)
  [
    "ppo",
    {
      pane: "sub",
      label: "PPO",
      channelColors: {
        ppo: "#2196F3",
        signal: "#FF9800",
        histogramUp: "#26a69a",
        histogramDown: "#ef5350",
      },
    },
  ],

  // Connors RSI
  [
    "connorsRsi",
    {
      pane: "sub",
      label: "Connors RSI",
      channelColors: {
        crsi: "#2196F3",
        rsi: "#FF9800",
        streakRsi: "#26a69a",
        rocPercentile: "#9c27b0",
      },
      yRange: [0, 100],
      referenceLines: [20, 80],
    },
  ],

  // Vortex
  [
    "vortex",
    {
      pane: "sub",
      label: "Vortex",
      channelColors: {
        viPlus: "#26a69a",
        viMinus: "#ef5350",
      },
    },
  ],

  // TRIX
  [
    "trix",
    {
      pane: "sub",
      label: "TRIX",
      channelColors: {
        trix: "#2196F3",
        signal: "#FF9800",
      },
      referenceLines: [0],
    },
  ],

  // TSI
  [
    "tsi",
    {
      pane: "sub",
      label: "TSI",
      channelColors: {
        tsi: "#2196F3",
        signal: "#FF9800",
      },
      referenceLines: [0],
    },
  ],

  // KST
  [
    "kst",
    {
      pane: "sub",
      label: "KST",
      channelColors: {
        kst: "#2196F3",
        signal: "#FF9800",
      },
      referenceLines: [0],
    },
  ],

  // Klinger
  [
    "klinger",
    {
      pane: "sub",
      label: "Klinger",
      channelColors: {
        kvo: "#2196F3",
        signal: "#FF9800",
        histogramUp: "#26a69a",
        histogramDown: "#ef5350",
      },
    },
  ],

  // DMI
  [
    "dmi",
    {
      pane: "sub",
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
      pane: "sub",
      label: "Stochastics",
      channelColors: {
        k: "#2196F3",
        d: "#FF9800",
      },
      yRange: [0, 100],
      referenceLines: [20, 80],
    },
  ],

  // Stochastics (alias for live preset name "stochastics" → rule name "oscillator")
  [
    "stochastics",
    {
      pane: "sub",
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
      pane: "sub",
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
      pane: "sub",
      label: "Regime",
      color: "#9c27b0",
    },
  ],

  // Simple number (RSI, CCI, ATR, etc.) — default for scalar series
  [
    "number",
    {
      pane: "sub",
      label: "Indicator",
      color: "#2196F3",
      lineWidth: 1.5,
    },
  ],
]);
