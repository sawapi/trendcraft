/**
 * Unified Indicator Presets
 *
 * Extends livePresets with batch `compute` functions, enabling both
 * static and streaming modes from a single registry.
 *
 * @example
 * ```ts
 * import { indicatorPresets } from "trendcraft";
 * import { connectIndicators } from "@trendcraft/chart";
 *
 * // Static mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles });
 * conn.add("rsi");
 *
 * // Live mode
 * const conn = connectIndicators(chart, { presets: indicatorPresets, candles, live: source });
 * conn.add("rsi");
 * ```
 */

import {
  adl,
  adxr,
  alma,
  aroon,
  atr,
  bollingerBands,
  cci,
  chandelierExit,
  choppinessIndex,
  cmf,
  cmo,
  connorsRsi,
  dema,
  dmi,
  donchianChannel,
  elderForceIndex,
  ema,
  emaRibbon,
  frama,
  hma,
  ichimoku,
  imi,
  kama,
  keltnerChannel,
  klinger,
  macd,
  mcginleyDynamic,
  mfi,
  obv,
  parabolicSar,
  roc,
  rsi,
  sma,
  stochRsi,
  stochastics,
  supertrend,
  t3,
  tema,
  trix,
  twap,
  volumeAnomaly,
  vortex,
  vwap,
  vwma,
  williamsR,
  wma,
  zlema,
} from "../indicators";
import type { NormalizedCandle, Series } from "../types";
import type { SeriesMeta } from "../types/candle";
import { livePresets } from "./live-presets";
import type { LiveIndicatorFactory } from "./types";

/**
 * Unified indicator preset: supports both batch (compute) and streaming (createFactory).
 * At least one of `compute` or `createFactory` must be defined.
 */
export type IndicatorPreset = {
  /** Domain metadata (label, overlay, yRange, referenceLines) */
  meta: SeriesMeta;
  /** Default parameters */
  defaultParams: Record<string, unknown>;
  /** Snapshot key name (string or function of params) */
  snapshotName: string | ((params: Record<string, unknown>) => string);
  /** Batch computation: candles → Series<T> (for static mode) */
  compute?: (candles: NormalizedCandle[], params: Record<string, unknown>) => Series<unknown>;
  /** Incremental factory: for live streaming mode */
  createFactory?: (params: Record<string, unknown>) => LiveIndicatorFactory;
};

/** Helper to extend a livePreset entry with a batch compute function */
function withCompute(
  key: string,
  // biome-ignore lint/suspicious/noExplicitAny: bridging typed batch fns with generic params
  computeFn: (candles: NormalizedCandle[], params: any) => Series<any>,
): IndicatorPreset {
  const live = livePresets[key];
  return { ...live, compute: computeFn };
}

/**
 * Unified indicator presets for all indicators with batch and/or streaming support.
 *
 * Entries from `livePresets` are enriched with `compute` for static mode.
 * Batch-only indicators (no `createFactory`) are also included.
 */
export const indicatorPresets: Record<string, IndicatorPreset> = {
  // ============================================
  // Moving Averages
  // ============================================
  sma: withCompute("sma", (c, p) => sma(c, { period: p.period ?? 20, source: p.source })),
  ema: withCompute("ema", (c, p) => ema(c, { period: p.period ?? 20 })),
  wma: withCompute("wma", (c, p) => wma(c, { period: p.period ?? 20 })),
  vwma: withCompute("vwma", (c, p) => vwma(c, { period: p.period ?? 20 })),
  kama: withCompute("kama", (c, p) => kama(c, { period: p.period ?? 10 })),
  hma: withCompute("hma", (c, p) => hma(c, { period: p.period ?? 16 })),
  t3: withCompute("t3", (c, p) => t3(c, { period: p.period ?? 5 })),
  mcginley: withCompute("mcginley", (c, p) => mcginleyDynamic(c, { period: p.period ?? 14 })),
  emaRibbon: withCompute("emaRibbon", (c, p) => emaRibbon(c, { periods: p.periods })),
  dema: withCompute("dema", (c, p) => dema(c, { period: p.period ?? 20, source: p.source })),
  tema: withCompute("tema", (c, p) => tema(c, { period: p.period ?? 20, source: p.source })),
  zlema: withCompute("zlema", (c, p) => zlema(c, { period: p.period ?? 20, source: p.source })),
  alma: withCompute("alma", (c, p) =>
    alma(c, {
      period: p.period ?? 9,
      offset: p.offset ?? 0.85,
      sigma: p.sigma ?? 6,
      source: p.source,
    }),
  ),
  frama: withCompute("frama", (c, p) => frama(c, { period: p.period ?? 16, source: p.source })),

  // ============================================
  // Momentum
  // ============================================
  rsi: withCompute("rsi", (c, p) => rsi(c, { period: p.period ?? 14 })),
  macd: withCompute("macd", (c, p) =>
    macd(c, {
      fastPeriod: p.fastPeriod,
      slowPeriod: p.slowPeriod,
      signalPeriod: p.signalPeriod,
    }),
  ),
  stochastics: withCompute("stochastics", (c, p) =>
    stochastics(c, {
      kPeriod: p.kPeriod,
      dPeriod: p.dPeriod,
      slowing: p.slowing,
    }),
  ),
  dmi: withCompute("dmi", (c, p) => dmi(c, { period: p.period ?? 14 })),
  roc: withCompute("roc", (c, p) => roc(c, { period: p.period ?? 12 })),
  williamsR: withCompute("williamsR", (c, p) => williamsR(c, { period: p.period ?? 14 })),
  cci: withCompute("cci", (c, p) => cci(c, { period: p.period ?? 20 })),
  stochRsi: withCompute("stochRsi", (c, p) =>
    stochRsi(c, {
      rsiPeriod: p.rsiPeriod,
      stochPeriod: p.stochPeriod,
      kPeriod: p.kPeriod,
      dPeriod: p.dPeriod,
    }),
  ),
  trix: withCompute("trix", (c, p) => trix(c, { period: p.period ?? 15 })),
  aroon: withCompute("aroon", (c, p) => aroon(c, { period: p.period ?? 25 })),
  connorsRsi: withCompute("connorsRsi", (c, p) =>
    connorsRsi(c, {
      rsiPeriod: p.rsiPeriod,
      streakPeriod: p.streakPeriod,
      rocPeriod: p.rocPeriod,
    }),
  ),
  cmo: withCompute("cmo", (c, p) => cmo(c, { period: p.period ?? 14 })),
  adxr: withCompute("adxr", (c, p) => adxr(c, { period: p.period ?? 14 })),
  imi: withCompute("imi", (c, p) => imi(c, { period: p.period ?? 14 })),
  vortex: withCompute("vortex", (c, p) => vortex(c, { period: p.period ?? 14 })),

  // ============================================
  // Volatility
  // ============================================
  atr: withCompute("atr", (c, p) => atr(c, { period: p.period ?? 14 })),
  bb: withCompute("bb", (c, p) => bollingerBands(c, { period: p.period ?? 20, stdDev: p.stdDev })),
  donchian: withCompute("donchian", (c, p) => donchianChannel(c, { period: p.period ?? 20 })),
  keltner: withCompute("keltner", (c, p) =>
    keltnerChannel(c, {
      emaPeriod: p.emaPeriod,
      atrPeriod: p.atrPeriod,
      multiplier: p.multiplier,
    }),
  ),
  chandelierExit: withCompute("chandelierExit", (c, p) =>
    chandelierExit(c, { period: p.period ?? 22, multiplier: p.multiplier ?? 3 }),
  ),
  choppiness: withCompute("choppiness", (c, p) => choppinessIndex(c, { period: p.period ?? 14 })),

  // ============================================
  // Trend
  // ============================================
  supertrend: withCompute("supertrend", (c, p) =>
    supertrend(c, { period: p.period ?? 10, multiplier: p.multiplier ?? 3 }),
  ),
  parabolicSar: withCompute("parabolicSar", (c, p) =>
    parabolicSar(c, { step: p.step, max: p.max }),
  ),
  ichimoku: withCompute("ichimoku", (c, p) =>
    ichimoku(c, {
      tenkanPeriod: p.tenkanPeriod,
      kijunPeriod: p.kijunPeriod,
      senkouBPeriod: p.senkouBPeriod,
      displacement: p.displacement,
    }),
  ),

  // ============================================
  // Volume
  // ============================================
  obv: withCompute("obv", (c) => obv(c)),
  cmf: withCompute("cmf", (c, p) => cmf(c, { period: p.period ?? 20 })),
  mfi: withCompute("mfi", (c, p) => mfi(c, { period: p.period ?? 14 })),
  vwap: withCompute("vwap", (c) => vwap(c)),
  adl: withCompute("adl", (c) => adl(c)),
  twap: withCompute("twap", (c) => twap(c)),
  elderForceIndex: withCompute("elderForceIndex", (c, p) =>
    elderForceIndex(c, { period: p.period ?? 13 }),
  ),
  volumeAnomaly: withCompute("volumeAnomaly", (c, p) =>
    volumeAnomaly(c, {
      period: p.period,
      highThreshold: p.highThreshold,
      extremeThreshold: p.extremeThreshold,
    }),
  ),
  klinger: withCompute("klinger", (c, p) =>
    klinger(c, {
      shortPeriod: p.shortPeriod ?? p.fastPeriod,
      longPeriod: p.longPeriod ?? p.slowPeriod,
      signalPeriod: p.signalPeriod,
    }),
  ),
};
