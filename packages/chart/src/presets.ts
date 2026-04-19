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
    decompose: (v) => ({ value: v.crsi }),
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
    seriesType: "marker",
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
    // Decompose unused — heikinAshi renderer reads s.data directly
    decompose: () => ({}),
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
      color: "#2196F3",
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

  // Moving Averages — no fixed preset color. Multiple instances of the same
  // MA (e.g. SMA 5/20/60 as a ribbon) rely on the chart's auto-cycle palette
  // so each instance gets a distinct color. Users can always override via
  // SeriesConfig.color when they want a specific palette.

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

  // Filter (Ehlers)
  ["superSmoother", { pane: "main", color: "#4dd0e1", lineWidth: 1.5 }],
  ["roofingFilter", { pane: "sub", color: "#4dd0e1", referenceLines: [0] }],

  // Price utilities
  ["highest", { pane: "main", color: "#ef5350", lineWidth: 1 }],
  ["lowest", { pane: "main", color: "#26a69a", lineWidth: 1 }],
  ["returns", { pane: "sub", color: "#9575cd", referenceLines: [0] }],
  ["cumulativeReturns", { pane: "sub", color: "#7986cb" }],
  ["medianPrice", { pane: "main", color: "#ffb74d", lineWidth: 1 }],
  ["typicalPrice", { pane: "main", color: "#ba68c8", lineWidth: 1 }],
  ["weightedClose", { pane: "main", color: "#f06292", lineWidth: 1 }],

  // Volatility (additional)
  ["atrPercent", { pane: "sub", color: "#ff8a65" }],
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
  // Register custom renderers for TrendCraft-specific visualizations
  for (const renderer of TRENDCRAFT_RENDERERS) {
    chart.registerRenderer(renderer);
  }
}

// ============================================
// TrendCraft Custom Renderers
// ============================================

import { defineSeriesRenderer } from "./core/plugin-types";
import type { SeriesRenderContext } from "./core/plugin-types";
import type { SeriesRendererPlugin } from "./core/plugin-types";

const TRENDCRAFT_RENDERERS: SeriesRendererPlugin[] = [
  // FVG Zone Renderer
  defineSeriesRenderer({
    type: "fairValueGap",
    render: ({ ctx, series, timeScale, priceScale }: SeriesRenderContext) => {
      const data = series.data as { value: unknown }[];
      const lastIdx = Math.min(timeScale.endIndex - 1, data.length - 1);
      if (lastIdx < 0) return;
      const val = data[lastIdx]?.value as {
        activeBullishFvgs?: {
          high: number;
          low: number;
          startIndex: number;
          filled: boolean;
          filledIndex: number | null;
        }[];
        activeBearishFvgs?: {
          high: number;
          low: number;
          startIndex: number;
          filled: boolean;
          filledIndex: number | null;
        }[];
      } | null;
      if (!val) return;
      const allZones = [
        ...(val.activeBullishFvgs ?? []).map((z) => ({ ...z, type: "bullish" as const })),
        ...(val.activeBearishFvgs ?? []).map((z) => ({ ...z, type: "bearish" as const })),
      ];
      for (const zone of allZones) {
        const startX = timeScale.indexToX(zone.startIndex);
        const endX = timeScale.indexToX(
          zone.filled && zone.filledIndex != null ? zone.filledIndex : timeScale.endIndex,
        );
        const topY = priceScale.priceToY(zone.high);
        const bottomY = priceScale.priceToY(zone.low);
        const rgb = zone.type === "bullish" ? "38,166,154" : "239,83,80";
        const fillA = zone.filled ? 0.08 : 0.18;
        const borderA = zone.filled ? 0.25 : 0.6;
        ctx.fillStyle = `rgba(${rgb},${fillA})`;
        ctx.fillRect(startX, topY, endX - startX, bottomY - topY);
        ctx.strokeStyle = `rgba(${rgb},${borderA})`;
        ctx.lineWidth = 1;
        if (zone.filled) ctx.setLineDash([4, 3]);
        ctx.strokeRect(startX, topY, endX - startX, bottomY - topY);
        if (zone.filled) ctx.setLineDash([]);
      }
    },
    priceRange: () => [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }),

  // Order Block Zone Renderer
  defineSeriesRenderer({
    type: "orderBlock",
    render: ({ ctx, series, timeScale, priceScale }: SeriesRenderContext) => {
      const data = series.data as { value: unknown }[];
      const lastIdx = Math.min(timeScale.endIndex - 1, data.length - 1);
      if (lastIdx < 0) return;
      const val = data[lastIdx]?.value as {
        activeOrderBlocks?: {
          type: "bullish" | "bearish";
          high: number;
          low: number;
          startIndex: number;
        }[];
      } | null;
      if (!val?.activeOrderBlocks) return;
      for (const ob of val.activeOrderBlocks) {
        const startX = timeScale.indexToX(ob.startIndex);
        const endX = timeScale.indexToX(timeScale.endIndex);
        const topY = priceScale.priceToY(ob.high);
        const bottomY = priceScale.priceToY(ob.low);
        const rgb = ob.type === "bullish" ? "38,166,154" : "239,83,80";
        ctx.fillStyle = `rgba(${rgb},0.12)`;
        ctx.fillRect(startX, topY, endX - startX, bottomY - topY);
        ctx.strokeStyle = `rgba(${rgb},0.5)`;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, topY, endX - startX, bottomY - topY);
      }
    },
    priceRange: () => [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }),

  // Fractal ▲▼ Markers
  defineSeriesRenderer({
    type: "fractals",
    render: ({ ctx, series, timeScale, priceScale }: SeriesRenderContext) => {
      const data = series.data as { value: unknown }[];
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      const size = 5;
      const offset = 8;
      for (let i = start; i < end && i < data.length; i++) {
        const v = data[i]?.value as { upPrice?: number | null; downPrice?: number | null } | null;
        if (!v) continue;
        const x = timeScale.indexToX(i);
        if (v.upPrice != null) {
          const y = priceScale.priceToY(v.upPrice) - offset;
          ctx.fillStyle = "#ef5350";
          ctx.beginPath();
          ctx.moveTo(x, y + size);
          ctx.lineTo(x - size, y - size);
          ctx.lineTo(x + size, y - size);
          ctx.closePath();
          ctx.fill();
        }
        if (v.downPrice != null) {
          const y = priceScale.priceToY(v.downPrice) + offset;
          ctx.fillStyle = "#26a69a";
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x - size, y + size);
          ctx.lineTo(x + size, y + size);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    priceRange: () => [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }),

  // Heikin-Ashi Candle Overlay
  defineSeriesRenderer({
    type: "heikinAshi",
    render: ({ ctx, series, timeScale, priceScale, theme }: SeriesRenderContext) => {
      const data = series.data as { value: unknown }[];
      const start = timeScale.startIndex;
      const end = timeScale.endIndex;
      const bodyWidth = Math.max(1, timeScale.barSpacing * 0.6);
      const halfBody = bodyWidth / 2;
      const upColor = theme?.upColor ?? "#26a69a";
      const downColor = theme?.downColor ?? "#ef5350";
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (let i = start; i < end && i < data.length; i++) {
        const v = data[i]?.value as {
          open?: number;
          high?: number;
          low?: number;
          close?: number;
        } | null;
        if (!v?.open || !v.high || !v.low || !v.close) continue;
        const x = timeScale.indexToX(i);
        const oY = priceScale.priceToY(v.open);
        const cY = priceScale.priceToY(v.close);
        const hY = priceScale.priceToY(v.high);
        const lY = priceScale.priceToY(v.low);
        const color = v.close >= v.open ? upColor : downColor;
        const bodyTop = Math.min(oY, cY);
        const bodyH = Math.max(1, Math.abs(oY - cY));
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, hY);
        ctx.lineTo(x, lY);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x - halfBody, bodyTop, bodyWidth, bodyH);
      }
      ctx.restore();
    },
    priceRange: () => [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
  }),
];
