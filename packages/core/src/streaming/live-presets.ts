/**
 * Live Indicator Presets
 *
 * Bundles incremental indicator factories with their domain metadata.
 * Used by chart's `connectLiveFeed` for zero-config indicator registration.
 *
 * @example
 * ```ts
 * import { livePresets, streaming } from "trendcraft";
 * import { connectLiveFeed } from "@trendcraft/chart";
 *
 * const conn = connectLiveFeed(chart, live, {
 *   presets: livePresets,
 *   history: candles,
 * });
 * conn.addIndicator("rsi");             // zero config
 * conn.addIndicator("sma", { period: 50 }); // custom params
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
  createFrama,
  createGarmanKlass,
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
  createParabolicSar,
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
  createVwap,
  createVwma,
  createWeisWave,
  createWilliamsR,
  createWma,
  createZlema,
  restoreState,
} from "../indicators/incremental";
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
  FRAMA_META,
  GARMAN_KLASS_META,
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
  PARABOLIC_SAR_META,
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
  VWAP_META,
  VWMA_META,
  WEIS_WAVE_META,
  WILLIAMS_R_META,
  WMA_META,
  ZLEMA_META,
} from "../indicators/indicator-meta";
import type { SeriesMeta } from "../types/candle";
import type { LiveIndicatorFactory } from "./types";

/**
 * A live indicator preset: factory + metadata + defaults.
 * Consumed by chart's connectLiveFeed for zero-config indicator management.
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

/** Helper to create a factory builder with restoreState wiring */
function factory<T>(
  // biome-ignore lint/suspicious/noExplicitAny: bridging generic create functions with unknown state
  create: (params: T, warmUp?: any) => ReturnType<LiveIndicatorFactory>,
  mapParams: (p: Record<string, unknown>) => T,
): (params: Record<string, unknown>) => LiveIndicatorFactory {
  return (params) => (state) => create(mapParams(params), restoreState(state));
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
    createFactory: factory(createSma, (p) => ({
      period: (p.period as number) ?? 20,
      source: p.source as "close" | undefined,
    })),
  },
  ema: {
    meta: EMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `ema${p.period}`,
    createFactory: factory(createEma, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  wma: {
    meta: WMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `wma${p.period}`,
    createFactory: factory(createWma, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  vwma: {
    meta: VWMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `vwma${p.period}`,
    createFactory: factory(createVwma, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  kama: {
    meta: KAMA_META,
    defaultParams: { period: 10 },
    snapshotName: (p) => `kama${p.period}`,
    createFactory: factory(createKama, (p) => ({ period: (p.period as number) ?? 10 })),
  },
  hma: {
    meta: HMA_META,
    defaultParams: { period: 16 },
    snapshotName: (p) => `hma${p.period}`,
    createFactory: factory(createHma, (p) => ({ period: (p.period as number) ?? 16 })),
  },
  t3: {
    meta: T3_META,
    defaultParams: { period: 5 },
    snapshotName: (p) => `t3_${p.period}`,
    createFactory: factory(createT3, (p) => ({ period: (p.period as number) ?? 5 })),
  },
  mcginley: {
    meta: MCGINLEY_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `mcginley${p.period}`,
    createFactory: factory(createMcGinleyDynamic, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  emaRibbon: {
    meta: EMA_RIBBON_META,
    defaultParams: { periods: [8, 13, 21, 34, 55] },
    snapshotName: "emaRibbon",
    createFactory: factory(createEmaRibbon, (p) => ({
      periods: p.periods as number[] | undefined,
    })),
  },
  dema: {
    meta: DEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `dema${p.period}`,
    createFactory: factory(createDema, (p) => ({
      period: (p.period as number) ?? 20,
      source: p.source as "close" | undefined,
    })),
  },
  tema: {
    meta: TEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `tema${p.period}`,
    createFactory: factory(createTema, (p) => ({
      period: (p.period as number) ?? 20,
      source: p.source as "close" | undefined,
    })),
  },
  zlema: {
    meta: ZLEMA_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `zlema${p.period}`,
    createFactory: factory(createZlema, (p) => ({
      period: (p.period as number) ?? 20,
      source: p.source as "close" | undefined,
    })),
  },
  alma: {
    meta: ALMA_META,
    defaultParams: { period: 9, offset: 0.85, sigma: 6 },
    snapshotName: (p) => `alma${p.period}_${p.offset ?? 0.85}_${p.sigma ?? 6}`,
    createFactory: factory(createAlma, (p) => ({
      period: (p.period as number) ?? 9,
      offset: (p.offset as number) ?? 0.85,
      sigma: (p.sigma as number) ?? 6,
      source: p.source as "close" | undefined,
    })),
  },
  frama: {
    meta: FRAMA_META,
    defaultParams: { period: 16 },
    snapshotName: (p) => `frama${p.period}`,
    createFactory: factory(createFrama, (p) => ({
      period: (p.period as number) ?? 16,
      source: p.source as "close" | undefined,
    })),
  },

  // Momentum
  rsi: {
    meta: RSI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `rsi${p.period}`,
    createFactory: factory(createRsi, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  macd: {
    meta: MACD_META,
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    snapshotName: "macd",
    createFactory: factory(createMacd, (p) => ({
      fastPeriod: p.fastPeriod as number | undefined,
      slowPeriod: p.slowPeriod as number | undefined,
      signalPeriod: p.signalPeriod as number | undefined,
    })),
  },
  stochastics: {
    meta: STOCHASTICS_META,
    defaultParams: { kPeriod: 14, dPeriod: 3, slowing: 3 },
    snapshotName: "stoch",
    createFactory: factory(createStochastics, (p) => ({
      kPeriod: p.kPeriod as number | undefined,
      dPeriod: p.dPeriod as number | undefined,
      slowing: p.slowing as number | undefined,
    })),
  },
  dmi: {
    meta: DMI_META,
    defaultParams: { period: 14 },
    snapshotName: "dmi",
    createFactory: factory(createDmi, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  roc: {
    meta: ROC_META,
    defaultParams: { period: 12 },
    snapshotName: (p) => `roc${p.period}`,
    createFactory: factory(createRoc, (p) => ({ period: (p.period as number) ?? 12 })),
  },
  williamsR: {
    meta: WILLIAMS_R_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `willR${p.period}`,
    createFactory: factory(createWilliamsR, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  cci: {
    meta: CCI_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `cci${p.period}`,
    createFactory: factory(createCci, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  stochRsi: {
    meta: STOCH_RSI_META,
    defaultParams: { rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3 },
    snapshotName: "stochRsi",
    createFactory: factory(createStochRsi, (p) => ({
      rsiPeriod: p.rsiPeriod as number | undefined,
      stochPeriod: p.stochPeriod as number | undefined,
      kPeriod: p.kPeriod as number | undefined,
      dPeriod: p.dPeriod as number | undefined,
    })),
  },
  trix: {
    meta: TRIX_META,
    defaultParams: { period: 15 },
    snapshotName: (p) => `trix${p.period}`,
    createFactory: factory(createTrix, (p) => ({ period: (p.period as number) ?? 15 })),
  },
  aroon: {
    meta: AROON_META,
    defaultParams: { period: 25 },
    snapshotName: "aroon",
    createFactory: factory(createAroon, (p) => ({ period: (p.period as number) ?? 25 })),
  },
  connorsRsi: {
    meta: CONNORS_RSI_META,
    defaultParams: { rsiPeriod: 3, streakPeriod: 2, rocPeriod: 100 },
    snapshotName: "crsi",
    createFactory: factory(createConnorsRsi, (p) => ({
      rsiPeriod: p.rsiPeriod as number | undefined,
      streakPeriod: p.streakPeriod as number | undefined,
      rocPeriod: p.rocPeriod as number | undefined,
    })),
  },
  cmo: {
    meta: CMO_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `cmo${p.period}`,
    createFactory: factory(createCmo, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  adxr: {
    meta: ADXR_META,
    defaultParams: { period: 14 },
    snapshotName: "adxr",
    createFactory: factory(createAdxr, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  imi: {
    meta: IMI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `imi${p.period}`,
    createFactory: factory(createImi, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  vortex: {
    meta: VORTEX_META,
    defaultParams: { period: 14 },
    snapshotName: "vortex",
    createFactory: factory(createVortex, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  ao: {
    meta: AO_META,
    defaultParams: { fastPeriod: 5, slowPeriod: 34 },
    snapshotName: "ao",
    createFactory: factory(createAwesomeOscillator, (p) => ({
      fastPeriod: (p.fastPeriod as number) ?? 5,
      slowPeriod: (p.slowPeriod as number) ?? 34,
    })),
  },
  bop: {
    meta: BOP_META,
    defaultParams: { smoothPeriod: 14 },
    snapshotName: (p) => `bop${p.smoothPeriod}`,
    createFactory: factory(createBalanceOfPower, (p) => ({
      smoothPeriod: (p.smoothPeriod as number) ?? 14,
    })),
  },
  qstick: {
    meta: QSTICK_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `qstick${p.period}`,
    createFactory: factory(createQStick, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  ppo: {
    meta: PPO_META,
    defaultParams: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
    snapshotName: "ppo",
    createFactory: factory(createPpo, (p) => ({
      fastPeriod: (p.fastPeriod as number) ?? 12,
      slowPeriod: (p.slowPeriod as number) ?? 26,
      signalPeriod: (p.signalPeriod as number) ?? 9,
      source: p.source as "close" | undefined,
    })),
  },
  coppock: {
    meta: COPPOCK_META,
    defaultParams: { wmaPeriod: 10, longRocPeriod: 14, shortRocPeriod: 11 },
    snapshotName: "coppock",
    createFactory: factory(createCoppockCurve, (p) => ({
      wmaPeriod: (p.wmaPeriod as number) ?? 10,
      longRocPeriod: (p.longRocPeriod as number) ?? 14,
      shortRocPeriod: (p.shortRocPeriod as number) ?? 11,
      source: p.source as "close" | undefined,
    })),
  },
  massIndex: {
    meta: MASS_INDEX_META,
    defaultParams: { emaPeriod: 9, sumPeriod: 25 },
    snapshotName: "massIndex",
    createFactory: factory(createMassIndex, (p) => ({
      emaPeriod: (p.emaPeriod as number) ?? 9,
      sumPeriod: (p.sumPeriod as number) ?? 25,
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
    createFactory: factory(createUltimateOscillator, (p) => ({
      period1: (p.period1 as number) ?? 7,
      period2: (p.period2 as number) ?? 14,
      period3: (p.period3 as number) ?? 28,
    })),
  },
  tsi: {
    meta: TSI_META,
    defaultParams: { longPeriod: 25, shortPeriod: 13, signalPeriod: 7 },
    snapshotName: "tsi",
    createFactory: factory(createTsi, (p) => ({
      longPeriod: (p.longPeriod as number) ?? 25,
      shortPeriod: (p.shortPeriod as number) ?? 13,
      signalPeriod: (p.signalPeriod as number) ?? 7,
      source: p.source as "close" | undefined,
    })),
  },
  kst: {
    meta: KST_META,
    defaultParams: { signalPeriod: 9 },
    snapshotName: "kst",
    createFactory: factory(createKst, (p) => ({
      signalPeriod: (p.signalPeriod as number) ?? 9,
      source: p.source as "close" | undefined,
    })),
  },
  hurst: {
    meta: HURST_META,
    defaultParams: { minWindow: 20, maxWindow: 100 },
    snapshotName: "hurst",
    createFactory: factory(createHurst, (p) => ({
      minWindow: (p.minWindow as number) ?? 20,
      maxWindow: (p.maxWindow as number) ?? 100,
      source: p.source as "close" | undefined,
    })),
  },
  stc: {
    meta: STC_META,
    defaultParams: { fastPeriod: 23, slowPeriod: 50, cyclePeriod: 10 },
    snapshotName: "stc",
    createFactory: factory(createStc, (p) => ({
      fastPeriod: (p.fastPeriod as number) ?? 23,
      slowPeriod: (p.slowPeriod as number) ?? 50,
      cyclePeriod: (p.cyclePeriod as number) ?? 10,
      source: p.source as "close" | undefined,
    })),
  },

  // Volatility
  atr: {
    meta: ATR_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `atr${p.period}`,
    createFactory: factory(createAtr, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  bb: {
    meta: BB_META,
    defaultParams: { period: 20, stdDev: 2 },
    snapshotName: (p) => `bb${p.period}`,
    createFactory: factory(createBollingerBands, (p) => ({
      period: (p.period as number) ?? 20,
      stdDev: p.stdDev as number | undefined,
    })),
  },
  donchian: {
    meta: DONCHIAN_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `donchian${p.period}`,
    createFactory: factory(createDonchianChannel, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  keltner: {
    meta: KELTNER_META,
    defaultParams: { emaPeriod: 20, atrPeriod: 10, multiplier: 1.5 },
    snapshotName: "keltner",
    createFactory: factory(createKeltnerChannel, (p) => ({
      emaPeriod: p.emaPeriod as number | undefined,
      atrPeriod: p.atrPeriod as number | undefined,
      multiplier: p.multiplier as number | undefined,
    })),
  },
  chandelierExit: {
    meta: CHANDELIER_EXIT_META,
    defaultParams: { period: 22, multiplier: 3 },
    snapshotName: "chandelier",
    createFactory: factory(createChandelierExit, (p) => ({
      period: (p.period as number) ?? 22,
      multiplier: (p.multiplier as number) ?? 3,
    })),
  },
  choppiness: {
    meta: CHOPPINESS_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `chop${p.period}`,
    createFactory: factory(createChoppinessIndex, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  ewmaVol: {
    meta: EWMA_VOL_META,
    defaultParams: { lambda: 0.94 },
    snapshotName: (p) => `ewma${p.lambda}`,
    createFactory: factory(createEwmaVolatility, (p) => ({
      lambda: (p.lambda as number) ?? 0.94,
      source: p.source as "close" | undefined,
    })),
  },
  garmanKlass: {
    meta: GARMAN_KLASS_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `gk${p.period}`,
    createFactory: factory(createGarmanKlass, (p) => ({
      period: (p.period as number) ?? 20,
      annualFactor: (p.annualFactor as number) ?? 252,
    })),
  },
  hv: {
    meta: HV_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `hv${p.period}`,
    createFactory: factory(createHistoricalVolatility, (p) => ({
      period: (p.period as number) ?? 20,
      annualFactor: (p.annualFactor as number) ?? 252,
      source: p.source as "close" | undefined,
    })),
  },
  atrStops: {
    meta: ATR_STOPS_META,
    defaultParams: { period: 14, stopMultiplier: 2, takeProfitMultiplier: 3 },
    snapshotName: "atrStops",
    createFactory: factory(createAtrStops, (p) => ({
      period: (p.period as number) ?? 14,
      stopMultiplier: (p.stopMultiplier as number) ?? 2,
      takeProfitMultiplier: (p.takeProfitMultiplier as number) ?? 3,
    })),
  },
  ulcer: {
    meta: ULCER_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `ulcer${p.period}`,
    createFactory: factory(createUlcerIndex, (p) => ({
      period: (p.period as number) ?? 14,
      source: p.source as "close" | undefined,
    })),
  },

  // Trend
  supertrend: {
    meta: SUPERTREND_META,
    defaultParams: { period: 10, multiplier: 3 },
    snapshotName: "supertrend",
    createFactory: factory(createSupertrend, (p) => ({
      period: (p.period as number) ?? 10,
      multiplier: (p.multiplier as number) ?? 3,
    })),
  },
  parabolicSar: {
    meta: PARABOLIC_SAR_META,
    defaultParams: {},
    snapshotName: "sar",
    createFactory: factory(createParabolicSar, (p) => ({
      step: p.step as number | undefined,
      max: p.max as number | undefined,
    })),
  },
  ichimoku: {
    meta: ICHIMOKU_META,
    defaultParams: {},
    snapshotName: "ichimoku",
    createFactory: factory(createIchimoku, (p) => ({
      tenkanPeriod: p.tenkanPeriod as number | undefined,
      kijunPeriod: p.kijunPeriod as number | undefined,
      senkouBPeriod: p.senkouBPeriod as number | undefined,
      displacement: p.displacement as number | undefined,
    })),
  },

  // Volume
  obv: {
    meta: OBV_META,
    defaultParams: {},
    snapshotName: "obv",
    createFactory: factory(createObv, () => ({})),
  },
  cmf: {
    meta: CMF_META,
    defaultParams: { period: 20 },
    snapshotName: (p) => `cmf${p.period}`,
    createFactory: factory(createCmf, (p) => ({ period: (p.period as number) ?? 20 })),
  },
  mfi: {
    meta: MFI_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `mfi${p.period}`,
    createFactory: factory(createMfi, (p) => ({ period: (p.period as number) ?? 14 })),
  },
  vwap: {
    meta: VWAP_META,
    defaultParams: {},
    snapshotName: "vwap",
    createFactory: factory(createVwap, () => ({})),
  },
  adl: {
    meta: ADL_META,
    defaultParams: {},
    snapshotName: "adl",
    createFactory: factory(createAdl, () => ({})),
  },
  twap: {
    meta: TWAP_META,
    defaultParams: {},
    snapshotName: "twap",
    createFactory: factory(createTwap, () => ({})),
  },
  elderForceIndex: {
    meta: ELDER_FORCE_INDEX_META,
    defaultParams: { period: 13 },
    snapshotName: "efi",
    createFactory: factory(createElderForceIndex, (p) => ({ period: (p.period as number) ?? 13 })),
  },
  volumeAnomaly: {
    meta: VOLUME_ANOMALY_META,
    defaultParams: {},
    snapshotName: "volAnomaly",
    createFactory: factory(createVolumeAnomaly, (p) => ({
      period: p.period as number | undefined,
      threshold: p.threshold as number | undefined,
    })),
  },
  klinger: {
    meta: KLINGER_META,
    defaultParams: {},
    snapshotName: "klinger",
    createFactory: factory(createKlinger, (p) => ({
      fastPeriod: p.fastPeriod as number | undefined,
      slowPeriod: p.slowPeriod as number | undefined,
      signalPeriod: p.signalPeriod as number | undefined,
    })),
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
    createFactory: factory(createNvi, (p) => ({
      initialValue: (p.initialValue as number) ?? 1000,
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
    createFactory: factory(createWeisWave, (p) => ({
      method: (p.method as "close" | "highlow") ?? "close",
      threshold: (p.threshold as number) ?? 0,
    })),
  },
  anchoredVwap: {
    meta: ANCHORED_VWAP_META,
    defaultParams: { bands: 0 },
    snapshotName: "avwap",
    createFactory: factory(createAnchoredVwap, (p) => ({
      anchorTime: (p.anchorTime as number) ?? 0,
      bands: (p.bands as number) ?? 0,
    })),
  },
  emv: {
    meta: EMV_META,
    defaultParams: { period: 14 },
    snapshotName: (p) => `emv${p.period}`,
    createFactory: factory(createEmv, (p) => ({
      period: (p.period as number) ?? 14,
      volumeDivisor: (p.volumeDivisor as number) ?? 10000,
    })),
  },
  volumeTrend: {
    meta: VOLUME_TREND_META,
    defaultParams: { pricePeriod: 10, volumePeriod: 10, maPeriod: 20 },
    snapshotName: "volTrend",
    createFactory: factory(createVolumeTrend, (p) => ({
      pricePeriod: (p.pricePeriod as number) ?? 10,
      volumePeriod: (p.volumePeriod as number) ?? 10,
      maPeriod: (p.maPeriod as number) ?? 20,
      minPriceChange: (p.minPriceChange as number) ?? 2.0,
    })),
  },
};
