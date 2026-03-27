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
  /** Extract named numeric channels from the value (called only after test() passes) */
  decompose: (value: Record<string, number | null>) => Record<string, number | null>;
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
    test: (v) => hasKeys(v, ["upperBand", "lowerBand", "trend"]),
    seriesType: "line",
    defaultPane: "main",
    decompose: (v) => {
      return { upperBand: v.upperBand, lowerBand: v.lowerBand, trend: v.trend };
    },
  },

  // Parabolic SAR
  {
    name: "parabolicSar",
    test: (v) => hasKeys(v, ["sar", "trend"]) && !hasKeys(v, ["upperBand"]),
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

  // Simple number → line (catch-all for RSI, CCI, ATR, OBV, etc.)
  {
    name: "number",
    test: (v) => typeof v === "number",
    seriesType: "line",
    defaultPane: "sub",
    decompose: (v) => ({ value: v as unknown as number }),
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
