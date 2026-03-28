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
  createAroon,
  createAtr,
  createBollingerBands,
  createCci,
  createChandelierExit,
  createChoppinessIndex,
  createCmf,
  createCmo,
  createConnorsRsi,
  createDmi,
  createDonchianChannel,
  createElderForceIndex,
  createEma,
  createEmaRibbon,
  createHma,
  createIchimoku,
  createImi,
  createKama,
  createKeltnerChannel,
  createKlinger,
  createMacd,
  createMcGinleyDynamic,
  createMfi,
  createObv,
  createParabolicSar,
  createRoc,
  createRsi,
  createSma,
  createStochRsi,
  createStochastics,
  createSupertrend,
  createT3,
  createTrix,
  createTwap,
  createVolumeAnomaly,
  createVortex,
  createVwap,
  createVwma,
  createWilliamsR,
  createWma,
  restoreState,
} from "../indicators/incremental";
import {
  ADL_META,
  ADXR_META,
  AROON_META,
  ATR_META,
  BB_META,
  CCI_META,
  CHANDELIER_EXIT_META,
  CHOPPINESS_META,
  CMF_META,
  CMO_META,
  CONNORS_RSI_META,
  DMI_META,
  DONCHIAN_META,
  ELDER_FORCE_INDEX_META,
  EMA_META,
  EMA_RIBBON_META,
  HMA_META,
  HMM_REGIME_META,
  ICHIMOKU_META,
  IMI_META,
  KAMA_META,
  KELTNER_META,
  KLINGER_META,
  MACD_META,
  MCGINLEY_META,
  MFI_META,
  OBV_META,
  PARABOLIC_SAR_META,
  ROC_META,
  RSI_META,
  SMA_META,
  STOCHASTICS_META,
  STOCH_RSI_META,
  SUPERTREND_META,
  T3_META,
  TRIX_META,
  TWAP_META,
  VOLUME_ANOMALY_META,
  VORTEX_META,
  VWAP_META,
  VWMA_META,
  WILLIAMS_R_META,
  WMA_META,
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
};
