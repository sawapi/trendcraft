/**
 * TrendCraft Presets — Opt-in introspection rules and visual configuration
 * for TrendCraft-specific indicator shapes.
 *
 * Generic shapes (band, macd, oscillator, number, etc.) are handled by
 * the chart core. These presets add support for TrendCraft-specific output
 * formats like Klinger {kvo, signal, histogram}, Connors RSI {crsi, ...}, etc.
 *
 * @example
 * ```ts
 * import { createChart } from "@trendcraft/chart";
 * import { registerTrendCraftPresets } from "@trendcraft/chart/presets";
 *
 * const chart = createChart(el, { theme: "dark" });
 * registerTrendCraftPresets(chart);
 * chart.addIndicator(klinger(candles)); // Now auto-detected & rendered
 * ```
 */

import type { IntrospectionRule } from "./core/series-registry";
import type { ChartInstance } from "./core/types";
import type { IndicatorPreset } from "./integration/indicator-presets";

// ============================================
// Helpers
// ============================================

function hasKeys(value: unknown, keys: string[]): value is Record<string, number | null> {
  if (typeof value !== "object" || value === null) return false;
  return keys.every((k) => k in value);
}

// ============================================
// TrendCraft-specific Introspection Rules
// ============================================

const TRENDCRAFT_RULES: IntrospectionRule[] = [
  // EMA Ribbon (values array + bullish/expanding flags)
  {
    name: "emaRibbon",
    test: (v) =>
      hasKeys(v, ["values", "bullish"]) && Array.isArray((v as Record<string, unknown>).values),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      const vals = v.values as (number | null)[];
      const result: Record<string, number | null> = {};
      for (let i = 0; i < vals.length; i++) {
        result[`ema${i + 1}`] = vals[i];
      }
      return result;
    },
  },

  // PPO (ppo + signal + histogram — MACD-like)
  {
    name: "ppo",
    test: (v) => hasKeys(v, ["ppo", "signal", "histogram"]),
    seriesType: "histogram",
    defaultPane: "sub",
    decompose: (v) => ({ ppo: v.ppo, signal: v.signal, histogram: v.histogram }),
  },

  // Connors RSI (crsi + 3 components)
  {
    name: "connorsRsi",
    test: (v) => hasKeys(v, ["crsi", "streakRsi", "rocPercentile"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({
      crsi: v.crsi,
      rsi: v.rsi,
      streakRsi: v.streakRsi,
      rocPercentile: v.rocPercentile,
    }),
  },

  // Vortex (viPlus + viMinus)
  {
    name: "vortex",
    test: (v) => hasKeys(v, ["viPlus", "viMinus"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ viPlus: v.viPlus, viMinus: v.viMinus }),
  },

  // TRIX (trix + signal)
  {
    name: "trix",
    test: (v) => hasKeys(v, ["trix", "signal"]) && !hasKeys(v, ["histogram"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ trix: v.trix, signal: v.signal }),
  },

  // TSI (tsi + signal)
  {
    name: "tsi",
    test: (v) => hasKeys(v, ["tsi", "signal"]) && !hasKeys(v, ["histogram"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ tsi: v.tsi, signal: v.signal }),
  },

  // KST (kst + signal)
  {
    name: "kst",
    test: (v) => hasKeys(v, ["kst", "signal"]) && !hasKeys(v, ["histogram"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ kst: v.kst, signal: v.signal }),
  },

  // ATR Stops (long/short stop + TP levels)
  {
    name: "atrStops",
    test: (v) => hasKeys(v, ["longStopLevel", "shortStopLevel", "longTakeProfitLevel"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({
      longStop: v.longStopLevel,
      shortStop: v.shortStopLevel,
      longTP: v.longTakeProfitLevel,
      shortTP: v.shortTakeProfitLevel,
    }),
  },

  // Fractals (up/down fractal price markers)
  {
    name: "fractals",
    test: (v) => hasKeys(v, ["upFractal", "downFractal", "upPrice", "downPrice"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ upPrice: v.upPrice, downPrice: v.downPrice }),
  },

  // Gap Analysis (gap percentage)
  {
    name: "gapAnalysis",
    test: (v) => hasKeys(v, ["gapPercent", "classification", "filled"]),
    seriesType: "histogram",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.gapPercent }),
  },

  // Opening Range Breakout (high/low levels)
  {
    name: "openingRange",
    test: (v) => hasKeys(v, ["high", "low", "breakout"]) && !hasKeys(v, ["open"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ high: v.high, low: v.low }),
  },

  // Fair Value Gap — rendered as box zones on main chart
  {
    name: "fairValueGap",
    test: (v) => hasKeys(v, ["newBullishFvg", "activeBullishFvgs"]),
    seriesType: "box",
    defaultPane: "main",
    decompose: () => ({}),
  },

  // VSA (spread + volume relative analysis)
  {
    name: "vsa",
    test: (v) => hasKeys(v, ["barType", "spreadRelative", "volumeRelative"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ spread: v.spreadRelative, volume: v.volumeRelative }),
  },

  // VWAP band (vwap + upper + lower, no "middle")
  {
    name: "vwapBand",
    test: (v) => hasKeys(v, ["vwap", "upper", "lower"]),
    seriesType: "band",
    defaultPane: "main",
    decompose: (v) => ({ upper: v.upper, middle: v.vwap, lower: v.lower }),
  },

  // Klinger (kvo + signal + histogram)
  {
    name: "klinger",
    test: (v) => hasKeys(v, ["kvo", "signal", "histogram"]),
    seriesType: "histogram",
    defaultPane: "sub",
    decompose: (v) => ({ kvo: v.kvo, signal: v.signal, histogram: v.histogram }),
  },

  // Volume Anomaly (ratio, isAnomaly, zScore)
  {
    name: "volumeAnomaly",
    test: (v) => hasKeys(v, ["ratio", "isAnomaly"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.ratio }),
  },

  // Weis Wave (waveVolume + direction)
  {
    name: "weisWave",
    test: (v) => hasKeys(v, ["waveVolume", "direction"]),
    seriesType: "histogram",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.waveVolume }),
  },

  // Volume Trend (confidence score)
  {
    name: "volumeTrend",
    test: (v) => hasKeys(v, ["isConfirmed", "hasDivergence", "confidence"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.confidence }),
  },

  // Single VWAP (anchored VWAP with no bands)
  {
    name: "singleVwap",
    test: (v) => hasKeys(v, ["vwap"]) && !hasKeys(v, ["upper"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.vwap }),
  },

  // CVD with Signal ({cvd, signal} without histogram)
  {
    name: "cvdSignal",
    test: (v) =>
      hasKeys(v, ["cvd", "signal"]) && !hasKeys(v, ["histogram"]) && !hasKeys(v, ["kvo"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ cvd: v.cvd, signal: v.signal }),
  },

  // Linear Regression ({value, slope, rSquared})
  {
    name: "linearRegression",
    test: (v) => hasKeys(v, ["value", "slope", "rSquared"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.value }),
  },

  // Adaptive RSI ({rsi, effectivePeriod, volatilityPercentile})
  {
    name: "adaptiveRsi",
    test: (v) => hasKeys(v, ["rsi", "effectivePeriod", "volatilityPercentile"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.rsi }),
  },

  // Adaptive MA ({value, efficiencyRatio, smoothingConstant})
  {
    name: "adaptiveMa",
    test: (v) => hasKeys(v, ["efficiencyRatio", "smoothingConstant"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.value }),
  },

  // Heikin-Ashi ({open, high, low, close, trend}) — distinguish from candles by trend key
  {
    name: "heikinAshi",
    test: (v) => hasKeys(v, ["open", "high", "low", "close", "trend"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.close }),
  },

  // Swing Points ({isSwingHigh, isSwingLow, swingHighPrice, swingLowPrice})
  {
    name: "swingPoints",
    test: (v) => hasKeys(v, ["isSwingHigh", "isSwingLow", "swingHighPrice"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ high: v.swingHighPrice, low: v.swingLowPrice }),
  },

  // Zigzag ({point, price, changePercent})
  {
    name: "zigzag",
    test: (v) => hasKeys(v, ["point", "price", "changePercent"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.price }),
  },

  // Session Breakout ({fromSession, breakout, rangeHigh, rangeLow})
  {
    name: "sessionBreakout",
    test: (v) => hasKeys(v, ["fromSession", "rangeHigh", "rangeLow"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ high: v.rangeHigh, low: v.rangeLow }),
  },

  // Order Block ({newOrderBlock, activeOrderBlocks}) — box zones like FVG
  {
    name: "orderBlock",
    test: (v) => hasKeys(v, ["newOrderBlock", "activeOrderBlocks"]),
    seriesType: "box",
    defaultPane: "main",
    decompose: () => ({}),
  },

  // Liquidity Sweep ({isSweep, recentSweeps})
  {
    name: "liquiditySweep",
    test: (v) => hasKeys(v, ["isSweep", "recentSweeps"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({
      value: Array.isArray(v.recentSweeps) ? v.recentSweeps.length : 0,
    }),
  },

  // Volatility Regime ({regime, atrPercentile, bandwidthPercentile})
  {
    name: "volatilityRegime",
    test: (v) => hasKeys(v, ["regime", "atrPercentile", "bandwidthPercentile"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.atrPercentile }),
  },

  // Market Profile ({poc, valueAreaHigh, valueAreaLow, profile})
  {
    name: "marketProfile",
    test: (v) => hasKeys(v, ["poc", "valueAreaHigh", "valueAreaLow"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ poc: v.poc, vah: v.valueAreaHigh, val: v.valueAreaLow }),
  },
];

// ============================================
// TrendCraft-specific Visual Presets
// ============================================

const TRENDCRAFT_PRESETS: [string, IndicatorPreset][] = [
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
  [
    "fractals",
    {
      pane: "main",
      label: "Fractals",
      channelColors: { upPrice: "#ef5350", downPrice: "#26a69a" },
    },
  ],
  [
    "vsa",
    {
      pane: "sub",
      label: "VSA",
      channelColors: { spread: "#2196F3", volume: "#FF9800" },
      referenceLines: [1],
    },
  ],
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
  [
    "vortex",
    {
      pane: "sub",
      label: "Vortex",
      channelColors: { viPlus: "#26a69a", viMinus: "#ef5350" },
    },
  ],
  [
    "trix",
    {
      pane: "sub",
      label: "TRIX",
      channelColors: { trix: "#2196F3", signal: "#FF9800" },
      referenceLines: [0],
    },
  ],
  [
    "tsi",
    {
      pane: "sub",
      label: "TSI",
      channelColors: { tsi: "#2196F3", signal: "#FF9800" },
      referenceLines: [0],
    },
  ],
  [
    "kst",
    {
      pane: "sub",
      label: "KST",
      channelColors: { kst: "#2196F3", signal: "#FF9800" },
      referenceLines: [0],
    },
  ],
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
  // ---- Single-value indicator colors (keyed by indicator ID for connectIndicators) ----

  // Momentum
  ["rsi", { color: "#FF9800" }],
  ["cci", { color: "#e91e63" }],
  ["roc", { color: "#9c27b0" }],
  ["williamsR", { color: "#673ab7" }],
  ["cmo", { color: "#ff5722" }],
  ["adxr", { color: "#ff9800" }],
  ["imi", { color: "#f44336" }],
  ["hurst", { color: "#795548" }],
  ["stc", { color: "#607d8b" }],
  ["ao", { color: "#00bcd4" }],
  ["bop", { color: "#8bc34a" }],
  ["qstick", { color: "#3f51b5" }],
  ["coppock", { color: "#009688" }],
  ["massIndex", { color: "#795548" }],
  ["dpo", { color: "#607d8b" }],
  ["ultimateOscillator", { color: "#e91e63" }],

  // Volatility
  ["atr", { color: "#ff5722" }],
  ["choppiness", { color: "#9c27b0" }],
  ["hv", { color: "#607d8b" }],
  ["garmanKlass", { color: "#795548" }],
  ["ulcer", { color: "#e91e63" }],

  // Volume
  ["obv", { color: "#26a69a" }],
  ["cmf", { color: "#00bcd4" }],
  ["mfi", { color: "#ff9800" }],
  ["adl", { color: "#8bc34a" }],
  ["elderForceIndex", { color: "#673ab7" }],
  ["pvt", { color: "#009688" }],
  ["nvi", { color: "#3f51b5" }],
  ["cvd", { color: "#e91e63" }],
  ["emv", { color: "#ff5722" }],

  // Moving Averages (distinct colors for common overlay combinations)
  ["sma", { color: "#2196F3" }],
  ["ema", { color: "#FF9800" }],
  ["wma", { color: "#26a69a" }],
  ["vwma", { color: "#9c27b0" }],
  ["kama", { color: "#ef5350" }],
  ["hma", { color: "#00bcd4" }],
  ["t3", { color: "#8bc34a" }],
  ["mcginley", { color: "#ff5722" }],
  ["dema", { color: "#e91e63" }],
  ["tema", { color: "#673ab7" }],
  ["zlema", { color: "#607d8b" }],
  ["alma", { color: "#795548" }],
  ["frama", { color: "#3f51b5" }],

  // Adaptive
  ["adaptiveRsi", { color: "#ff9800" }],
  ["adaptiveMa", { color: "#00bcd4" }],
  ["adaptiveStochastics", { color: "#9c27b0" }],

  // Additional Volatility
  ["standardDeviation", { color: "#795548" }],
  ["ewmaVol", { color: "#607d8b" }],
  ["volatilityRegime", { color: "#9c27b0" }],

  // Additional Trend
  ["linearRegression", { color: "#ff5722" }],

  // Additional Volume
  ["volumeMa", { color: "#26a69a" }],
  ["cvdWithSignal", { channelColors: { cvd: "#2196F3", signal: "#FF9800" } }],
  ["marketProfile", { channelColors: { poc: "#FF9800", vah: "#ef5350", val: "#26a69a" } }],

  // Additional Momentum
  ["fastStochastics", { color: "#2196F3" }],
  ["slowStochastics", { color: "#FF9800" }],

  // Additional Price
  ["heikinAshi", { color: "#8bc34a" }],
  ["swingPoints", { channelColors: { high: "#ef5350", low: "#26a69a" } }],
  ["zigzag", { color: "#FF9800" }],

  // Session
  ["sessionBreakout", { channelColors: { high: "#ef5350", low: "#26a69a" } }],

  // SMC
  ["liquiditySweep", { color: "#e91e63" }],
];

// ============================================
// Public API
// ============================================

/**
 * Register TrendCraft-specific introspection rules and visual presets.
 *
 * Call once after creating a chart to enable auto-detection and optimized
 * rendering of all TrendCraft indicator shapes.
 *
 * Without this, the chart still renders generic shapes (band, macd, oscillator,
 * number, etc.) but TrendCraft-specific shapes (klinger, connorsRsi, vsa, etc.)
 * won't be auto-detected.
 */
export function registerTrendCraftPresets(chart: ChartInstance): void {
  for (const rule of TRENDCRAFT_RULES) {
    chart.addRule(rule);
  }
  for (const [name, preset] of TRENDCRAFT_PRESETS) {
    chart.addPreset(name, preset);
  }
}
