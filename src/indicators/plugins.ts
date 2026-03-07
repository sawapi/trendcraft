/**
 * Built-in indicator plugin definitions
 *
 * Wraps existing indicator functions as IndicatorPlugin instances
 * for use with `TrendCraft.use()`.
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
import { sma } from "./moving-average/sma";
import { ema } from "./moving-average/ema";
import { rsi } from "./momentum/rsi";
import { macd } from "./momentum/macd";
import { bollingerBands } from "./volatility/bollinger-bands";
import { atr } from "./volatility/atr";
import { volumeMa } from "./volume/volume-ma";
import { highest, lowest } from "./price/highest-lowest";
import { returns } from "./price/returns";
import { parabolicSar } from "./trend/parabolic-sar";
import { keltnerChannel } from "./volatility/keltner-channel";
import { cmf } from "./volume/cmf";
import { volumeAnomaly } from "./volume/volume-anomaly";
import { volumeProfileSeries } from "./volume/volume-profile";
import { volumeTrend } from "./volume/volume-trend";

/** SMA plugin */
export const smaPlugin = defineIndicator({
  name: "sma" as const,
  compute: (candles, opts) => sma(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `sma${opts.period}` : `sma${opts.period}_${opts.source}`,
});

/** EMA plugin */
export const emaPlugin = defineIndicator({
  name: "ema" as const,
  compute: (candles, opts) => ema(candles, { period: opts.period, source: opts.source }),
  defaultOptions: { period: 20, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `ema${opts.period}` : `ema${opts.period}_${opts.source}`,
});

/** RSI plugin */
export const rsiPlugin = defineIndicator({
  name: "rsi" as const,
  compute: (candles, opts) => rsi(candles, { period: opts.period }),
  defaultOptions: { period: 14 },
  buildKey: (opts) => `rsi${opts.period}`,
});

/** MACD plugin */
export const macdPlugin = defineIndicator({
  name: "macd" as const,
  compute: (candles, opts) =>
    macd(candles, {
      fastPeriod: opts.fast,
      slowPeriod: opts.slow,
      signalPeriod: opts.signal,
    }),
  defaultOptions: { fast: 12, slow: 26, signal: 9 },
  buildKey: (opts) => `macd_${opts.fast}_${opts.slow}_${opts.signal}`,
});

/** Bollinger Bands plugin */
export const bollingerBandsPlugin = defineIndicator({
  name: "bollingerBands" as const,
  compute: (candles, opts) =>
    bollingerBands(candles, {
      period: opts.period,
      stdDev: opts.stdDev,
      source: opts.source,
    }),
  defaultOptions: { period: 20, stdDev: 2, source: "close" as PriceSource },
  buildKey: (opts) =>
    opts.source === "close" ? `bb${opts.period}` : `bb${opts.period}_${opts.source}`,
});

/** ATR plugin */
export const atrPlugin = defineIndicator({
  name: "atr" as const,
  compute: (candles, opts) => atr(candles, { period: opts.period }),
  defaultOptions: { period: 14 },
  buildKey: (opts) => `atr${opts.period}`,
});

/** Volume Moving Average plugin */
export const volumeMaPlugin = defineIndicator({
  name: "volumeMa" as const,
  compute: (candles, opts) => volumeMa(candles, { period: opts.period, type: opts.maType }),
  defaultOptions: { period: 20, maType: "sma" as "sma" | "ema" },
  buildKey: (opts) =>
    opts.maType === "sma" ? `vma${opts.period}` : `vma${opts.period}_ema`,
});

/** Highest High plugin */
export const highestPlugin = defineIndicator({
  name: "highest" as const,
  compute: (candles, opts) => highest(candles, opts.period),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `highest${opts.period}`,
});

/** Lowest Low plugin */
export const lowestPlugin = defineIndicator({
  name: "lowest" as const,
  compute: (candles, opts) => lowest(candles, opts.period),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `lowest${opts.period}`,
});

/** Returns plugin */
export const returnsPlugin = defineIndicator({
  name: "returns" as const,
  compute: (candles, opts) => returns(candles, { period: opts.period, type: opts.returnType }),
  defaultOptions: { period: 1, returnType: "simple" as "simple" | "log" },
  buildKey: (opts) =>
    opts.returnType === "simple"
      ? `returns${opts.period}`
      : `returns${opts.period}_log`,
});

/** Parabolic SAR plugin */
export const parabolicSarPlugin = defineIndicator({
  name: "parabolicSar" as const,
  compute: (candles, opts) =>
    parabolicSar(candles, { step: opts.step, max: opts.max }),
  defaultOptions: { step: 0.02, max: 0.2 },
  buildKey: (opts) => `psar_${opts.step}_${opts.max}`,
});

/** Keltner Channel plugin */
export const keltnerChannelPlugin = defineIndicator({
  name: "keltnerChannel" as const,
  compute: (candles, opts) =>
    keltnerChannel(candles, {
      emaPeriod: opts.emaPeriod,
      atrPeriod: opts.atrPeriod,
      multiplier: opts.multiplier,
    }),
  defaultOptions: { emaPeriod: 20, atrPeriod: 10, multiplier: 2 },
  buildKey: (opts) => `kc_${opts.emaPeriod}_${opts.atrPeriod}_${opts.multiplier}`,
});

/** Chaikin Money Flow plugin */
export const cmfPlugin = defineIndicator({
  name: "cmf" as const,
  compute: (candles, opts) => cmf(candles, { period: opts.period }),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `cmf${opts.period}`,
});

/** Volume Anomaly plugin */
export const volumeAnomalyPlugin = defineIndicator({
  name: "volumeAnomaly" as const,
  compute: (candles, opts) =>
    volumeAnomaly(candles, {
      period: opts.period,
      highThreshold: opts.highThreshold,
    }),
  defaultOptions: { period: 20, highThreshold: 2.0 },
  buildKey: (opts) => `volAnomaly${opts.period}`,
});

/** Volume Profile Series plugin */
export const volumeProfileSeriesPlugin = defineIndicator({
  name: "volumeProfileSeries" as const,
  compute: (candles: NormalizedCandle[], opts) =>
    volumeProfileSeries(candles, { period: opts.period }),
  defaultOptions: { period: 20 },
  buildKey: (opts) => `volProfile${opts.period}`,
});

/** Volume Trend plugin */
export const volumeTrendPlugin = defineIndicator({
  name: "volumeTrend" as const,
  compute: (candles, opts) =>
    volumeTrend(candles, {
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
