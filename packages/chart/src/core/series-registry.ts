/**
 * Series Registry — Maps Series<T> value shapes to visual series types.
 * This is the core innovation of @trendcraft/chart: auto-introspection.
 */

import type { DataPoint, SeriesType } from "./types";

// ============================================
// Introspection Rule
// ============================================

export type IntrospectionRule = {
  /** Rule name for debugging */
  name: string;
  /** Test if a value matches this rule */
  test: (value: unknown) => boolean;
  /** Visual series type to use */
  seriesType: SeriesType;
  /** Default pane placement: 'main' for overlays, 'sub' for subcharts */
  defaultPane: "main" | "sub";
  /** Extract named numeric channels from the value (called only after test() passes).
   *  For primitive types (e.g. number), the value may not be a Record. */
  // biome-ignore lint/suspicious/noExplicitAny: value type depends on what test() matched
  decompose: (value: any) => Record<string, number | null>;
};

// ============================================
// Built-in Rules
// ============================================

/** Type guard: narrows unknown to record with specified keys */
function hasKeys(value: unknown, keys: string[]): value is Record<string, number | null> {
  if (typeof value !== "object" || value === null) return false;
  return keys.every((k) => k in value);
}

/** Rules are tested in order; first match wins */
const BUILTIN_RULES: IntrospectionRule[] = [
  // Band types (BB, KC, Donchian)
  {
    name: "band",
    test: (v) => hasKeys(v, ["upper", "middle", "lower"]),
    seriesType: "band",
    defaultPane: "main",
    decompose: (v) => {
      return { upper: v.upper, middle: v.middle, lower: v.lower };
    },
  },

  // Ichimoku cloud
  {
    name: "ichimoku",
    test: (v) => hasKeys(v, ["tenkan", "kijun", "senkouA", "senkouB"]),
    seriesType: "cloud",
    defaultPane: "main",
    decompose: (v) => {
      return {
        tenkan: v.tenkan,
        kijun: v.kijun,
        senkouA: v.senkouA,
        senkouB: v.senkouB,
        chikou: v.chikou ?? null,
      };
    },
  },

  // MACD (multi-series subchart)
  {
    name: "macd",
    test: (v) => hasKeys(v, ["macd", "signal", "histogram"]),
    seriesType: "histogram",
    defaultPane: "sub",
    decompose: (v) => {
      return { macd: v.macd, signal: v.signal, histogram: v.histogram };
    },
  },

  // DMI/ADX
  {
    name: "dmi",
    test: (v) => hasKeys(v, ["adx", "plusDi", "minusDi"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => {
      return { adx: v.adx, plusDi: v.plusDi, minusDi: v.minusDi };
    },
  },

  // Stochastics / StochRSI (oscillator with k, d)
  {
    name: "oscillator",
    test: (v) => hasKeys(v, ["k", "d"]) && !hasKeys(v, ["macd"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => {
      return { k: v.k, d: v.d };
    },
  },

  // Aroon
  {
    name: "aroon",
    test: (v) => hasKeys(v, ["up", "down"]) && !hasKeys(v, ["open"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => {
      return { up: v.up, down: v.down };
    },
  },

  // Supertrend
  {
    name: "supertrend",
    test: (v) => hasKeys(v, ["upperBand", "lowerBand", "direction"]) && hasKeys(v, ["supertrend"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      return { upperBand: v.upperBand, lowerBand: v.lowerBand, trend: v.direction };
    },
  },

  // Parabolic SAR
  {
    name: "parabolicSar",
    test: (v) => hasKeys(v, ["sar", "direction"]) && !hasKeys(v, ["upperBand"]),
    seriesType: "marker",
    defaultPane: "main",
    decompose: (v) => {
      return { sar: v.sar };
    },
  },

  // Pivot Points
  {
    name: "pivotPoints",
    test: (v) => hasKeys(v, ["pivot", "r1", "s1"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      return { pivot: v.pivot, r1: v.r1, r2: v.r2, s1: v.s1, s2: v.s2 };
    },
  },

  // Volume Profile (heatmap)
  {
    name: "volumeProfile",
    test: (v) => hasKeys(v, ["poc", "vah", "val", "levels"]),
    seriesType: "heatmap",
    defaultPane: "main",
    decompose: (v) => {
      return { poc: v.poc, vah: v.vah, val: v.val };
    },
  },

  // HMM Regime
  {
    name: "hmmRegime",
    test: (v) => hasKeys(v, ["regime", "confidence"]),
    seriesType: "area",
    defaultPane: "sub",
    decompose: (v) => {
      return { regime: v.regime, confidence: v.confidence };
    },
  },

  // Chandelier Exit
  {
    name: "chandelierExit",
    test: (v) => hasKeys(v, ["longExit", "shortExit", "direction"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      return { longExit: v.longExit, shortExit: v.shortExit };
    },
  },

  // Highest/Lowest
  {
    name: "highestLowest",
    test: (v) => hasKeys(v, ["highest", "lowest"]) && !hasKeys(v, ["upper"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      return { highest: v.highest, lowest: v.lowest };
    },
  },

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

  // Fair Value Gap (count of active FVGs as visual proxy)
  {
    name: "fairValueGap",
    test: (v) => hasKeys(v, ["newBullishFvg", "activeBullishFvgs"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => {
      const bulls = Array.isArray(v.activeBullishFvgs) ? v.activeBullishFvgs.length : 0;
      const bears = Array.isArray(v.activeBearishFvgs) ? v.activeBearishFvgs.length : 0;
      return { bullish: bulls, bearish: -bears };
    },
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

  // Klinger (kvo + signal + histogram — MACD-like with different key name)
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

  // Volume Trend (confidence score + trend flags)
  {
    name: "volumeTrend",
    test: (v) => hasKeys(v, ["isConfirmed", "hasDivergence", "confidence"]),
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v.confidence }),
  },

  // Single VWAP (anchored VWAP with no bands, or any {vwap} object)
  {
    name: "singleVwap",
    test: (v) => hasKeys(v, ["vwap"]) && !hasKeys(v, ["upper"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => ({ value: v.vwap }),
  },

  // Simple number → line (catch-all for RSI, CCI, ATR, OBV, etc.)
  {
    name: "number",
    test: (v) => typeof v === "number",
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v as number }),
  },
];

// ============================================
// Series Registry
// ============================================

export class SeriesRegistry {
  private _rules: IntrospectionRule[] = [...BUILTIN_RULES];

  /** Add a custom introspection rule (inserted before built-in rules) */
  addRule(rule: IntrospectionRule): void {
    this._rules.unshift(rule);
  }

  /**
   * Detect the visual series type from a Series<T> array.
   * Inspects the first non-null value.
   */
  detect<T>(data: DataPoint<T>[]): IntrospectionRule | null {
    // Find first non-null value
    for (const point of data) {
      if (point.value === null || point.value === undefined) continue;
      for (const rule of this._rules) {
        if (rule.test(point.value)) {
          return rule;
        }
      }
      break; // Only check the first non-null value
    }
    return null;
  }

  /**
   * Decompose a Series<T> into named numeric channels.
   * E.g., Series<MacdValue> → { macd: number[], signal: number[], histogram: number[] }
   */
  decomposeAll<T>(data: DataPoint<T>[], rule: IntrospectionRule): Map<string, (number | null)[]> {
    const channels = new Map<string, (number | null)[]>();
    let pointIndex = 0;

    for (const point of data) {
      const decomposed =
        point.value !== null && point.value !== undefined
          ? rule.decompose(point.value as Record<string, number | null>)
          : {};

      for (const [key, val] of Object.entries(decomposed)) {
        let arr = channels.get(key);
        if (!arr) {
          // Back-fill nulls for points before this channel first appeared
          arr = new Array(pointIndex).fill(null);
          channels.set(key, arr);
        }
        arr.push(val);
      }

      // Ensure all channels have same length (fill nulls for missing keys)
      const expectedLen = pointIndex + 1;
      for (const [, arr] of channels) {
        if (arr.length < expectedLen) arr.push(null);
      }

      pointIndex++;
    }

    return channels;
  }
}

/** Default singleton registry */
export const defaultRegistry = new SeriesRegistry();
