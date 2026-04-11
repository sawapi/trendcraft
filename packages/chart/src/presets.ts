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
