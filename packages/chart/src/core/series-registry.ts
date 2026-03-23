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
  /** Default pane placement: 'main' for overlays, 'new' for subcharts */
  defaultPane: "main" | "new";
  /** Extract named numeric channels from the value */
  decompose: (value: unknown) => Record<string, number | null>;
};

// ============================================
// Built-in Rules
// ============================================

function hasKeys(value: unknown, keys: string[]): boolean {
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
      const val = v as Record<string, number | null>;
      return { upper: val.upper, middle: val.middle, lower: val.lower };
    },
  },

  // Ichimoku cloud
  {
    name: "ichimoku",
    test: (v) => hasKeys(v, ["tenkan", "kijun", "senkouA", "senkouB"]),
    seriesType: "cloud",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return {
        tenkan: val.tenkan,
        kijun: val.kijun,
        senkouA: val.senkouA,
        senkouB: val.senkouB,
        chikou: val.chikou ?? null,
      };
    },
  },

  // MACD (multi-series subchart)
  {
    name: "macd",
    test: (v) => hasKeys(v, ["macd", "signal", "histogram"]),
    seriesType: "histogram",
    defaultPane: "new",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { macd: val.macd, signal: val.signal, histogram: val.histogram };
    },
  },

  // DMI/ADX
  {
    name: "dmi",
    test: (v) => hasKeys(v, ["adx", "plusDi", "minusDi"]),
    seriesType: "line",
    defaultPane: "new",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { adx: val.adx, plusDi: val.plusDi, minusDi: val.minusDi };
    },
  },

  // Stochastics / StochRSI (oscillator with k, d)
  {
    name: "oscillator",
    test: (v) => hasKeys(v, ["k", "d"]) && !hasKeys(v, ["macd"]),
    seriesType: "line",
    defaultPane: "new",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { k: val.k, d: val.d };
    },
  },

  // Aroon
  {
    name: "aroon",
    test: (v) => hasKeys(v, ["up", "down"]) && !hasKeys(v, ["open"]),
    seriesType: "line",
    defaultPane: "new",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { up: val.up, down: val.down };
    },
  },

  // Supertrend
  {
    name: "supertrend",
    test: (v) => hasKeys(v, ["upperBand", "lowerBand", "trend"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { upperBand: val.upperBand, lowerBand: val.lowerBand, trend: val.trend };
    },
  },

  // Parabolic SAR
  {
    name: "parabolicSar",
    test: (v) => hasKeys(v, ["sar", "trend"]) && !hasKeys(v, ["upperBand"]),
    seriesType: "marker",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { sar: val.sar };
    },
  },

  // Pivot Points
  {
    name: "pivotPoints",
    test: (v) => hasKeys(v, ["pivot", "r1", "s1"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { pivot: val.pivot, r1: val.r1, r2: val.r2, s1: val.s1, s2: val.s2 };
    },
  },

  // Volume Profile (heatmap)
  {
    name: "volumeProfile",
    test: (v) => hasKeys(v, ["poc", "vah", "val", "levels"]),
    seriesType: "heatmap",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { poc: val.poc, vah: val.vah, val: val.val };
    },
  },

  // HMM Regime
  {
    name: "hmmRegime",
    test: (v) => hasKeys(v, ["regime", "confidence"]),
    seriesType: "area",
    defaultPane: "new",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { regime: val.regime, confidence: val.confidence };
    },
  },

  // Chandelier Exit
  {
    name: "chandelierExit",
    test: (v) => hasKeys(v, ["longExit", "shortExit", "direction"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { longExit: val.longExit, shortExit: val.shortExit };
    },
  },

  // Highest/Lowest
  {
    name: "highestLowest",
    test: (v) => hasKeys(v, ["highest", "lowest"]) && !hasKeys(v, ["upper"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      const val = v as Record<string, number | null>;
      return { highest: val.highest, lowest: val.lowest };
    },
  },

  // Simple number → line (catch-all for RSI, CCI, ATR, OBV, etc.)
  {
    name: "number",
    test: (v) => typeof v === "number",
    seriesType: "line",
    defaultPane: "new",
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

    for (const point of data) {
      const decomposed =
        point.value !== null && point.value !== undefined ? rule.decompose(point.value) : {};

      for (const [key, val] of Object.entries(decomposed)) {
        let arr = channels.get(key);
        if (!arr) {
          arr = [];
          channels.set(key, arr);
        }
        arr.push(val);
      }

      // Ensure all channels have same length (fill nulls for missing keys)
      for (const [key, arr] of channels) {
        if (arr.length < data.indexOf(point) + 1) {
          while (arr.length < data.indexOf(point) + 1) {
            arr.push(null);
          }
        }
      }
    }

    return channels;
  }
}

/** Default singleton registry */
export const defaultRegistry = new SeriesRegistry();
