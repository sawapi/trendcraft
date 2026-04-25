/**
 * Live Indicator Presets
 *
 * Bundles incremental indicator factories with their domain metadata.
 * Any consumer that wants to register indicators by string id (UIs, screeners,
 * renderers, etc.) can read this registry without further configuration.
 *
 * @example
 * ```ts
 * import { livePresets } from "trendcraft";
 *
 * const preset = livePresets.sma;
 * const factory = preset.createFactory({ period: 50 });
 * const indicator = factory(undefined); // no prior state
 * ```
 */

import {
  createAdl,
  createAdxr,
  createAlma,
  createAnchoredVwap,
  createAroon,
  createAtr,
  createAtrStops,
  createAwesomeOscillator,
  createBalanceOfPower,
  createBollingerBands,
  createCci,
  createChandelierExit,
  createChoppinessIndex,
  createCmf,
  createCmo,
  createConnorsRsi,
  createCoppockCurve,
  createCvd,
  createDema,
  createDmi,
  createDonchianChannel,
  createElderForceIndex,
  createEma,
  createEmaRibbon,
  createEmv,
  createEwmaVolatility,
  createFairValueGap,
  createFractals,
  createFrama,
  createGapAnalysis,
  createGarmanKlass,
  createHighestLowest,
  createHistoricalVolatility,
  createHma,
  createHurst,
  createIchimoku,
  createImi,
  createKama,
  createKeltnerChannel,
  createKlinger,
  createKst,
  createMacd,
  createMassIndex,
  createMcGinleyDynamic,
  createMfi,
  createNvi,
  createObv,
  createOpeningRange,
  createParabolicSar,
  createPivotPoints,
  createPpo,
  createPvt,
  createQStick,
  createRoc,
  createRsi,
  createSma,
  createStc,
  createStochRsi,
  createStochastics,
  createSupertrend,
  createT3,
  createTema,
  createTrix,
  createTsi,
  createTwap,
  createUlcerIndex,
  createUltimateOscillator,
  createVolumeAnomaly,
  createVolumeTrend,
  createVortex,
  createVsa,
  createVwap,
  createVwma,
  createWeisWave,
  createWilliamsR,
  createWma,
  createZlema,
  restoreState,
} from "../indicators/incremental";
import type { WarmUpOptions } from "../indicators/incremental/types";
import {
  ADL_META,
  ADXR_META,
  ALMA_META,
  ANCHORED_VWAP_META,
  AO_META,
  AROON_META,
  ATR_META,
  ATR_STOPS_META,
  BB_META,
  BOP_META,
  CCI_META,
  CHANDELIER_EXIT_META,
  CHOPPINESS_META,
  CMF_META,
  CMO_META,
  CONNORS_RSI_META,
  COPPOCK_META,
  CVD_META,
  DEMA_META,
  DMI_META,
  DONCHIAN_META,
  ELDER_FORCE_INDEX_META,
  EMA_META,
  EMA_RIBBON_META,
  EMV_META,
  EWMA_VOL_META,
  FRACTALS_META,
  FRAMA_META,
  FVG_META,
  GAP_ANALYSIS_META,
  GARMAN_KLASS_META,
  HIGHEST_LOWEST_META,
  HMA_META,
  HMM_REGIME_META,
  HURST_META,
  HV_META,
  ICHIMOKU_META,
  IMI_META,
  KAMA_META,
  KELTNER_META,
  KLINGER_META,
  KST_META,
  MACD_META,
  MASS_INDEX_META,
  MCGINLEY_META,
  MFI_META,
  NVI_META,
  OBV_META,
  ORB_META,
  PARABOLIC_SAR_META,
  PIVOT_POINTS_META,
  PPO_META,
  PVT_META,
  QSTICK_META,
  ROC_META,
  RSI_META,
  SMA_META,
  STC_META,
  STOCHASTICS_META,
  STOCH_RSI_META,
  SUPERTREND_META,
  T3_META,
  TEMA_META,
  TRIX_META,
  TSI_META,
  TWAP_META,
  ULCER_META,
  UO_META,
  VOLUME_ANOMALY_META,
  VOLUME_TREND_META,
  VORTEX_META,
  VSA_META,
  VWAP_META,
  VWMA_META,
  WEIS_WAVE_META,
  WILLIAMS_R_META,
  WMA_META,
  ZLEMA_META,
} from "../indicators/indicator-meta";
import type { PriceSource, SeriesMeta } from "../types/candle";
import type { LiveIndicatorFactory } from "./types";

/**
 * A live indicator preset: factory + metadata + defaults.
 * Any registry consumer can instantiate an incremental indicator from an
 * entry without knowing the underlying factory signatures.
 */
export type LivePreset = {
  /** Domain metadata (label, overlay, yRange, referenceLines) */
  meta: SeriesMeta;
  /** Default factory parameters */
  defaultParams: Record<string, unknown>;
  /** Snapshot key name (string or function of params) */
  snapshotName: string | ((params: Record<string, unknown>) => string);
  /** Factory builder: given params, returns a LiveIndicatorFactory */
  createFactory: (params: Record<string, unknown>) => LiveIndicatorFactory;
};

/**
 * Infer the incremental state type `S` from a `create*` factory's signature
 * so `restoreState<S>()` stays strongly typed without an explicit generic
 * at each call site.
 */
type StateOf<TCreate> = TCreate extends (
  params: unknown,
  warmUp?: WarmUpOptions<infer S>,
) => ReturnType<LiveIndicatorFactory>
  ? S
  : unknown;

/** Helper to create a factory builder with restoreState wiring.
 *
 *  Curried so callers can declare `TParams` (the preset's param shape)
 *  explicitly while `TCreate` still infers from the `create*` argument:
 *
 *    factory<{ period: number }>()(createSma, (p) => ({ period: p.period ?? 20 }))
 *
 *  Inside `mapParams`, incoming `Record<string, unknown>` is narrowed to
 *  `Partial<TParams>` so `?? default` fallbacks work without `as number` /
 *  `as string` casts. `Parameters<TCreate>[0]` pins the mapped options to
 *  whatever `create*` expects; `StateOf<TCreate>` recovers the snapshot
 *  state type used by `restoreState<S>()`.
 *
 *  Omitting the type argument (`factory()(create, mapParams)`) falls back
 *  to `Record<string, unknown>` — equivalent to the pre-0.3.0 behavior.
 */
function factory<TParams extends Record<string, unknown> = Record<string, unknown>>(): <
  // biome-ignore lint/suspicious/noExplicitAny: factory accepts any create* signature; typed narrowly via Parameters/StateOf
  TCreate extends (params: any, warmUp?: WarmUpOptions<any>) => ReturnType<LiveIndicatorFactory>,
>(
  create: TCreate,
  mapParams: (p: Partial<TParams>) => Parameters<TCreate>[0],
) => (params: Record<string, unknown>) => LiveIndicatorFactory {
  return (create, mapParams) => (params) => (state) =>
    create(mapParams(params as Partial<TParams>), restoreState<StateOf<typeof create>>(state));
}

/**
 * Pre-built live presets for all indicators with incremental support.
 *
 * @example
 * ```ts
 * import { livePresets } from "trendcraft";
 * conn.addIndicator("rsi");   // uses livePresets.rsi
 * ```
 */
export const livePresets: Record<string, LivePreset> = {
  // Moving Averages
  sma: {
    meta: SMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `sma${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createSma, (p) => ({
      period: p.period ?? 20,
      source: p.source,
    })),
  },
  ema: {
    meta: EMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `ema${p.period}`,
    createFactory: factory<{ period?: number }>()(createEma, (p) => ({ period: p.period ?? 20 })),
  },
  wma: {
    meta: WMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `wma${p.period}`,
    createFactory: factory<{ period?: number }>()(createWma, (p) => ({ period: p.period ?? 20 })),
  },
  vwma: {
    meta: VWMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `vwma${p.period}`,
    createFactory: factory<{ period?: number }>()(createVwma, (p) => ({ period: p.period ?? 20 })),
  },
  kama: {
    meta: KAMA_META,
    defaultParams: { period: 10 },
    snapshotName: (p) => `kama${p.period}`,
    createFactory: factory<{ period?: number }>()(createKama, (p) => ({ period: p.period ?? 10 })),
  },
  hma: {
    meta: HMA_META,
    defaultParams: { period: 16 },
    snapshotName: (p) => `hma${p.period}`,
    createFactory: factory<{ period?: number }>()(createHma, (p) => ({ period: p.period ?? 16 })),
  },
  t3: {
    meta: T3_META,
    defaultParams: { period: 5 },
    snapshotName: (p) => `t3_${p.period}`,
    createFactory: factory<{ period?: number }>()(createT3, (p) => ({ period: p.period ?? 5 })),
  },
  mcginley: {
    meta: MCGINLEY_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `mcginley${p.period}`,
    createFactory: factory<{ period?: number }>()(createMcGinleyDynamic, (p) => ({
      period: p.period ?? 14,
    })),
  },
  emaRibbon: {
    meta: EMA_RIBBON_META,
    defaultParams: { periods: [8, 13, 21, 34, 55] },
    snapshotName: "emaRibbon",
    createFactory: factory<{ periods?: number[] }>()(createEmaRibbon, (p) => ({
      periods: p.periods,
    })),
  },
  dema: {
    meta: DEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `dema${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createDema, (p) => ({
      period: p.period ?? 20,
      source: p.source,
    })),
  },
  tema: {
    meta: TEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `tema${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createTema, (p) => ({
      period: p.period ?? 20,
      source: p.source,
    })),
  },
  zlema: {
    meta: ZLEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `zlema${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createZlema, (p) => ({
      period: p.period ?? 20,
      source: p.source,
    })),
  },
  alma: {
    meta: ALMA_META,
    defaultParams: { period: 9, offset: 0.85, sigma: 6 },
    snapshotName: (p) => `alma${p.period}_${p.offset ?? 0.85}_${p.sigma ?? 6}`,
    createFactory: factory<{
      source?: PriceSource;
      period?: number;
      offset?: number;
      sigma?: number;
    }>()(createAlma, (p) => ({
      period: p.period ?? 9,
      offset: p.offset ?? 0.85,
      sigma: p.sigma ?? 6,
      source: p.source,
    })),
  },
  frama: {
    meta: FRAMA_META,
    defaultParams: { period: 16 },
    snapshotName: (p) => `frama${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createFrama, (p) => ({
      period: p.period ?? 16,
      source: p.source,
    })),
  },

  // Momentum
  rsi: {
    meta: RSI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `rsi${p.period}`,
    createFactory: factory<{ period?: number }>()(createRsi, (p) => ({ period: p.period ?? 14 })),
  },
  macd: {
    meta: MACD_META,
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    snapshotName: "macd",
    createFactory: factory<{ fastPeriod?: number; slowPeriod?: number; signalPeriod?: number }>()(
      createMacd,
      (p) => ({
        fastPeriod: p.fastPeriod,
        slowPeriod: p.slowPeriod,
        signalPeriod: p.signalPeriod,
      }),
    ),
  },
  stochastics: {
    meta: STOCHASTICS_META,
    defaultParams: { kPeriod: 14, dPeriod: 3, slowing: 3 },
    snapshotName: "stoch",
    createFactory: factory<{ kPeriod?: number; dPeriod?: number; slowing?: number }>()(
      createStochastics,
      (p) => ({
        kPeriod: p.kPeriod,
        dPeriod: p.dPeriod,
        slowing: p.slowing,
      }),
    ),
  },
  dmi: {
    meta: DMI_META,
    defaultParams: { period: 14 },
    snapshotName: "dmi",
    createFactory: factory<{ period?: number }>()(createDmi, (p) => ({ period: p.period ?? 14 })),
  },
  roc: {
    meta: ROC_META,
    defaultParams: { period: 12 },
    snapshotName: (p) => `roc${p.period}`,
    createFactory: factory<{ period?: number }>()(createRoc, (p) => ({ period: p.period ?? 12 })),
  },
  williamsR: {
    meta: WILLIAMS_R_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `willR${p.period}`,
    createFactory: factory<{ period?: number }>()(createWilliamsR, (p) => ({
      period: p.period ?? 14,
    })),
  },
  cci: {
    meta: CCI_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `cci${p.period}`,
    createFactory: factory<{ period?: number }>()(createCci, (p) => ({ period: p.period ?? 20 })),
  },
  stochRsi: {
    meta: STOCH_RSI_META,
    defaultParams: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 },
    snapshotName: "stochRsi",
    createFactory: factory<{
      rsiPeriod?: number;
      stochPeriod?: number;
      kPeriod?: number;
      dPeriod?: number;
    }>()(createStochRsi, (p) => ({
      rsiPeriod: p.rsiPeriod,
      stochPeriod: p.stochPeriod,
      kPeriod: p.kPeriod,
      dPeriod: p.dPeriod,
    })),
  },
  trix: {
    meta: TRIX_META,
    defaultParams: { period: 15 },
    snapshotName: (p) => `trix${p.period}`,
    createFactory: factory<{ period?: number }>()(createTrix, (p) => ({ period: p.period ?? 15 })),
  },
  aroon: {
    meta: AROON_META,
    defaultParams: { period: 25 },
    snapshotName: "aroon",
    createFactory: factory<{ period?: number }>()(createAroon, (p) => ({ period: p.period ?? 25 })),
  },
  connorsRsi: {
    meta: CONNORS_RSI_META,
    defaultParams: { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 },
    snapshotName: "crsi",
    createFactory: factory<{ rsiPeriod?: number; streakPeriod?: number; rocPeriod?: number }>()(
      createConnorsRsi,
      (p) => ({
        rsiPeriod: p.rsiPeriod,
        streakPeriod: p.streakPeriod,
        rocPeriod: p.rocPeriod,
      }),
    ),
  },
  cmo: {
    meta: CMO_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `cmo${p.period}`,
    createFactory: factory<{ period?: number }>()(createCmo, (p) => ({ period: p.period ?? 14 })),
  },
  adxr: {
    meta: ADXR_META,
    defaultParams: { period: 14 },
    snapshotName: "adxr",
    createFactory: factory<{ period?: number }>()(createAdxr, (p) => ({ period: p.period ?? 14 })),
  },
  imi: {
    meta: IMI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `imi${p.period}`,
    createFactory: factory<{ period?: number }>()(createImi, (p) => ({ period: p.period ?? 14 })),
  },
  vortex: {
    meta: VORTEX_META,
    defaultParams: { period: 14 },
    snapshotName: "vortex",
    createFactory: factory<{ period?: number }>()(createVortex, (p) => ({
      period: p.period ?? 14,
    })),
  },
  ao: {
    meta: AO_META,
    defaultParams: { fastPeriod: 5, slowPeriod: 34 },
    snapshotName: "ao",
    createFactory: factory<{ fastPeriod?: number; slowPeriod?: number }>()(
      createAwesomeOscillator,
      (p) => ({
        fastPeriod: p.fastPeriod ?? 5,
        slowPeriod: p.slowPeriod ?? 34,
      }),
    ),
  },
  bop: {
    meta: BOP_META,
    defaultParams: { smoothPeriod: 14 },
    snapshotName: (p) => `bop${p.smoothPeriod}`,
    createFactory: factory<{ smoothPeriod?: number }>()(createBalanceOfPower, (p) => ({
      smoothPeriod: p.smoothPeriod ?? 14,
    })),
  },
  qstick: {
    meta: QSTICK_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `qstick${p.period}`,
    createFactory: factory<{ period?: number }>()(createQStick, (p) => ({
      period: p.period ?? 14,
    })),
  },
  ppo: {
    meta: PPO_META,
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    snapshotName: "ppo",
    createFactory: factory<{
      source?: PriceSource;
      fastPeriod?: number;
      slowPeriod?: number;
      signalPeriod?: number;
    }>()(createPpo, (p) => ({
      fastPeriod: p.fastPeriod ?? 12,
      slowPeriod: p.slowPeriod ?? 26,
      signalPeriod: p.signalPeriod ?? 9,
      source: p.source,
    })),
  },
  coppock: {
    meta: COPPOCK_META,
    defaultParams: { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 },
    snapshotName: "coppock",
    createFactory: factory<{
      source?: PriceSource;
      wmaPeriod?: number;
      longRocPeriod?: number;
      shortRocPeriod?: number;
    }>()(createCoppockCurve, (p) => ({
      wmaPeriod: p.wmaPeriod ?? 10,
      longRocPeriod: p.longRocPeriod ?? 14,
      shortRocPeriod: p.shortRocPeriod ?? 11,
      source: p.source,
    })),
  },
  massIndex: {
    meta: MASS_INDEX_META,
    defaultParams: { emaPeriod: 9, sumPeriod: 25 },
    snapshotName: "massIndex",
    createFactory: factory<{ emaPeriod?: number; sumPeriod?: number }>()(createMassIndex, (p) => ({
      emaPeriod: p.emaPeriod ?? 9,
      sumPeriod: p.sumPeriod ?? 25,
    })),
  },
  // DPO is intentionally excluded from live presets.
  // Its output is delayed by `shift` bars (lookahead dependency),
  // which is incompatible with LiveCandle's current-bar association model.
  // Use the batch-only preset in indicator-presets.ts instead.
  ultimateOscillator: {
    meta: UO_META,
    defaultParams: { period1: 7, period2: 14, period3: 28 },
    snapshotName: "uo",
    createFactory: factory<{ period1?: number; period2?: number; period3?: number }>()(
      createUltimateOscillator,
      (p) => ({
        period1: p.period1 ?? 7,
        period2: p.period2 ?? 14,
        period3: p.period3 ?? 28,
      }),
    ),
  },
  tsi: {
    meta: TSI_META,
    defaultParams: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7 },
    snapshotName: "tsi",
    createFactory: factory<{
      source?: PriceSource;
      longPeriod?: number;
      shortPeriod?: number;
      signalPeriod?: number;
    }>()(createTsi, (p) => ({
      longPeriod: p.longPeriod ?? 25,
      shortPeriod: p.shortPeriod ?? 13,
      signalPeriod: p.signalPeriod ?? 7,
      source: p.source,
    })),
  },
  kst: {
    meta: KST_META,
    defaultParams: { signalPeriod: 9 },
    snapshotName: "kst",
    createFactory: factory<{ source?: PriceSource; signalPeriod?: number }>()(createKst, (p) => ({
      signalPeriod: p.signalPeriod ?? 9,
      source: p.source,
    })),
  },
  hurst: {
    meta: HURST_META,
    defaultParams: { minWindow: 20, maxWindow: 100 },
    snapshotName: "hurst",
    createFactory: factory<{ source?: PriceSource; minWindow?: number; maxWindow?: number }>()(
      createHurst,
      (p) => ({
        minWindow: p.minWindow ?? 20,
        maxWindow: p.maxWindow ?? 100,
        source: p.source,
      }),
    ),
  },
  stc: {
    meta: STC_META,
    defaultParams: { fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 },
    snapshotName: "stc",
    createFactory: factory<{
      source?: PriceSource;
      fastPeriod?: number;
      slowPeriod?: number;
      cyclePeriod?: number;
    }>()(createStc, (p) => ({
      fastPeriod: p.fastPeriod ?? 23,
      slowPeriod: p.slowPeriod ?? 50,
      cyclePeriod: p.cyclePeriod ?? 10,
      source: p.source,
    })),
  },

  // Volatility
  atr: {
    meta: ATR_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `atr${p.period}`,
    createFactory: factory<{ period?: number }>()(createAtr, (p) => ({ period: p.period ?? 14 })),
  },
  bb: {
    meta: BB_META,
    defaultParams: { period: 20, stdDev: 2 },
    snapshotName: (p) => `bb${p.period}`,
    createFactory: factory<{ period?: number; stdDev?: number }>()(createBollingerBands, (p) => ({
      period: p.period ?? 20,
      stdDev: p.stdDev,
    })),
  },
  donchian: {
    meta: DONCHIAN_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `donchian${p.period}`,
    createFactory: factory<{ period?: number }>()(createDonchianChannel, (p) => ({
      period: p.period ?? 20,
    })),
  },
  keltner: {
    meta: KELTNER_META,
    defaultParams: { emaPeriod: 20, atrPeriod: 10, multiplier: 1.5 },
    snapshotName: "keltner",
    createFactory: factory<{ emaPeriod?: number; atrPeriod?: number; multiplier?: number }>()(
      createKeltnerChannel,
      (p) => ({
        emaPeriod: p.emaPeriod,
        atrPeriod: p.atrPeriod,
        multiplier: p.multiplier,
      }),
    ),
  },
  chandelierExit: {
    meta: CHANDELIER_EXIT_META,
    defaultParams: { period: 22, multiplier: 3 },
    snapshotName: "chandelier",
    createFactory: factory<{ period?: number; multiplier?: number }>()(
      createChandelierExit,
      (p) => ({
        period: p.period ?? 22,
        multiplier: p.multiplier ?? 3,
      }),
    ),
  },
  choppiness: {
    meta: CHOPPINESS_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `chop${p.period}`,
    createFactory: factory<{ period?: number }>()(createChoppinessIndex, (p) => ({
      period: p.period ?? 14,
    })),
  },
  ewmaVol: {
    meta: EWMA_VOL_META,
    defaultParams: { lambda: 0.94 },
    snapshotName: (p) => `ewma${p.lambda}`,
    createFactory: factory<{ source?: PriceSource; lambda?: number }>()(
      createEwmaVolatility,
      (p) => ({
        lambda: p.lambda ?? 0.94,
        source: p.source,
      }),
    ),
  },
  garmanKlass: {
    meta: GARMAN_KLASS_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `gk${p.period}`,
    createFactory: factory<{ period?: number; annualFactor?: number }>()(
      createGarmanKlass,
      (p) => ({
        period: p.period ?? 20,
        annualFactor: p.annualFactor ?? 252,
      }),
    ),
  },
  hv: {
    meta: HV_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `hv${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number; annualFactor?: number }>()(
      createHistoricalVolatility,
      (p) => ({
        period: p.period ?? 20,
        annualFactor: p.annualFactor ?? 252,
        source: p.source,
      }),
    ),
  },
  atrStops: {
    meta: ATR_STOPS_META,
    defaultParams: { period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 },
    snapshotName: "atrStops",
    createFactory: factory<{
      period?: number;
      stopMultiplier?: number;
      takeProfitMultiplier?: number;
    }>()(createAtrStops, (p) => ({
      period: p.period ?? 14,
      stopMultiplier: p.stopMultiplier ?? 2,
      takeProfitMultiplier: p.takeProfitMultiplier ?? 3,
    })),
  },
  ulcer: {
    meta: ULCER_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `ulcer${p.period}`,
    createFactory: factory<{ source?: PriceSource; period?: number }>()(createUlcerIndex, (p) => ({
      period: p.period ?? 14,
      source: p.source,
    })),
  },

  // Trend
  supertrend: {
    meta: SUPERTREND_META,
    defaultParams: { period: 10, multiplier: 3 },
    snapshotName: "supertrend",
    createFactory: factory<{ period?: number; multiplier?: number }>()(createSupertrend, (p) => ({
      period: p.period ?? 10,
      multiplier: p.multiplier ?? 3,
    })),
  },
  parabolicSar: {
    meta: PARABOLIC_SAR_META,
    defaultParams: {},
    snapshotName: "sar",
    createFactory: factory<{ step?: number; max?: number }>()(createParabolicSar, (p) => ({
      step: p.step,
      max: p.max,
    })),
  },
  ichimoku: {
    meta: ICHIMOKU_META,
    defaultParams: {},
    snapshotName: "ichimoku",
    createFactory: factory<{
      tenkanPeriod?: number;
      kijunPeriod?: number;
      senkouBPeriod?: number;
      displacement?: number;
    }>()(createIchimoku, (p) => ({
      tenkanPeriod: p.tenkanPeriod,
      kijunPeriod: p.kijunPeriod,
      senkouBPeriod: p.senkouBPeriod,
      displacement: p.displacement,
    })),
  },

  // Volume
  obv: {
    meta: OBV_META,
    defaultParams: {},
    snapshotName: "obv",
    createFactory: factory()(createObv, () => ({})),
  },
  cmf: {
    meta: CMF_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `cmf${p.period}`,
    createFactory: factory<{ period?: number }>()(createCmf, (p) => ({ period: p.period ?? 20 })),
  },
  mfi: {
    meta: MFI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `mfi${p.period}`,
    createFactory: factory<{ period?: number }>()(createMfi, (p) => ({ period: p.period ?? 14 })),
  },
  vwap: {
    meta: VWAP_META,
    defaultParams: {},
    snapshotName: "vwap",
    createFactory: factory()(createVwap, () => ({})),
  },
  adl: {
    meta: ADL_META,
    defaultParams: {},
    snapshotName: "adl",
    createFactory: factory()(createAdl, () => ({})),
  },
  twap: {
    meta: TWAP_META,
    defaultParams: {},
    snapshotName: "twap",
    createFactory: factory()(createTwap, () => ({})),
  },
  elderForceIndex: {
    meta: ELDER_FORCE_INDEX_META,
    defaultParams: { period: 13 },
    snapshotName: "efi",
    createFactory: factory<{ period?: number }>()(createElderForceIndex, (p) => ({
      period: p.period ?? 13,
    })),
  },
  volumeAnomaly: {
    meta: VOLUME_ANOMALY_META,
    defaultParams: {},
    snapshotName: "volAnomaly",
    createFactory: factory<{ period?: number; threshold?: number }>()(createVolumeAnomaly, (p) => ({
      period: p.period,
      threshold: p.threshold,
    })),
  },
  klinger: {
    meta: KLINGER_META,
    defaultParams: {},
    snapshotName: "klinger",
    createFactory: factory<{ fastPeriod?: number; slowPeriod?: number; signalPeriod?: number }>()(
      createKlinger,
      (p) => ({
        fastPeriod: p.fastPeriod,
        slowPeriod: p.slowPeriod,
        signalPeriod: p.signalPeriod,
      }),
    ),
  },
  pvt: {
    meta: PVT_META,
    defaultParams: {},
    snapshotName: "pvt",
    createFactory: () => (state) => createPvt(restoreState(state)),
  },
  nvi: {
    meta: NVI_META,
    defaultParams: { initialValue: 1000 },
    snapshotName: "nvi",
    createFactory: factory<{ initialValue?: number }>()(createNvi, (p) => ({
      initialValue: p.initialValue ?? 1000,
    })),
  },
  cvd: {
    meta: CVD_META,
    defaultParams: {},
    snapshotName: "cvd",
    createFactory: () => (state) => createCvd(restoreState(state)),
  },
  weisWave: {
    meta: WEIS_WAVE_META,
    defaultParams: { method: "close", threshold: 0 },
    snapshotName: "weisWave",
    createFactory: factory<{ method?: "close" | "highlow"; threshold?: number }>()(
      createWeisWave,
      (p) => ({
        method: p.method ?? "close",
        threshold: p.threshold ?? 0,
      }),
    ),
  },
  anchoredVwap: {
    meta: ANCHORED_VWAP_META,
    defaultParams: { bands: 0 },
    snapshotName: "avwap",
    createFactory: factory<{ anchorTime?: number; bands?: number }>()(createAnchoredVwap, (p) => ({
      anchorTime: p.anchorTime ?? 0,
      bands: p.bands ?? 0,
    })),
  },
  emv: {
    meta: EMV_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `emv${p.period}`,
    createFactory: factory<{ period?: number; volumeDivisor?: number }>()(createEmv, (p) => ({
      period: p.period ?? 14,
      volumeDivisor: p.volumeDivisor ?? 10000,
    })),
  },
  volumeTrend: {
    meta: VOLUME_TREND_META,
    defaultParams: { pricePeriod: 10, volumePeriod: 10, maPeriod: 20 },
    snapshotName: "volTrend",
    createFactory: factory<{
      pricePeriod?: number;
      volumePeriod?: number;
      maPeriod?: number;
      minPriceChange?: number;
    }>()(createVolumeTrend, (p) => ({
      pricePeriod: p.pricePeriod ?? 10,
      volumePeriod: p.volumePeriod ?? 10,
      maPeriod: p.maPeriod ?? 20,
      minPriceChange: p.minPriceChange ?? 2.0,
    })),
  },

  // Price
  highestLowest: {
    meta: HIGHEST_LOWEST_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `hilo${p.period}`,
    createFactory: factory<{ period?: number }>()(createHighestLowest, (p) => ({
      period: p.period ?? 20,
    })),
  },
  pivotPoints: {
    meta: PIVOT_POINTS_META,
    defaultParams: { method: "standard" },
    snapshotName: (p) => `pivot_${p.method}`,
    createFactory: factory<{ method?: "standard" }>()(createPivotPoints, (p) => ({
      method: p.method ?? "standard",
    })),
  },
  fractals: {
    meta: FRACTALS_META,
    defaultParams: { period: 2 },
    snapshotName: (p) => `frac${p.period}`,
    createFactory: factory<{ period?: number }>()(createFractals, (p) => ({
      period: p.period ?? 2,
    })),
  },
  gapAnalysis: {
    meta: GAP_ANALYSIS_META,
    defaultParams: { minGapPercent: 0.5 },
    snapshotName: "gap",
    createFactory: factory<{ minGapPercent?: number }>()(createGapAnalysis, (p) => ({
      minGapPercent: p.minGapPercent ?? 0.5,
    })),
  },
  orb: {
    meta: ORB_META,
    defaultParams: { minutes: 30 },
    snapshotName: "orb",
    createFactory: factory<{ minutes?: number; sessionResetPeriod?: "day" | number }>()(
      createOpeningRange,
      (p) => ({
        minutes: p.minutes ?? 30,
        sessionResetPeriod: p.sessionResetPeriod ?? "day",
      }),
    ),
  },
  fvg: {
    meta: FVG_META,
    defaultParams: { minGapPercent: 0, maxActiveFvgs: 10 },
    snapshotName: "fvg",
    createFactory: factory<{
      minGapPercent?: number;
      maxActiveFvgs?: number;
      partialFill?: boolean;
    }>()(createFairValueGap, (p) => ({
      minGapPercent: p.minGapPercent ?? 0,
      maxActiveFvgs: p.maxActiveFvgs ?? 10,
      partialFill: p.partialFill ?? true,
    })),
  },

  // Wyckoff
  vsa: {
    meta: VSA_META,
    defaultParams: { volumeMaPeriod: 20, atrPeriod: 14 },
    snapshotName: "vsa",
    createFactory: factory<{ volumeMaPeriod?: number; atrPeriod?: number }>()(createVsa, (p) => ({
      volumeMaPeriod: p.volumeMaPeriod ?? 20,
      atrPeriod: p.atrPeriod ?? 14,
    })),
  },
};
