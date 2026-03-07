/**
 * Built-in indicator plugin definitions
 *
 * Wraps existing indicator functions as IndicatorPlugin instances
 * for use with `TrendCraft.use()`.
 *
 * Exported under the `plugins` namespace from the package root:
 * ```typescript
 * import { plugins } from "trendcraft";
 * TrendCraft.from(candles).use(plugins.sma, { period: 50 });
 * ```
 */

import type {
  BollingerBandsValue,
  MacdValue,
  NormalizedCandle,
  PriceSource,
  VolumeAnomalyValue,
  VolumeProfileValue,
  VolumeTrendValue,
} from "../types";
import type { KeltnerChannelValue } from "./volatility/keltner-channel";
import type { ParabolicSarValue } from "./trend/parabolic-sar";
import { defineIndicator } from "../types/plugin";
import { sma as smaFn } from "./moving-average/sma";
import { ema as emaFn } from "./moving-average/ema";
import { rsi as rsiFn } from "./momentum/rsi";
import { macd as macdFn } from "./momentum/macd";
import { bollingerBands as bollingerBandsFn } from "./volatility/bollinger-bands";
import { atr as atrFn } from "./volatility/atr";
import { volumeMa as volumeMaFn } from "./volume/volume-ma";
import { highest as highestFn, lowest as lowestFn } from "./price/highest-lowest";
import { returns as returnsFn } from "./price/returns";
import { parabolicSar as parabolicSarFn } from "./trend/parabolic-sar";
import { keltnerChannel as keltnerChannelFn } from "./volatility/keltner-channel";
import { cmf as cmfFn } from "./volume/cmf";
import { volumeAnomaly as volumeAnomalyFn } from "./volume/volume-anomaly";
import { volumeProfileSeries as volumeProfileSeriesFn } from "./volume/volume-profile";
import { volumeTrend as volumeTrendFn } from "./volume/volume-trend";

/** SMA plugin */
export const sma = defineIndicator({
  name: "sma" as const,
  compute: (candles, opts) => smaFn(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `sma${opts.period}` : `sma${opts.period}_${opts.source}`,
});

/** EMA plugin */
export const ema = defineIndicator({
  name: "ema" as const,
  compute: (candles, opts) => emaFn(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `ema${opts.period}` : `ema${opts.period}_${opts.source}`,
});

/** RSI plugin */
export const rsi = defineIndicator({
  name: "rsi" as const,
  compute: (candles, opts) => rsiFn(candles, { period: opts.period }),
  defaultOptions: { period: 14 },
  buildKey: (opts) => `rsi${opts.period}`,
});

/** MACD plugin */
export const macd = defineIndicator({
  name: "macd" as const,
  compute: (candles, opts) =>
    macdFn(candles, {
      fastPeriod: opts.fast,
      slowPeriod: opts.slow,
      signalPeriod: opts.signal,
    }),
  defaultOptions: { fast: 12, slow: 26, signal: 9 },
  buildKey: (opts) => `macd_${opts.fast}_${opts.slow}_${opts.signal}`,
});

/** Bollinger Bands plugin */
export const bollingerBands = defineIndicator({
  name: "bollingerBands" as const,
  compute: (candles, opts) =>
    bollingerBandsFn(candles, {
      period: opts.period,
      stdDev: opts.stdDev,
      source: opts.source,
    }),
  defaultOptions: { period: 20, stdDev: 2, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `bb${opts.period}` : `bb${opts.period}_${opts.source}`,
});

/** ATR plugin */
export const atr = defineIndicator({
  name: "atr" as const,
  compute: (candles, opts) => atrFn(candles, { period: opts.period }),
  defaultOptions: { period: 14 },
  buildKey: (opts) => `atr${opts.period}`,
});

/** Volume Moving Average plugin */
export const volumeMa = defineIndicator({
  name: "volumeMa" as const,
  compute: (candles, opts) => volumeMaFn(candles, { period: opts.period, type: opts.maType }),
  defaultOptions: { period: 20, maType: "sma" as "sma" | "ema" },
  buildKey: (opts) =>
    opts.maType === "sma" ? `vma${opts.period}` : `vma${opts.period}_ema`,
});

/** Highest High plugin */
export const highest = defineIndicator({
  name: "highest" as const,
  compute: (candles, opts) => highestFn(candles, opts.period),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `highest${opts.period}`,
});

/** Lowest Low plugin */
export const lowest = defineIndicator({
  name: "lowest" as const,
  compute: (candles, opts) => lowestFn(candles, opts.period),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `lowest${opts.period}`,
});

/** Returns plugin */
export const returns = defineIndicator({
  name: "returns" as const,
  compute: (candles, opts) => returnsFn(candles, { period: opts.period, type: opts.returnType }),
  defaultOptions: { period: 1, returnType: "simple" as "simple" | "log" },
  buildKey: (opts) =>
    opts.returnType === "simple"
      ? `returns${opts.period}`
      : `returns${opts.period}_log`,
});

/** Parabolic SAR plugin */
export const parabolicSar = defineIndicator({
  name: "parabolicSar" as const,
  compute: (candles, opts) =>
    parabolicSarFn(candles, { step: opts.step, max: opts.max }),
  defaultOptions: { step: 0.02, max: 0.2 },
  buildKey: (opts) => `psar_${opts.step}_${opts.max}`,
});

/** Keltner Channel plugin */
export const keltnerChannel = defineIndicator({
  name: "keltnerChannel" as const,
  compute: (candles, opts) =>
    keltnerChannelFn(candles, {
      emaPeriod: opts.emaPeriod,
      atrPeriod: opts.atrPeriod,
      multiplier: opts.multiplier,
    }),
  defaultOptions: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
  buildKey: (opts) => `kc_${opts.emaPeriod}_${opts.atrPeriod}_${opts.multiplier}`,
});

/** Chaikin Money Flow plugin */
export const cmf = defineIndicator({
  name: "cmf" as const,
  compute: (candles, opts) => cmfFn(candles, { period: opts.period }),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `cmf${opts.period}`,
});

/** Volume Anomaly plugin */
export const volumeAnomaly = defineIndicator({
  name: "volumeAnomaly" as const,
  compute: (candles, opts) =>
    volumeAnomalyFn(candles, {
      period: opts.period,
      highThreshold: opts.highThreshold,
    }),
  defaultOptions: { period: 20, highThreshold: 2.0 },
  buildKey: (opts) => `volAnomaly${opts.period}`,
});

/** Volume Profile Series plugin */
export const volumeProfileSeries = defineIndicator({
  name: "volumeProfileSeries" as const,
  compute: (candles: NormalizedCandle[], opts) =>
    volumeProfileSeriesFn(candles, { period: opts.period }),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `volProfile${opts.period}`,
});

/** Volume Trend plugin */
export const volumeTrend = defineIndicator({
  name: "volumeTrend" as const,
  compute: (candles, opts) =>
    volumeTrendFn(candles, {
      pricePeriod: opts.pricePeriod,
      volumePeriod: opts.volumePeriod,
    }),
  defaultOptions: { pricePeriod: 10, volumePeriod: 10 },
  buildKey: (opts) => `volTrend${opts.pricePeriod}_${opts.volumePeriod}`,
});

// Re-export value types used by plugins for convenience
export type {
  MacdValue,
  BollingerBandsValue,
  ParabolicSarValue,
  KeltnerChannelValue,
  VolumeAnomalyValue,
  VolumeProfileValue,
  VolumeTrendValue,
};
