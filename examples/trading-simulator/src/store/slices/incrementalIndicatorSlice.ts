/**
 * Incremental Indicator Slice
 *
 * Manages O(1) per-candle indicator computation using trendcraft's incremental API.
 * On simulation start, instances are created and warmed up with initial candles.
 * On each stepForward, only the new candle is processed.
 * For stepBackward, a full recalculation is triggered from the batch fallback.
 */

import { incremental } from "trendcraft";
import type { NormalizedCandle } from "../../types";
import { DEFAULT_INDICATOR_PARAMS, type IndicatorParams } from "../../types";
import type { IndicatorData } from "../../utils/indicators";
import type { SliceCreator } from "../types";

// Union type for all incremental indicator instances
type AnyIncremental =
  | ReturnType<typeof incremental.createSma>
  | ReturnType<typeof incremental.createEma>
  | ReturnType<typeof incremental.createRsi>
  | ReturnType<typeof incremental.createMacd>
  | ReturnType<typeof incremental.createStochastics>
  | ReturnType<typeof incremental.createDmi>
  | ReturnType<typeof incremental.createCci>
  | ReturnType<typeof incremental.createBollingerBands>
  | ReturnType<typeof incremental.createAtr>
  | ReturnType<typeof incremental.createSupertrend>
  | ReturnType<typeof incremental.createParabolicSar>
  | ReturnType<typeof incremental.createIchimoku>
  | ReturnType<typeof incremental.createObv>
  | ReturnType<typeof incremental.createMfi>
  | ReturnType<typeof incremental.createKeltnerChannel>
  | ReturnType<typeof incremental.createDonchianChannel>
  | ReturnType<typeof incremental.createStochRsi>;

// Registry: maps indicator key → { instance, extract fn }
interface IndicatorEntry {
  instance: AnyIncremental;
  /** Append one candle's result to the IndicatorData arrays */
  append: (data: IndicatorData, candle: NormalizedCandle) => void;
}

export interface IncrementalIndicatorSlice {
  /** Per-symbol incremental indicator registries */
  _incrementalRegistries: Map<string, Map<string, IndicatorEntry>>;

  /** Initialize incremental indicators for a symbol */
  initIncrementalIndicators: (
    symbolId: string,
    candles: NormalizedCandle[],
    warmUpEnd: number,
    enabledIndicators: string[],
    params: IndicatorParams,
  ) => IndicatorData;

  /** Advance all incremental indicators by one candle */
  advanceIncrementalIndicators: (symbolId: string, candle: NormalizedCandle) => void;

  /** Clear incremental state for a symbol */
  clearIncrementalIndicators: (symbolId: string) => void;
}

/**
 * Factory functions for each indicator key.
 * Each returns an IndicatorEntry with the instance and an append function.
 */
function createIndicatorEntries(key: string, p: Required<IndicatorParams>): IndicatorEntry | null {
  switch (key) {
    case "sma5":
      return makeSma("sma5", p.sma5Period);
    case "sma25":
      return makeSma("sma25", p.sma25Period);
    case "sma75":
      return makeSma("sma75", p.sma75Period);
    case "ema12":
      return makeEma("ema12", p.ema12Period);
    case "ema26":
      return makeEma("ema26", p.ema26Period);
    case "rsi": {
      const inst = incremental.createRsi({ period: p.rsiPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.rsi) data.rsi = [];
          data.rsi.push(r.value);
        },
      };
    }
    case "macd": {
      const inst = incremental.createMacd({
        fastPeriod: p.macdFastPeriod,
        slowPeriod: p.macdSlowPeriod,
        signalPeriod: p.macdSignalPeriod,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.macdLine) data.macdLine = [];
          if (!data.macdSignal) data.macdSignal = [];
          if (!data.macdHist) data.macdHist = [];
          data.macdLine.push(r.value?.macd ?? null);
          data.macdSignal.push(r.value?.signal ?? null);
          data.macdHist.push(r.value?.histogram ?? null);
        },
      };
    }
    case "bb": {
      const inst = incremental.createBollingerBands({
        period: p.bbPeriod,
        stdDev: p.bbStdDev,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.bbUpper) data.bbUpper = [];
          if (!data.bbMiddle) data.bbMiddle = [];
          if (!data.bbLower) data.bbLower = [];
          data.bbUpper.push(r.value?.upper ?? null);
          data.bbMiddle.push(r.value?.middle ?? null);
          data.bbLower.push(r.value?.lower ?? null);
        },
      };
    }
    case "atr": {
      const inst = incremental.createAtr({ period: p.atrPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.atr) data.atr = [];
          data.atr.push(r.value);
        },
      };
    }
    case "stochastics": {
      const inst = incremental.createStochastics({
        kPeriod: p.stochKPeriod,
        dPeriod: p.stochDPeriod,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.stochK) data.stochK = [];
          if (!data.stochD) data.stochD = [];
          data.stochK.push(r.value?.k ?? null);
          data.stochD.push(r.value?.d ?? null);
        },
      };
    }
    case "stochRsi": {
      const inst = incremental.createStochRsi({
        rsiPeriod: p.stochRsiRsiPeriod,
        stochPeriod: p.stochRsiStochPeriod,
        kPeriod: p.stochRsiKPeriod,
        dPeriod: p.stochRsiDPeriod,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.stochRsiK) data.stochRsiK = [];
          if (!data.stochRsiD) data.stochRsiD = [];
          data.stochRsiK.push(r.value?.k ?? null);
          data.stochRsiD.push(r.value?.d ?? null);
        },
      };
    }
    case "dmi": {
      const inst = incremental.createDmi({ period: p.dmiPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.dmiPlusDi) data.dmiPlusDi = [];
          if (!data.dmiMinusDi) data.dmiMinusDi = [];
          if (!data.dmiAdx) data.dmiAdx = [];
          data.dmiPlusDi.push(r.value?.plusDi ?? null);
          data.dmiMinusDi.push(r.value?.minusDi ?? null);
          data.dmiAdx.push(r.value?.adx ?? null);
        },
      };
    }
    case "cci": {
      const inst = incremental.createCci({ period: p.cciPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.cci) data.cci = [];
          data.cci.push(r.value);
        },
      };
    }
    case "supertrend": {
      const inst = incremental.createSupertrend({
        period: p.supertrendPeriod,
        multiplier: p.supertrendMultiplier,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.supertrendLine) data.supertrendLine = [];
          if (!data.supertrendDirection) data.supertrendDirection = [];
          data.supertrendLine.push(r.value?.supertrend ?? null);
          data.supertrendDirection.push(r.value?.direction ?? null);
        },
      };
    }
    case "parabolicSar": {
      const inst = incremental.createParabolicSar();
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.parabolicSar) data.parabolicSar = [];
          if (!data.parabolicSarDirection) data.parabolicSarDirection = [];
          data.parabolicSar.push(r.value?.sar ?? null);
          data.parabolicSarDirection.push(r.value?.direction ?? null);
        },
      };
    }
    case "ichimoku": {
      const inst = incremental.createIchimoku();
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.ichimokuTenkan) data.ichimokuTenkan = [];
          if (!data.ichimokuKijun) data.ichimokuKijun = [];
          if (!data.ichimokuSenkouA) data.ichimokuSenkouA = [];
          if (!data.ichimokuSenkouB) data.ichimokuSenkouB = [];
          if (!data.ichimokuChikou) data.ichimokuChikou = [];
          data.ichimokuTenkan.push(r.value?.tenkan ?? null);
          data.ichimokuKijun.push(r.value?.kijun ?? null);
          data.ichimokuSenkouA.push(r.value?.senkouA ?? null);
          data.ichimokuSenkouB.push(r.value?.senkouB ?? null);
          data.ichimokuChikou.push(r.value?.chikou ?? null);
        },
      };
    }
    case "keltner": {
      const inst = incremental.createKeltnerChannel({
        emaPeriod: p.keltnerEmaPeriod,
        atrPeriod: p.keltnerAtrPeriod,
        multiplier: p.keltnerMultiplier,
      });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.keltnerUpper) data.keltnerUpper = [];
          if (!data.keltnerMiddle) data.keltnerMiddle = [];
          if (!data.keltnerLower) data.keltnerLower = [];
          data.keltnerUpper.push(r.value?.upper ?? null);
          data.keltnerMiddle.push(r.value?.middle ?? null);
          data.keltnerLower.push(r.value?.lower ?? null);
        },
      };
    }
    case "donchian": {
      const inst = incremental.createDonchianChannel({ period: p.donchianPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.donchianUpper) data.donchianUpper = [];
          if (!data.donchianMiddle) data.donchianMiddle = [];
          if (!data.donchianLower) data.donchianLower = [];
          data.donchianUpper.push(r.value?.upper ?? null);
          data.donchianMiddle.push(r.value?.middle ?? null);
          data.donchianLower.push(r.value?.lower ?? null);
        },
      };
    }
    case "obv": {
      const inst = incremental.createObv();
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.obv) data.obv = [];
          data.obv.push(r.value);
        },
      };
    }
    case "mfi": {
      const inst = incremental.createMfi({ period: p.mfiPeriod });
      return {
        instance: inst,
        append: (data, candle) => {
          const r = inst.next(candle);
          if (!data.mfi) data.mfi = [];
          data.mfi.push(r.value);
        },
      };
    }
    default:
      return null;
  }
}

function makeSma(key: "sma5" | "sma25" | "sma75", period: number): IndicatorEntry {
  const inst = incremental.createSma({ period });
  return {
    instance: inst,
    append: (data, candle) => {
      const r = inst.next(candle);
      if (!data[key]) data[key] = [];
      data[key]!.push(r.value);
    },
  };
}

function makeEma(key: "ema12" | "ema26", period: number): IndicatorEntry {
  const inst = incremental.createEma({ period });
  return {
    instance: inst,
    append: (data, candle) => {
      const r = inst.next(candle);
      if (!data[key]) data[key] = [];
      data[key]!.push(r.value);
    },
  };
}

// Indicator keys that support incremental computation
const INCREMENTAL_KEYS = new Set([
  "sma5",
  "sma25",
  "sma75",
  "ema12",
  "ema26",
  "rsi",
  "macd",
  "bb",
  "atr",
  "stochastics",
  "stochRsi",
  "dmi",
  "cci",
  "supertrend",
  "parabolicSar",
  "ichimoku",
  "keltner",
  "donchian",
  "obv",
  "mfi",
]);

// Keys that require batch calculation (SMC, patterns)
const BATCH_ONLY_KEYS = new Set([
  "orderBlock",
  "liquiditySweep",
  "doubleTopBottom",
  "headShoulders",
  "cupHandle",
]);

export const createIncrementalIndicatorSlice: SliceCreator<IncrementalIndicatorSlice> = (
  _set,
  _get,
) => ({
  _incrementalRegistries: new Map(),

  initIncrementalIndicators: (
    symbolId: string,
    candles: NormalizedCandle[],
    warmUpEnd: number,
    enabledIndicators: string[],
    params: IndicatorParams,
  ): IndicatorData => {
    const p = { ...DEFAULT_INDICATOR_PARAMS, ...params } as Required<IndicatorParams>;
    const registry = new Map<string, IndicatorEntry>();
    const data: IndicatorData = {};

    // Also include report indicators
    const allIndicators = new Set([...enabledIndicators, "sma25", "sma75", "rsi", "macd", "bb"]);

    // Create incremental instances
    for (const key of allIndicators) {
      if (!INCREMENTAL_KEYS.has(key)) continue;
      const entry = createIndicatorEntries(key, p);
      if (entry) {
        registry.set(key, entry);
      }
    }

    // Warm up: feed all candles from 0 to warmUpEnd (inclusive)
    for (let i = 0; i <= warmUpEnd && i < candles.length; i++) {
      const candle = candles[i];
      for (const entry of registry.values()) {
        entry.append(data, candle);
      }
    }

    // Store registry for future incremental updates
    const { _incrementalRegistries } = _get();
    _incrementalRegistries.set(symbolId, registry);

    // Handle batch-only indicators (SMC, patterns) via the existing batch API
    // These are computed once over all candles and don't need incremental updates
    const batchKeys = enabledIndicators.filter((k) => BATCH_ONLY_KEYS.has(k));
    if (batchKeys.length > 0) {
      // Import dynamically to avoid circular deps — batch calc is only needed here
      const { calculateIndicators } = require("../../utils/indicators");
      const batchData = calculateIndicators(candles, batchKeys, params);
      if (batchData.orderBlockData) data.orderBlockData = batchData.orderBlockData;
      if (batchData.liquiditySweepData) data.liquiditySweepData = batchData.liquiditySweepData;
      if (batchData.detectedPatterns) data.detectedPatterns = batchData.detectedPatterns;
    }

    return data;
  },

  advanceIncrementalIndicators: (symbolId: string, candle: NormalizedCandle) => {
    const { _incrementalRegistries, symbols } = _get();
    const registry = _incrementalRegistries.get(symbolId) as
      | Map<string, IndicatorEntry>
      | undefined;
    if (!registry) return;

    const symbol = symbols.find((s) => s.id === symbolId);
    if (!symbol?.indicatorData) return;

    // Advance each incremental indicator by one candle
    for (const entry of registry.values()) {
      entry.append(symbol.indicatorData, candle);
    }
  },

  clearIncrementalIndicators: (symbolId: string) => {
    const { _incrementalRegistries } = _get();
    _incrementalRegistries.delete(symbolId);
  },
});
