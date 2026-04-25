/**
 * Unified Indicator Presets
 *
 * Extends livePresets with batch `compute` functions, enabling both
 * static and streaming modes from a single registry.
 *
 * @example
 * ```ts
 * import { indicatorPresets } from "trendcraft";
 *
 * const rsi = indicatorPresets.rsi;
 *
 * // Static mode — one-shot batch computation
 * const series = rsi.compute(candles, { period: 14 });
 *
 * // Streaming mode — build an incremental indicator from the same entry
 * const factory = rsi.createFactory({ period: 14 });
 * ```
 */

import {
  adaptiveBollinger,
  adaptiveMa,
  // Additional indicators
  adaptiveRsi,
  adaptiveStochastics,
  adl,
  adxr,
  alma,
  anchoredVwap,
  aroon,
  atr,
  // 10 previously un-presetified batch indicators (added 2026-04-18)
  atrPercentSeries,
  atrStops,
  awesomeOscillator,
  balanceOfPower,
  bollingerBands,
  cci,
  chandelierExit,
  choppinessIndex,
  cmf,
  cmo,
  connorsRsi,
  coppockCurve,
  cumulativeReturns,
  cvd,
  cvdWithSignal,
  dema,
  dmi,
  donchianChannel,
  dpo,
  easeOfMovement,
  elderForceIndex,
  ema,
  emaRibbon,
  ewmaVolatility,
  fairValueGap,
  fastStochastics,
  fractals,
  frama,
  gapAnalysis,
  garmanKlass,
  heikinAshi,
  highest,
  highestLowest,
  historicalVolatility,
  hma,
  hurst,
  ichimoku,
  imi,
  kama,
  keltnerChannel,
  klinger,
  kst,
  linearRegression,
  liquiditySweep,
  lowest,
  macd,
  massIndex,
  mcginleyDynamic,
  medianPrice,
  mfi,
  nvi,
  obv,
  openingRange,
  orderBlock,
  parabolicSar,
  pivotPoints,
  ppo,
  pvt,
  qstick,
  returns,
  roc,
  roofingFilter,
  rsi,
  schaffTrendCycle,
  sessionBreakout,
  slowStochastics,
  sma,
  standardDeviation,
  stochRsi,
  stochastics,
  superSmoother,
  supertrend,
  swingPoints,
  t3,
  tema,
  trix,
  tsi,
  twap,
  typicalPrice,
  ulcerIndex,
  ultimateOscillator,
  volatilityRegime,
  volumeAnomaly,
  volumeMa,
  volumeTrend,
  vortex,
  vsa as vsaBatch,
  vwap,
  vwma,
  weightedClose,
  weisWave,
  williamsR,
  wma,
  zigzag,
  zlema,
} from "../indicators";
import {
  ADAPTIVE_BB_META,
  ADAPTIVE_MA_META,
  ADAPTIVE_RSI_META,
  ADAPTIVE_STOCH_META,
  CVD_SIGNAL_META,
  DPO_META,
  FAST_STOCH_META,
  HEIKIN_ASHI_META,
  LINEAR_REG_META,
  LIQUIDITY_SWEEP_META,
  ORDER_BLOCK_META,
  SESSION_BREAKOUT_META,
  SLOW_STOCH_META,
  STD_DEV_META,
  SWING_POINTS_META,
  VOLUME_MA_META,
  VOL_REGIME_META,
  ZIGZAG_META,
} from "../indicators/indicator-meta";
import type { NormalizedCandle, Series } from "../types";
import type { PriceSource, SeriesMeta } from "../types/candle";
import { livePresets } from "./live-presets";
import type { LiveIndicatorFactory } from "./types";

// ============================================
// Indicator Category & Param Schema
// ============================================

/** Indicator category for UI grouping */
export type IndicatorCategory =
  | "Moving Averages"
  | "Momentum"
  | "Volatility"
  | "Trend"
  | "Volume"
  | "Price"
  | "Wyckoff"
  | "Adaptive"
  | "Session"
  | "SMC"
  | "Filter";

/** Parameter schema for UI controls */
export type ParamSchema = {
  key: string;
  label: string;
  type: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
};

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
  /** Indicator category for UI grouping */
  category?: IndicatorCategory;
  /** Full indicator name (e.g., "Relative Strength Index") */
  name?: string;
  /** Short description */
  description?: string;
  /** Parameter schemas for UI controls (min/max/step) */
  paramSchema?: ParamSchema[];
};

/** Catalog metadata for withCompute helper */
type CatalogInfo = {
  category: IndicatorCategory;
  name: string;
  description: string;
  paramSchema?: ParamSchema[];
};

/** Reusable param schema builders */
const period = (def = 14, min = 2, max = 200): ParamSchema => ({
  key: "period",
  label: "Period",
  type: "number",
  default: def,
  min,
  max,
  step: 1,
});

/** Type-only helper for bare `compute:` properties on manually-assembled entries
 *  (ones that don't go through `withCompute`). Lets the author declare a
 *  `Partial<TParams>` shape for `params` while the returned function is still
 *  assignable to `IndicatorPreset.compute`'s erased signature. */
function typedCompute<TParams extends Record<string, unknown> = Record<string, unknown>>(
  // biome-ignore lint/suspicious/noExplicitAny: Series<unknown> output is narrowed per-indicator
  fn: (candles: NormalizedCandle[], params: Partial<TParams>) => Series<any>,
): IndicatorPreset["compute"] {
  return fn as IndicatorPreset["compute"];
}

/** Helper to extend a livePreset entry with a batch compute function + catalog metadata.
 *
 *  `TParams` is optional: when supplied, `params` inside `computeFn` is narrowed
 *  to `Partial<TParams>` so callers can write `p.period ?? 20` without
 *  `as number` casts. When omitted, `params` falls back to the permissive
 *  `any` used by pre-0.3.0 call sites — preserves compatibility for entries
 *  that haven't been migrated. Mirrors the `factory<TParams>()` pattern in
 *  live-presets.ts. */
function withCompute<TParams extends Record<string, unknown> | undefined = undefined>(
  key: string,
  computeFn: TParams extends Record<string, unknown>
    ? // biome-ignore lint/suspicious/noExplicitAny: Series<unknown> output is narrowed per-indicator
      (candles: NormalizedCandle[], params: Partial<TParams>) => Series<any>
    : // biome-ignore lint/suspicious/noExplicitAny: untyped fallback preserves pre-0.3.0 call sites
      (candles: NormalizedCandle[], params: any) => Series<any>,
  catalog?: CatalogInfo,
): IndicatorPreset {
  const live = livePresets[key];
  return {
    ...live,
    compute: computeFn as (
      candles: NormalizedCandle[],
      params: Record<string, unknown>,
    ) => Series<unknown>,
    ...catalog,
  };
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
  sma: withCompute("sma", (c, p) => sma(c, { period: p.period ?? 20, source: p.source }), {
    category: "Moving Averages",
    name: "Simple Moving Average",
    description: "Equal-weighted mean of closing prices over a fixed window.",
    paramSchema: [period(20)],
  }),
  ema: withCompute("ema", (c, p) => ema(c, { period: p.period ?? 20 }), {
    category: "Moving Averages",
    name: "Exponential Moving Average",
    description: "Exponentially weighted average giving more weight to recent prices.",
    paramSchema: [period(20)],
  }),
  wma: withCompute("wma", (c, p) => wma(c, { period: p.period ?? 20 }), {
    category: "Moving Averages",
    name: "Weighted Moving Average",
    description: "Linearly weighted average emphasizing recent data points.",
    paramSchema: [period(20)],
  }),
  vwma: withCompute("vwma", (c, p) => vwma(c, { period: p.period ?? 20 }), {
    category: "Moving Averages",
    name: "Volume Weighted Moving Average",
    description: "Moving average weighted by volume, highlighting high-activity price levels.",
    paramSchema: [period(20)],
  }),
  kama: withCompute("kama", (c, p) => kama(c, { period: p.period ?? 10 }), {
    category: "Moving Averages",
    name: "Kaufman Adaptive Moving Average",
    description: "Adapts smoothing speed based on market noise using the efficiency ratio.",
    paramSchema: [period(10)],
  }),
  hma: withCompute("hma", (c, p) => hma(c, { period: p.period ?? 16 }), {
    category: "Moving Averages",
    name: "Hull Moving Average",
    description: "Reduces lag while maintaining smoothness using weighted moving averages.",
    paramSchema: [period(16)],
  }),
  t3: withCompute("t3", (c, p) => t3(c, { period: p.period ?? 5 }), {
    category: "Moving Averages",
    name: "Tillson T3",
    description: "Ultra-smooth moving average using six cascaded exponential smoothing stages.",
    paramSchema: [period(5)],
  }),
  mcginley: withCompute("mcginley", (c, p) => mcginleyDynamic(c, { period: p.period ?? 14 }), {
    category: "Moving Averages",
    name: "McGinley Dynamic",
    description:
      "Self-adjusting moving average that tracks price more closely than traditional MAs.",
    paramSchema: [period(14)],
  }),
  emaRibbon: withCompute("emaRibbon", (c, p) => emaRibbon(c, { periods: p.periods }), {
    category: "Moving Averages",
    name: "EMA Ribbon",
    description: "Multiple EMAs at different periods forming a visual ribbon for trend strength.",
  }),
  dema: withCompute("dema", (c, p) => dema(c, { period: p.period ?? 20, source: p.source }), {
    category: "Moving Averages",
    name: "Double Exponential Moving Average",
    description: "Reduces lag by applying EMA of EMA with a correction formula.",
    paramSchema: [period(20)],
  }),
  tema: withCompute("tema", (c, p) => tema(c, { period: p.period ?? 20, source: p.source }), {
    category: "Moving Averages",
    name: "Triple Exponential Moving Average",
    description: "Further reduces lag using triple EMA calculation.",
    paramSchema: [period(20)],
  }),
  zlema: withCompute("zlema", (c, p) => zlema(c, { period: p.period ?? 20, source: p.source }), {
    category: "Moving Averages",
    name: "Zero-Lag EMA",
    description: "Eliminates inherent EMA lag by applying a momentum correction.",
    paramSchema: [period(20)],
  }),
  alma: withCompute(
    "alma",
    (c, p) =>
      alma(c, {
        period: p.period ?? 9,
        offset: p.offset ?? 0.85,
        sigma: p.sigma ?? 6,
        source: p.source,
      }),
    {
      category: "Moving Averages",
      name: "Arnaud Legoux Moving Average",
      description: "Gaussian-weighted moving average with configurable offset and sigma.",
      paramSchema: [
        period(9),
        {
          key: "offset",
          label: "Offset",
          type: "number",
          default: 0.85,
          min: 0,
          max: 1,
          step: 0.05,
        },
        { key: "sigma", label: "Sigma", type: "number", default: 6, min: 1, max: 20, step: 1 },
      ],
    },
  ),
  frama: withCompute("frama", (c, p) => frama(c, { period: p.period ?? 16, source: p.source }), {
    category: "Moving Averages",
    name: "Fractal Adaptive Moving Average",
    description: "Adapts to market fractal dimension, speeding up in trends and slowing in ranges.",
    paramSchema: [period(16)],
  }),

  // ============================================
  // Momentum
  // ============================================
  rsi: withCompute("rsi", (c, p) => rsi(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Relative Strength Index",
    description: "Measures overbought/oversold conditions on a 0-100 scale.",
    paramSchema: [period(14)],
  }),
  macd: withCompute(
    "macd",
    (c, p) =>
      macd(c, { fastPeriod: p.fastPeriod, slowPeriod: p.slowPeriod, signalPeriod: p.signalPeriod }),
    {
      category: "Momentum",
      name: "Moving Average Convergence Divergence",
      description: "Trend-following momentum indicator showing the relationship between two EMAs.",
      paramSchema: [
        {
          key: "fastPeriod",
          label: "Fast",
          type: "number",
          default: 12,
          min: 2,
          max: 100,
          step: 1,
        },
        {
          key: "slowPeriod",
          label: "Slow",
          type: "number",
          default: 26,
          min: 2,
          max: 200,
          step: 1,
        },
        {
          key: "signalPeriod",
          label: "Signal",
          type: "number",
          default: 9,
          min: 2,
          max: 50,
          step: 1,
        },
      ],
    },
  ),
  stochastics: withCompute(
    "stochastics",
    (c, p) => stochastics(c, { kPeriod: p.kPeriod, dPeriod: p.dPeriod, slowing: p.slowing }),
    {
      category: "Momentum",
      name: "Stochastic Oscillator",
      description: "Compares closing price to its range over a lookback period (0-100).",
      paramSchema: [
        {
          key: "kPeriod",
          label: "%K Period",
          type: "number",
          default: 14,
          min: 2,
          max: 100,
          step: 1,
        },
        {
          key: "dPeriod",
          label: "%D Period",
          type: "number",
          default: 3,
          min: 1,
          max: 50,
          step: 1,
        },
        { key: "slowing", label: "Slowing", type: "number", default: 3, min: 1, max: 10, step: 1 },
      ],
    },
  ),
  dmi: withCompute("dmi", (c, p) => dmi(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Directional Movement Index",
    description: "Measures trend strength (ADX) and direction (+DI/-DI).",
    paramSchema: [period(14)],
  }),
  roc: withCompute("roc", (c, p) => roc(c, { period: p.period ?? 12 }), {
    category: "Momentum",
    name: "Rate of Change",
    description: "Percentage change in price over a specified number of periods.",
    paramSchema: [period(12)],
  }),
  williamsR: withCompute("williamsR", (c, p) => williamsR(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Williams %R",
    description: "Oscillator measuring overbought/oversold levels on a -100 to 0 scale.",
    paramSchema: [period(14)],
  }),
  cci: withCompute("cci", (c, p) => cci(c, { period: p.period ?? 20 }), {
    category: "Momentum",
    name: "Commodity Channel Index",
    description: "Measures deviation from the statistical mean, centered at zero.",
    paramSchema: [period(20)],
  }),
  stochRsi: withCompute(
    "stochRsi",
    (c, p) =>
      stochRsi(c, {
        rsiPeriod: p.rsiPeriod,
        stochPeriod: p.stochPeriod,
        kPeriod: p.kPeriod,
        dPeriod: p.dPeriod,
      }),
    {
      category: "Momentum",
      name: "Stochastic RSI",
      description: "Applies stochastic calculation to RSI for more sensitive signals.",
      paramSchema: [
        {
          key: "rsiPeriod",
          label: "RSI Period",
          type: "number",
          default: 14,
          min: 2,
          max: 50,
          step: 1,
        },
        {
          key: "stochPeriod",
          label: "Stoch Period",
          type: "number",
          default: 14,
          min: 2,
          max: 50,
          step: 1,
        },
        { key: "kPeriod", label: "%K", type: "number", default: 3, min: 1, max: 20, step: 1 },
        { key: "dPeriod", label: "%D", type: "number", default: 3, min: 1, max: 20, step: 1 },
      ],
    },
  ),
  trix: withCompute("trix", (c, p) => trix(c, { period: p.period ?? 15 }), {
    category: "Momentum",
    name: "Triple Exponential Average",
    description: "Rate of change of a triple-smoothed EMA, filtering short-term noise.",
    paramSchema: [period(15)],
  }),
  aroon: withCompute("aroon", (c, p) => aroon(c, { period: p.period ?? 25 }), {
    category: "Momentum",
    name: "Aroon Indicator",
    description: "Identifies trend changes and strength using highs/lows timing.",
    paramSchema: [period(25)],
  }),
  connorsRsi: withCompute(
    "connorsRsi",
    (c, p) =>
      connorsRsi(c, {
        rsiPeriod: p.rsiPeriod,
        streakPeriod: p.streakPeriod,
        rocPeriod: p.rocPeriod,
      }),
    {
      category: "Momentum",
      name: "Connors RSI",
      description: "Composite RSI combining price RSI, streak RSI, and ROC percentile.",
      paramSchema: [
        {
          key: "rsiPeriod",
          label: "RSI Period",
          type: "number",
          default: 3,
          min: 2,
          max: 20,
          step: 1,
        },
        {
          key: "streakPeriod",
          label: "Streak",
          type: "number",
          default: 2,
          min: 2,
          max: 20,
          step: 1,
        },
        {
          key: "rocPeriod",
          label: "ROC Period",
          type: "number",
          default: 100,
          min: 10,
          max: 200,
          step: 1,
        },
      ],
    },
  ),
  cmo: withCompute("cmo", (c, p) => cmo(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Chande Momentum Oscillator",
    description: "Measures momentum on a -100 to +100 scale using up/down day ratios.",
    paramSchema: [period(14)],
  }),
  adxr: withCompute("adxr", (c, p) => adxr(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "ADX Rating",
    description: "Smoothed ADX providing a lagged measure of trend strength.",
    paramSchema: [period(14)],
  }),
  imi: withCompute("imi", (c, p) => imi(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Intraday Momentum Index",
    description: "Volume-weighted RSI variant using open-close relationships (0-100).",
    paramSchema: [period(14)],
  }),
  vortex: withCompute("vortex", (c, p) => vortex(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "Vortex Indicator",
    description: "Identifies trend direction using positive and negative trend movements.",
    paramSchema: [period(14)],
  }),
  ao: withCompute(
    "ao",
    (c, p) =>
      awesomeOscillator(c, { fastPeriod: p.fastPeriod ?? 5, slowPeriod: p.slowPeriod ?? 34 }),
    {
      category: "Momentum",
      name: "Awesome Oscillator",
      description: "Difference between 5-period and 34-period SMA of median prices.",
      paramSchema: [
        { key: "fastPeriod", label: "Fast", type: "number", default: 5, min: 2, max: 20, step: 1 },
        {
          key: "slowPeriod",
          label: "Slow",
          type: "number",
          default: 34,
          min: 10,
          max: 100,
          step: 1,
        },
      ],
    },
  ),
  bop: withCompute("bop", (c, p) => balanceOfPower(c, { smoothPeriod: p.smoothPeriod ?? 14 }), {
    category: "Momentum",
    name: "Balance of Power",
    description: "Measures the strength of buyers vs sellers using OHLC data (-1 to +1).",
    paramSchema: [
      {
        key: "smoothPeriod",
        label: "Smooth",
        type: "number",
        default: 14,
        min: 1,
        max: 50,
        step: 1,
      },
    ],
  }),
  qstick: withCompute("qstick", (c, p) => qstick(c, { period: p.period ?? 14 }), {
    category: "Momentum",
    name: "QStick",
    description: "Running average of close minus open, indicating buying/selling pressure.",
    paramSchema: [period(14)],
  }),
  ppo: withCompute(
    "ppo",
    (c, p) =>
      ppo(c, {
        fastPeriod: p.fastPeriod ?? 12,
        slowPeriod: p.slowPeriod ?? 26,
        signalPeriod: p.signalPeriod ?? 9,
        source: p.source,
      }),
    {
      category: "Momentum",
      name: "Percentage Price Oscillator",
      description: "MACD expressed as a percentage for comparing assets at different price levels.",
      paramSchema: [
        {
          key: "fastPeriod",
          label: "Fast",
          type: "number",
          default: 12,
          min: 2,
          max: 100,
          step: 1,
        },
        {
          key: "slowPeriod",
          label: "Slow",
          type: "number",
          default: 26,
          min: 2,
          max: 200,
          step: 1,
        },
        {
          key: "signalPeriod",
          label: "Signal",
          type: "number",
          default: 9,
          min: 2,
          max: 50,
          step: 1,
        },
      ],
    },
  ),
  coppock: withCompute(
    "coppock",
    (c, p) =>
      coppockCurve(c, {
        wmaPeriod: p.wmaPeriod ?? 10,
        longRocPeriod: p.longRocPeriod ?? 14,
        shortRocPeriod: p.shortRocPeriod ?? 11,
        source: p.source,
      }),
    {
      category: "Momentum",
      name: "Coppock Curve",
      description:
        "Long-term momentum oscillator originally designed to identify major market bottoms.",
      paramSchema: [
        { key: "wmaPeriod", label: "WMA", type: "number", default: 10, min: 2, max: 50, step: 1 },
        {
          key: "longRocPeriod",
          label: "Long ROC",
          type: "number",
          default: 14,
          min: 5,
          max: 50,
          step: 1,
        },
        {
          key: "shortRocPeriod",
          label: "Short ROC",
          type: "number",
          default: 11,
          min: 5,
          max: 50,
          step: 1,
        },
      ],
    },
  ),
  massIndex: withCompute(
    "massIndex",
    (c, p) => massIndex(c, { emaPeriod: p.emaPeriod ?? 9, sumPeriod: p.sumPeriod ?? 25 }),
    {
      category: "Momentum",
      name: "Mass Index",
      description:
        "Detects trend reversals by measuring the narrowing/widening of the high-low range.",
      paramSchema: [
        {
          key: "emaPeriod",
          label: "EMA Period",
          type: "number",
          default: 9,
          min: 2,
          max: 30,
          step: 1,
        },
        {
          key: "sumPeriod",
          label: "Sum Period",
          type: "number",
          default: 25,
          min: 5,
          max: 50,
          step: 1,
        },
      ],
    },
  ),
  // DPO is batch-only (lookahead dependency incompatible with live mode)
  dpo: {
    meta: DPO_META,
    defaultParams: { period: 20 },
    snapshotName: (p: Record<string, unknown>) => `dpo${p.period}`,
    compute: typedCompute<{ period?: number; source?: PriceSource }>((c, p) =>
      dpo(c, { period: p.period ?? 20, source: p.source }),
    ),
    category: "Momentum",
    name: "Detrended Price Oscillator",
    description: "Removes trend to identify cycles by comparing price to a displaced MA.",
    paramSchema: [period(20)],
  },
  ultimateOscillator: withCompute(
    "ultimateOscillator",
    (c, p) =>
      ultimateOscillator(c, {
        period1: p.period1 ?? 7,
        period2: p.period2 ?? 14,
        period3: p.period3 ?? 28,
      }),
    {
      category: "Momentum",
      name: "Ultimate Oscillator",
      description: "Multi-timeframe oscillator combining three different periods (0-100).",
      paramSchema: [
        { key: "period1", label: "Period 1", type: "number", default: 7, min: 2, max: 30, step: 1 },
        {
          key: "period2",
          label: "Period 2",
          type: "number",
          default: 14,
          min: 5,
          max: 50,
          step: 1,
        },
        {
          key: "period3",
          label: "Period 3",
          type: "number",
          default: 28,
          min: 10,
          max: 100,
          step: 1,
        },
      ],
    },
  ),
  tsi: withCompute(
    "tsi",
    (c, p) =>
      tsi(c, {
        longPeriod: p.longPeriod ?? 25,
        shortPeriod: p.shortPeriod ?? 13,
        signalPeriod: p.signalPeriod ?? 7,
        source: p.source,
      }),
    {
      category: "Momentum",
      name: "True Strength Index",
      description:
        "Double-smoothed momentum oscillator showing trend direction and overbought/oversold.",
      paramSchema: [
        { key: "longPeriod", label: "Long", type: "number", default: 25, min: 5, max: 50, step: 1 },
        {
          key: "shortPeriod",
          label: "Short",
          type: "number",
          default: 13,
          min: 2,
          max: 30,
          step: 1,
        },
        {
          key: "signalPeriod",
          label: "Signal",
          type: "number",
          default: 7,
          min: 2,
          max: 20,
          step: 1,
        },
      ],
    },
  ),
  kst: withCompute(
    "kst",
    (c, p) => kst(c, { signalPeriod: p.signalPeriod ?? 9, source: p.source }),
    {
      category: "Momentum",
      name: "Know Sure Thing",
      description: "Momentum oscillator based on smoothed rate-of-change across four timeframes.",
      paramSchema: [
        {
          key: "signalPeriod",
          label: "Signal",
          type: "number",
          default: 9,
          min: 2,
          max: 30,
          step: 1,
        },
      ],
    },
  ),
  hurst: withCompute(
    "hurst",
    (c, p) =>
      hurst(c, { minWindow: p.minWindow ?? 20, maxWindow: p.maxWindow ?? 100, source: p.source }),
    {
      category: "Momentum",
      name: "Hurst Exponent",
      description: "Measures trend persistence (>0.5 trending, <0.5 mean-reverting, ~0.5 random).",
      paramSchema: [
        {
          key: "minWindow",
          label: "Min Window",
          type: "number",
          default: 20,
          min: 10,
          max: 50,
          step: 1,
        },
        {
          key: "maxWindow",
          label: "Max Window",
          type: "number",
          default: 100,
          min: 50,
          max: 300,
          step: 10,
        },
      ],
    },
  ),
  stc: withCompute(
    "stc",
    (c, p) =>
      schaffTrendCycle(c, {
        fastPeriod: p.fastPeriod ?? 23,
        slowPeriod: p.slowPeriod ?? 50,
        cyclePeriod: p.cyclePeriod ?? 10,
        source: p.source,
      }),
    {
      category: "Momentum",
      name: "Schaff Trend Cycle",
      description: "Combines MACD with stochastic smoothing for faster cycle detection (0-100).",
      paramSchema: [
        { key: "fastPeriod", label: "Fast", type: "number", default: 23, min: 5, max: 50, step: 1 },
        {
          key: "slowPeriod",
          label: "Slow",
          type: "number",
          default: 50,
          min: 20,
          max: 100,
          step: 1,
        },
        {
          key: "cyclePeriod",
          label: "Cycle",
          type: "number",
          default: 10,
          min: 2,
          max: 30,
          step: 1,
        },
      ],
    },
  ),

  // ============================================
  // Volatility
  // ============================================
  atr: withCompute("atr", (c, p) => atr(c, { period: p.period ?? 14 }), {
    category: "Volatility",
    name: "Average True Range",
    description: "Measures market volatility using the range of each period's price movement.",
    paramSchema: [period(14)],
  }),
  bb: withCompute("bb", (c, p) => bollingerBands(c, { period: p.period ?? 20, stdDev: p.stdDev }), {
    category: "Volatility",
    name: "Bollinger Bands",
    description: "SMA with upper/lower bands at standard deviation intervals.",
    paramSchema: [
      period(20),
      { key: "stdDev", label: "Std Dev", type: "number", default: 2, min: 0.5, max: 5, step: 0.5 },
    ],
  }),
  donchian: withCompute("donchian", (c, p) => donchianChannel(c, { period: p.period ?? 20 }), {
    category: "Volatility",
    name: "Donchian Channel",
    description: "Highest high and lowest low over a lookback period, defining breakout levels.",
    paramSchema: [period(20)],
  }),
  keltner: withCompute(
    "keltner",
    (c, p) =>
      keltnerChannel(c, {
        emaPeriod: p.emaPeriod,
        atrPeriod: p.atrPeriod,
        multiplier: p.multiplier,
      }),
    {
      category: "Volatility",
      name: "Keltner Channel",
      description: "EMA-based channel using ATR for band width.",
      paramSchema: [
        {
          key: "emaPeriod",
          label: "EMA Period",
          type: "number",
          default: 20,
          min: 5,
          max: 50,
          step: 1,
        },
        {
          key: "atrPeriod",
          label: "ATR Period",
          type: "number",
          default: 10,
          min: 5,
          max: 50,
          step: 1,
        },
        {
          key: "multiplier",
          label: "Multiplier",
          type: "number",
          default: 1.5,
          min: 0.5,
          max: 5,
          step: 0.5,
        },
      ],
    },
  ),
  chandelierExit: withCompute(
    "chandelierExit",
    (c, p) => chandelierExit(c, { period: p.period ?? 22, multiplier: p.multiplier ?? 3 }),
    {
      category: "Volatility",
      name: "Chandelier Exit",
      description: "Trailing stop-loss levels based on ATR from the highest high / lowest low.",
      paramSchema: [
        period(22),
        {
          key: "multiplier",
          label: "Multiplier",
          type: "number",
          default: 3,
          min: 1,
          max: 10,
          step: 0.5,
        },
      ],
    },
  ),
  choppiness: withCompute("choppiness", (c, p) => choppinessIndex(c, { period: p.period ?? 14 }), {
    category: "Volatility",
    name: "Choppiness Index",
    description: "Determines if the market is choppy (range-bound) or trending (0-100).",
    paramSchema: [period(14)],
  }),
  garmanKlass: withCompute(
    "garmanKlass",
    (c, p) => garmanKlass(c, { period: p.period ?? 20, annualFactor: p.annualFactor ?? 252 }),
    {
      category: "Volatility",
      name: "Garman-Klass Volatility",
      description:
        "Efficient volatility estimator using OHLC data, more accurate than close-to-close.",
      paramSchema: [
        period(20),
        {
          key: "annualFactor",
          label: "Annual Factor",
          type: "number",
          default: 252,
          min: 1,
          max: 365,
          step: 1,
        },
      ],
    },
  ),
  hv: withCompute(
    "hv",
    (c, p) =>
      historicalVolatility(c, {
        period: p.period ?? 20,
        annualFactor: p.annualFactor ?? 252,
        source: p.source,
      }),
    {
      category: "Volatility",
      name: "Historical Volatility",
      description: "Annualized standard deviation of logarithmic returns.",
      paramSchema: [
        period(20),
        {
          key: "annualFactor",
          label: "Annual Factor",
          type: "number",
          default: 252,
          min: 1,
          max: 365,
          step: 1,
        },
      ],
    },
  ),
  atrStops: withCompute(
    "atrStops",
    (c, p) =>
      atrStops(c, {
        period: p.period ?? 14,
        stopMultiplier: p.stopMultiplier ?? 2,
        takeProfitMultiplier: p.takeProfitMultiplier ?? 3,
      }),
    {
      category: "Volatility",
      name: "ATR Stops",
      description: "Stop-loss and take-profit levels calculated from ATR multiples.",
      paramSchema: [
        period(14),
        {
          key: "stopMultiplier",
          label: "Stop Mult",
          type: "number",
          default: 2,
          min: 0.5,
          max: 10,
          step: 0.5,
        },
        {
          key: "takeProfitMultiplier",
          label: "TP Mult",
          type: "number",
          default: 3,
          min: 0.5,
          max: 10,
          step: 0.5,
        },
      ],
    },
  ),
  ulcer: withCompute(
    "ulcer",
    (c, p) => ulcerIndex(c, { period: p.period ?? 14, source: p.source }),
    {
      category: "Volatility",
      name: "Ulcer Index",
      description: "Measures downside volatility and drawdown depth.",
      paramSchema: [period(14)],
    },
  ),

  // ============================================
  // Trend
  // ============================================
  supertrend: withCompute(
    "supertrend",
    (c, p) => supertrend(c, { period: p.period ?? 10, multiplier: p.multiplier ?? 3 }),
    {
      category: "Trend",
      name: "Supertrend",
      description:
        "Trend-following overlay that flips between support and resistance based on ATR.",
      paramSchema: [
        period(10),
        {
          key: "multiplier",
          label: "Multiplier",
          type: "number",
          default: 3,
          min: 1,
          max: 10,
          step: 0.5,
        },
      ],
    },
  ),
  parabolicSar: withCompute(
    "parabolicSar",
    (c, p) => parabolicSar(c, { step: p.step, max: p.max }),
    {
      category: "Trend",
      name: "Parabolic SAR",
      description: "Trailing dot indicator for stop-and-reverse trend following.",
      paramSchema: [
        {
          key: "step",
          label: "Step",
          type: "number",
          default: 0.02,
          min: 0.01,
          max: 0.1,
          step: 0.01,
        },
        { key: "max", label: "Max", type: "number", default: 0.2, min: 0.1, max: 0.5, step: 0.05 },
      ],
    },
  ),
  ichimoku: withCompute(
    "ichimoku",
    (c, p) =>
      ichimoku(c, {
        tenkanPeriod: p.tenkanPeriod,
        kijunPeriod: p.kijunPeriod,
        senkouBPeriod: p.senkouBPeriod,
        displacement: p.displacement,
      }),
    {
      category: "Trend",
      name: "Ichimoku Cloud",
      description: "Multi-component trend system with cloud, conversion, and base lines.",
      paramSchema: [
        {
          key: "tenkanPeriod",
          label: "Tenkan",
          type: "number",
          default: 9,
          min: 2,
          max: 30,
          step: 1,
        },
        {
          key: "kijunPeriod",
          label: "Kijun",
          type: "number",
          default: 26,
          min: 5,
          max: 60,
          step: 1,
        },
        {
          key: "senkouBPeriod",
          label: "Senkou B",
          type: "number",
          default: 52,
          min: 10,
          max: 120,
          step: 1,
        },
      ],
    },
  ),

  // ============================================
  // Volume
  // ============================================
  obv: withCompute("obv", (c) => obv(c), {
    category: "Volume",
    name: "On-Balance Volume",
    description:
      "Cumulative volume indicator that adds volume on up days and subtracts on down days.",
  }),
  cmf: withCompute("cmf", (c, p) => cmf(c, { period: p.period ?? 20 }), {
    category: "Volume",
    name: "Chaikin Money Flow",
    description:
      "Measures buying/selling pressure over a period using volume and price position (-1 to +1).",
    paramSchema: [period(20)],
  }),
  mfi: withCompute("mfi", (c, p) => mfi(c, { period: p.period ?? 14 }), {
    category: "Volume",
    name: "Money Flow Index",
    description: "Volume-weighted RSI measuring overbought/oversold conditions (0-100).",
    paramSchema: [period(14)],
  }),
  vwap: withCompute("vwap", (c) => vwap(c), {
    category: "Volume",
    name: "Volume Weighted Average Price",
    description: "Cumulative average price weighted by volume, key institutional benchmark.",
  }),
  adl: withCompute("adl", (c) => adl(c), {
    category: "Volume",
    name: "Accumulation/Distribution Line",
    description:
      "Cumulative indicator measuring money flow based on close position within the range.",
  }),
  twap: withCompute("twap", (c) => twap(c), {
    category: "Volume",
    name: "Time Weighted Average Price",
    description: "Simple average of typical prices over time, used as execution benchmark.",
  }),
  elderForceIndex: withCompute(
    "elderForceIndex",
    (c, p) => elderForceIndex(c, { period: p.period ?? 13 }),
    {
      category: "Volume",
      name: "Elder Force Index",
      description: "Combines price change and volume to measure the power behind price movements.",
      paramSchema: [period(13)],
    },
  ),
  volumeAnomaly: withCompute(
    "volumeAnomaly",
    (c, p) =>
      volumeAnomaly(c, {
        period: p.period,
        highThreshold: p.highThreshold,
        extremeThreshold: p.extremeThreshold,
      }),
    {
      category: "Volume",
      name: "Volume Anomaly",
      description: "Detects abnormal volume spikes using z-score analysis.",
    },
  ),
  klinger: withCompute(
    "klinger",
    (c, p) =>
      klinger(c, {
        shortPeriod: p.shortPeriod ?? p.fastPeriod,
        longPeriod: p.longPeriod ?? p.slowPeriod,
        signalPeriod: p.signalPeriod,
      }),
    {
      category: "Volume",
      name: "Klinger Volume Oscillator",
      description: "Compares short and long-term volume flow to predict price reversals.",
      paramSchema: [
        {
          key: "shortPeriod",
          label: "Short",
          type: "number",
          default: 34,
          min: 10,
          max: 100,
          step: 1,
        },
        {
          key: "longPeriod",
          label: "Long",
          type: "number",
          default: 55,
          min: 20,
          max: 200,
          step: 1,
        },
        {
          key: "signalPeriod",
          label: "Signal",
          type: "number",
          default: 13,
          min: 2,
          max: 30,
          step: 1,
        },
      ],
    },
  ),
  pvt: withCompute("pvt", (c) => pvt(c), {
    category: "Volume",
    name: "Price Volume Trend",
    description: "Cumulative volume weighted by percentage price change.",
  }),
  nvi: withCompute("nvi", (c, p) => nvi(c, { initialValue: p.initialValue ?? 1000 }), {
    category: "Volume",
    name: "Negative Volume Index",
    description: "Tracks price changes on days when volume decreases from the prior day.",
  }),
  cvd: withCompute("cvd", (c) => cvd(c), {
    category: "Volume",
    name: "Cumulative Volume Delta",
    description: "Approximates order flow by accumulating buying vs selling volume.",
  }),
  weisWave: withCompute(
    "weisWave",
    (c, p) => weisWave(c, { method: p.method ?? "close", threshold: p.threshold ?? 0 }),
    {
      category: "Volume",
      name: "Weis Wave",
      description: "Accumulates volume into waves based on price swing direction.",
    },
  ),
  anchoredVwap: withCompute(
    "anchoredVwap",
    (c, p) => anchoredVwap(c, { anchorTime: p.anchorTime ?? 0, bands: p.bands ?? 0 }),
    {
      category: "Volume",
      name: "Anchored VWAP",
      description: "VWAP calculated from a user-specified anchor point in time.",
    },
  ),
  emv: withCompute(
    "emv",
    (c, p) =>
      easeOfMovement(c, { period: p.period ?? 14, volumeDivisor: p.volumeDivisor ?? 10000 }),
    {
      category: "Volume",
      name: "Ease of Movement",
      description: "Relates price change to volume, measuring how easily price moves.",
      paramSchema: [period(14)],
    },
  ),
  volumeTrend: withCompute(
    "volumeTrend",
    (c, p) =>
      volumeTrend(c, {
        pricePeriod: p.pricePeriod ?? 10,
        volumePeriod: p.volumePeriod ?? 10,
        maPeriod: p.maPeriod ?? 20,
        minPriceChange: p.minPriceChange ?? 2.0,
      }),
    {
      category: "Volume",
      name: "Volume Trend",
      description: "Combines price trend analysis with volume confirmation signals.",
      paramSchema: [
        {
          key: "pricePeriod",
          label: "Price Period",
          type: "number",
          default: 10,
          min: 2,
          max: 50,
          step: 1,
        },
        {
          key: "volumePeriod",
          label: "Vol Period",
          type: "number",
          default: 10,
          min: 2,
          max: 50,
          step: 1,
        },
        {
          key: "maPeriod",
          label: "MA Period",
          type: "number",
          default: 20,
          min: 5,
          max: 100,
          step: 1,
        },
      ],
    },
  ),

  // ============================================
  // Price
  // ============================================
  highestLowest: withCompute(
    "highestLowest",
    (c, p) => highestLowest(c, { period: p.period ?? 20 }),
    {
      category: "Price",
      name: "Highest / Lowest",
      description: "Tracks the highest high and lowest low over a rolling window.",
      paramSchema: [period(20)],
    },
  ),
  pivotPoints: withCompute(
    "pivotPoints",
    (c, p) => pivotPoints(c, { method: p.method ?? "standard" }),
    {
      category: "Price",
      name: "Pivot Points",
      description: "Classic support/resistance levels calculated from prior period's OHLC.",
    },
  ),
  fractals: withCompute<{ period?: number }>(
    "fractals",
    (c, p) => fractals(c, { period: p.period ?? 2 }),
    {
      category: "Price",
      name: "Williams Fractals",
      description: "Marks local highs and lows using surrounding bar comparison.",
      paramSchema: [period(2, 1, 10)],
    },
  ),
  gapAnalysis: withCompute(
    "gapAnalysis",
    (c, p) => gapAnalysis(c, { minGapPercent: p.minGapPercent ?? 0.5 }),
    {
      category: "Price",
      name: "Gap Analysis",
      description:
        "Detects price gaps between consecutive candles. Requires real market data with overnight gaps.",
      paramSchema: [
        {
          key: "minGapPercent",
          label: "Min Gap %",
          type: "number",
          default: 0.5,
          min: 0,
          max: 5,
          step: 0.1,
        },
      ],
    },
  ),
  orb: withCompute(
    "orb",
    (c, p) =>
      openingRange(c, {
        minutes: p.minutes ?? 30,
        sessionResetPeriod: p.sessionResetPeriod ?? "day",
      }),
    {
      category: "Price",
      name: "Opening Range Breakout",
      description: "Identifies breakouts from the opening range. Requires intraday data.",
      paramSchema: [
        {
          key: "minutes",
          label: "Minutes",
          type: "number",
          default: 30,
          min: 5,
          max: 120,
          step: 5,
        },
      ],
    },
  ),
  fvg: withCompute(
    "fvg",
    (c, p) =>
      fairValueGap(c, {
        minGapPercent: p.minGapPercent ?? 0,
        maxActiveFvgs: p.maxActiveFvgs ?? 10,
        partialFill: p.partialFill ?? true,
      }),
    {
      category: "Price",
      name: "Fair Value Gap",
      description: "Detects imbalance zones where price moved too fast, leaving unfilled gaps.",
      paramSchema: [
        {
          key: "minGapPercent",
          label: "Min Gap %",
          type: "number",
          default: 0,
          min: 0,
          max: 5,
          step: 0.1,
        },
        {
          key: "maxActiveFvgs",
          label: "Max Active",
          type: "number",
          default: 10,
          min: 1,
          max: 50,
          step: 1,
        },
      ],
    },
  ),

  // ============================================
  // Wyckoff
  // ============================================
  vsa: withCompute(
    "vsa",
    (c, p) => vsaBatch(c, { volumeMaPeriod: p.volumeMaPeriod ?? 20, atrPeriod: p.atrPeriod ?? 14 }),
    {
      category: "Wyckoff",
      name: "Volume Spread Analysis",
      description:
        "Classifies bar types based on price spread and volume relationships (Wyckoff method).",
      paramSchema: [
        {
          key: "volumeMaPeriod",
          label: "Vol MA",
          type: "number",
          default: 20,
          min: 5,
          max: 50,
          step: 1,
        },
        {
          key: "atrPeriod",
          label: "ATR Period",
          type: "number",
          default: 14,
          min: 5,
          max: 50,
          step: 1,
        },
      ],
    },
  ),

  // ============================================
  // Adaptive
  // ============================================
  adaptiveRsi: {
    meta: ADAPTIVE_RSI_META,
    defaultParams: { basePeriod: 14, minPeriod: 6, maxPeriod: 28 },
    snapshotName: "adaptiveRsi",
    compute: typedCompute<{ basePeriod?: number; minPeriod?: number; maxPeriod?: number }>((c, p) =>
      adaptiveRsi(c, {
        basePeriod: p.basePeriod ?? 14,
        minPeriod: p.minPeriod ?? 6,
        maxPeriod: p.maxPeriod ?? 28,
      }),
    ),
    category: "Adaptive",
    name: "Adaptive RSI",
    description: "RSI with period that adjusts based on market volatility.",
    paramSchema: [
      period(14),
      { key: "minPeriod", label: "Min", type: "number", default: 6, min: 2, max: 20, step: 1 },
      { key: "maxPeriod", label: "Max", type: "number", default: 28, min: 10, max: 100, step: 1 },
    ],
  },
  adaptiveMa: {
    meta: ADAPTIVE_MA_META,
    defaultParams: { erPeriod: 10 },
    snapshotName: "adaptiveMa",
    compute: typedCompute<{ erPeriod?: number }>((c, p) =>
      adaptiveMa(c, { erPeriod: p.erPeriod ?? 10 }),
    ),
    category: "Adaptive",
    name: "Adaptive Moving Average",
    description: "EMA with speed adapting to Kaufman efficiency ratio.",
    paramSchema: [
      {
        key: "erPeriod",
        label: "ER Period",
        type: "number",
        default: 10,
        min: 2,
        max: 50,
        step: 1,
      },
    ],
  },
  adaptiveBollinger: {
    meta: ADAPTIVE_BB_META,
    defaultParams: { period: 20, baseStdDev: 2 },
    snapshotName: "adaptiveBb",
    compute: typedCompute<{ period?: number; baseStdDev?: number }>((c, p) =>
      adaptiveBollinger(c, {
        period: p.period ?? 20,
        baseStdDev: p.baseStdDev ?? 2,
      }),
    ),
    category: "Adaptive",
    name: "Adaptive Bollinger Bands",
    description: "Bollinger Bands with multiplier adapting to kurtosis.",
    paramSchema: [
      period(20),
      {
        key: "baseStdDev",
        label: "Base StdDev",
        type: "number",
        default: 2,
        min: 0.5,
        max: 5,
        step: 0.5,
      },
    ],
  },
  adaptiveStochastics: {
    meta: ADAPTIVE_STOCH_META,
    defaultParams: { basePeriod: 14 },
    snapshotName: "adaptiveStoch",
    compute: typedCompute<{ basePeriod?: number }>((c, p) =>
      adaptiveStochastics(c, { basePeriod: p.basePeriod ?? 14 }),
    ),
    category: "Adaptive",
    name: "Adaptive Stochastics",
    description: "Stochastic oscillator with period adapting to ADX-based trend strength.",
    paramSchema: [
      {
        key: "basePeriod",
        label: "Base Period",
        type: "number",
        default: 14,
        min: 5,
        max: 50,
        step: 1,
      },
    ],
  },

  // ============================================
  // Additional Volatility
  // ============================================
  standardDeviation: {
    meta: STD_DEV_META,
    defaultParams: { period: 20 },
    snapshotName: "stdDev",
    compute: typedCompute<{ period?: number }>((c, p) =>
      standardDeviation(c, { period: p.period ?? 20 }),
    ),
    category: "Volatility",
    name: "Standard Deviation",
    description: "Raw standard deviation of closing prices over a rolling window.",
    paramSchema: [period(20)],
  },
  ewmaVol: withCompute<{ lambda?: number }>(
    "ewmaVol",
    (c, p) => {
      const returns = c.slice(1).map((bar, i) => Math.log(bar.close / c[i].close));
      const raw = ewmaVolatility(returns, { lambda: p.lambda ?? 0.94 });
      // Map index-based time back to candle timestamps (offset by 1 for returns)
      return raw.map((pt, i) => ({ time: c[i + 1].time, value: pt.value }));
    },
    {
      category: "Volatility",
      name: "EWMA Volatility",
      description: "Exponentially weighted moving average volatility estimator.",
      paramSchema: [
        {
          key: "lambda",
          label: "Lambda",
          type: "number",
          default: 0.94,
          min: 0.5,
          max: 0.99,
          step: 0.01,
        },
      ],
    },
  ),
  volatilityRegime: {
    meta: VOL_REGIME_META,
    defaultParams: { atrPeriod: 14, lookbackPeriod: 100 },
    snapshotName: "volRegime",
    compute: typedCompute<{ atrPeriod?: number; lookbackPeriod?: number }>((c, p) =>
      volatilityRegime(c, {
        atrPeriod: p.atrPeriod ?? 14,
        lookbackPeriod: p.lookbackPeriod ?? 100,
      }),
    ),
    category: "Volatility",
    name: "Volatility Regime",
    description: "Classifies market volatility as low, normal, high, or extreme.",
    paramSchema: [
      {
        key: "atrPeriod",
        label: "ATR Period",
        type: "number",
        default: 14,
        min: 5,
        max: 50,
        step: 1,
      },
      {
        key: "lookbackPeriod",
        label: "Lookback",
        type: "number",
        default: 100,
        min: 20,
        max: 500,
        step: 10,
      },
    ],
  },

  // ============================================
  // Additional Trend
  // ============================================
  linearRegression: {
    meta: LINEAR_REG_META,
    defaultParams: { period: 20 },
    snapshotName: "linReg",
    compute: typedCompute<{ period?: number }>((c, p) => {
      const raw = linearRegression(c, { period: p.period ?? 20 });
      // Convert to band format: regression line ± standard deviation
      const per = p.period ?? 20;
      // Calculate residual stdDev for channel bands
      const values: (number | null)[] = raw.map((d) => d.value?.value ?? null);
      const closes = c.map((bar) => bar.close);
      return raw.map((d, i) => {
        const v = d.value?.value;
        if (v == null || i < per - 1)
          return { time: d.time, value: { upper: null, middle: null, lower: null } };
        // Compute residual stddev over the regression window
        let sumSq = 0;
        let count = 0;
        for (let j = Math.max(0, i - per + 1); j <= i; j++) {
          const rv = values[j];
          if (rv != null) {
            const residual = closes[j] - rv;
            sumSq += residual * residual;
            count++;
          }
        }
        const stdDev = count > 0 ? Math.sqrt(sumSq / count) : 0;
        return { time: d.time, value: { upper: v + stdDev, middle: v, lower: v - stdDev } };
      });
    }),
    category: "Trend",
    name: "Linear Regression Channel",
    description: "Regression line with standard deviation channel bands.",
    paramSchema: [period(20)],
  },

  // ============================================
  // Additional Volume
  // ============================================
  volumeMa: {
    meta: VOLUME_MA_META,
    defaultParams: { period: 20 },
    snapshotName: "volMa",
    compute: typedCompute<{ period?: number }>((c, p) => volumeMa(c, { period: p.period ?? 20 })),
    category: "Volume",
    name: "Volume Moving Average",
    description: "Simple moving average of volume.",
    paramSchema: [period(20)],
  },
  cvdWithSignal: {
    meta: CVD_SIGNAL_META,
    defaultParams: { signalPeriod: 9 },
    snapshotName: "cvdSignal",
    compute: typedCompute<{ signalPeriod?: number }>((c, p) =>
      cvdWithSignal(c, { signalPeriod: p.signalPeriod ?? 9 }),
    ),
    category: "Volume",
    name: "CVD with Signal",
    description: "Cumulative Volume Delta with EMA signal line for crossover detection.",
    paramSchema: [
      {
        key: "signalPeriod",
        label: "Signal",
        type: "number",
        default: 9,
        min: 2,
        max: 30,
        step: 1,
      },
    ],
  },
  // ============================================
  // Additional Momentum
  // ============================================
  fastStochastics: {
    meta: FAST_STOCH_META,
    defaultParams: { kPeriod: 14, dPeriod: 3 },
    snapshotName: "fastStoch",
    compute: typedCompute<{ kPeriod?: number; dPeriod?: number }>((c, p) =>
      fastStochastics(c, {
        kPeriod: p.kPeriod ?? 14,
        dPeriod: p.dPeriod ?? 3,
      }),
    ),
    category: "Momentum",
    name: "Fast Stochastics",
    description: "Stochastic oscillator without smoothing (slowing=1).",
    paramSchema: [
      { key: "kPeriod", label: "%K", type: "number", default: 14, min: 2, max: 100, step: 1 },
      { key: "dPeriod", label: "%D", type: "number", default: 3, min: 1, max: 20, step: 1 },
    ],
  },
  slowStochastics: {
    meta: SLOW_STOCH_META,
    defaultParams: { kPeriod: 14, dPeriod: 3 },
    snapshotName: "slowStoch",
    compute: typedCompute<{ kPeriod?: number; dPeriod?: number }>((c, p) =>
      slowStochastics(c, {
        kPeriod: p.kPeriod ?? 14,
        dPeriod: p.dPeriod ?? 3,
      }),
    ),
    category: "Momentum",
    name: "Slow Stochastics",
    description: "Stochastic oscillator with extra smoothing (slowing=3).",
    paramSchema: [
      { key: "kPeriod", label: "%K", type: "number", default: 14, min: 2, max: 100, step: 1 },
      { key: "dPeriod", label: "%D", type: "number", default: 3, min: 1, max: 20, step: 1 },
    ],
  },

  // ============================================
  // Additional Price
  // ============================================
  heikinAshi: {
    meta: HEIKIN_ASHI_META,
    defaultParams: {},
    snapshotName: "ha",
    compute: (c) => heikinAshi(c),
    category: "Price",
    name: "Heikin-Ashi",
    description: "Smoothed candlestick transformation for clearer trend visualization.",
  },
  swingPoints: {
    meta: SWING_POINTS_META,
    defaultParams: { leftBars: 5, rightBars: 5 },
    snapshotName: "swing",
    compute: typedCompute<{ leftBars?: number; rightBars?: number }>((c, p) =>
      swingPoints(c, {
        leftBars: p.leftBars ?? 5,
        rightBars: p.rightBars ?? 5,
      }),
    ),
    category: "Price",
    name: "Swing Points",
    description: "Confirmed swing highs and lows using surrounding bar comparison.",
    paramSchema: [
      { key: "leftBars", label: "Left Bars", type: "number", default: 5, min: 1, max: 20, step: 1 },
      {
        key: "rightBars",
        label: "Right Bars",
        type: "number",
        default: 5,
        min: 1,
        max: 20,
        step: 1,
      },
    ],
  },
  zigzag: {
    meta: ZIGZAG_META,
    defaultParams: { deviation: 5 },
    snapshotName: "zigzag",
    compute: typedCompute<{ deviation?: number }>((c, p) => {
      const raw = zigzag(c, { deviation: p.deviation ?? 5 });
      // Interpolate between pivot points for line rendering
      const result: Series<number | null> = raw.map((d) => ({
        time: d.time,
        value: d.value?.price ?? null,
      }));
      const pivotIndices: number[] = [];
      for (let i = 0; i < result.length; i++) {
        if (result[i].value !== null) pivotIndices.push(i);
      }
      for (let p = 0; p < pivotIndices.length - 1; p++) {
        const si = pivotIndices[p];
        const ei = pivotIndices[p + 1];
        const sv = result[si].value as number;
        const ev = result[ei].value as number;
        for (let i = si + 1; i < ei; i++) {
          const t = (i - si) / (ei - si);
          result[i] = { time: result[i].time, value: sv + (ev - sv) * t };
        }
      }
      return result;
    }),
    category: "Price",
    name: "Zigzag",
    description: "Connects significant swing points, filtering minor price movements.",
    paramSchema: [
      {
        key: "deviation",
        label: "Deviation %",
        type: "number",
        default: 5,
        min: 1,
        max: 20,
        step: 0.5,
      },
    ],
  },

  // ============================================
  // Session
  // ============================================
  sessionBreakout: {
    meta: SESSION_BREAKOUT_META,
    defaultParams: {},
    snapshotName: "sessBO",
    compute: (c) => sessionBreakout(c),
    category: "Session",
    name: "Session Breakout",
    description: "Detects breakouts from previous session high/low range. Requires intraday data.",
  },

  // ============================================
  // SMC
  // ============================================
  orderBlock: {
    meta: ORDER_BLOCK_META,
    defaultParams: { swingPeriod: 5 },
    snapshotName: "ob",
    compute: typedCompute<{ swingPeriod?: number }>((c, p) =>
      orderBlock(c, { swingPeriod: p.swingPeriod ?? 5 }),
    ),
    category: "SMC",
    name: "Order Block",
    description: "Detects institutional order blocks — supply and demand zones.",
    paramSchema: [
      {
        key: "swingPeriod",
        label: "Swing Period",
        type: "number",
        default: 5,
        min: 2,
        max: 20,
        step: 1,
      },
    ],
  },
  liquiditySweep: {
    meta: LIQUIDITY_SWEEP_META,
    defaultParams: { swingPeriod: 5 },
    snapshotName: "liqSweep",
    compute: typedCompute<{ swingPeriod?: number }>((c, p) =>
      liquiditySweep(c, { swingPeriod: p.swingPeriod ?? 5 }),
    ),
    category: "SMC",
    name: "Liquidity Sweep",
    description: "Detects stop-hunt sweeps beyond swing highs/lows that quickly reverse.",
    paramSchema: [
      {
        key: "swingPeriod",
        label: "Swing Period",
        type: "number",
        default: 5,
        min: 2,
        max: 20,
        step: 1,
      },
    ],
  },

  // ============================================
  // Filter (Ehlers)
  // ============================================
  superSmoother: {
    meta: { kind: "superSmoother", overlay: true, label: "SuperSmoother" },
    defaultParams: { period: 10 },
    snapshotName: (p: Record<string, unknown>) => `ss${p.period}`,
    compute: typedCompute<{ period?: number }>((c, p) =>
      superSmoother(c, { period: p.period ?? 10 }),
    ),
    category: "Filter",
    name: "Super Smoother (Ehlers)",
    description: "Low-pass filter that smooths price with minimal lag via 2-pole IIR.",
    paramSchema: [period(10, 2, 100)],
  },
  roofingFilter: {
    meta: { kind: "roofingFilter", overlay: false, label: "Roofing" },
    defaultParams: { highPassPeriod: 48, lowPassPeriod: 10 },
    snapshotName: (p: Record<string, unknown>) => `roof${p.highPassPeriod}-${p.lowPassPeriod}`,
    compute: typedCompute<{ highPassPeriod?: number; lowPassPeriod?: number }>((c, p) =>
      roofingFilter(c, {
        highPassPeriod: p.highPassPeriod ?? 48,
        lowPassPeriod: p.lowPassPeriod ?? 10,
      }),
    ),
    category: "Filter",
    name: "Roofing Filter (Ehlers)",
    description: "Bandpass that isolates medium-frequency cycles by removing trend and noise.",
    paramSchema: [
      {
        key: "highPassPeriod",
        label: "High-Pass Period",
        type: "number",
        default: 48,
        min: 10,
        max: 200,
        step: 1,
      },
      {
        key: "lowPassPeriod",
        label: "Low-Pass Period",
        type: "number",
        default: 10,
        min: 2,
        max: 50,
        step: 1,
      },
    ],
  },

  // ============================================
  // Additional Price utilities
  // ============================================
  highest: {
    meta: { kind: "highest", overlay: true, label: "Highest" },
    defaultParams: { period: 20 },
    snapshotName: (p: Record<string, unknown>) => `hi${p.period}`,
    compute: typedCompute<{ period?: number }>((c, p) => highest(c, p.period ?? 20)),
    category: "Price",
    name: "Highest High",
    description: "Rolling maximum of candle highs over N bars.",
    paramSchema: [period(20, 2, 500)],
  },
  lowest: {
    meta: { kind: "lowest", overlay: true, label: "Lowest" },
    defaultParams: { period: 20 },
    snapshotName: (p: Record<string, unknown>) => `lo${p.period}`,
    compute: typedCompute<{ period?: number }>((c, p) => lowest(c, p.period ?? 20)),
    category: "Price",
    name: "Lowest Low",
    description: "Rolling minimum of candle lows over N bars.",
    paramSchema: [period(20, 2, 500)],
  },
  returns: {
    meta: { kind: "returns", overlay: false, label: "Returns" },
    defaultParams: { period: 1, type: "simple" },
    snapshotName: (p: Record<string, unknown>) => `ret${p.period}-${p.type ?? "simple"}`,
    compute: typedCompute<{ period?: number; type?: "simple" | "log" }>((c, p) =>
      returns(c, {
        period: p.period ?? 1,
        type: p.type ?? "simple",
      }),
    ),
    category: "Price",
    name: "Returns",
    description: "Bar-over-bar percentage or log returns of close prices.",
    paramSchema: [period(1, 1, 100)],
  },
  cumulativeReturns: {
    meta: { kind: "cumulativeReturns", overlay: false, label: "Cum. Returns" },
    defaultParams: { type: "simple" },
    snapshotName: (p: Record<string, unknown>) => `cumret-${p.type ?? "simple"}`,
    compute: typedCompute<{ type?: "simple" | "log" }>((c, p) =>
      cumulativeReturns(c, p.type ?? "simple"),
    ),
    category: "Price",
    name: "Cumulative Returns",
    description: "Growth of $1 invested at the first bar's close.",
  },
  medianPrice: {
    meta: { kind: "medianPrice", overlay: true, label: "Median Price" },
    defaultParams: {},
    snapshotName: "median",
    compute: (c) => medianPrice(c),
    category: "Price",
    name: "Median Price",
    description: "(High + Low) / 2, a common MA source.",
  },
  typicalPrice: {
    meta: { kind: "typicalPrice", overlay: true, label: "Typical Price" },
    defaultParams: {},
    snapshotName: "typical",
    compute: (c) => typicalPrice(c),
    category: "Price",
    name: "Typical Price",
    description: "(High + Low + Close) / 3, used as input to CCI and volume-weighted studies.",
  },
  weightedClose: {
    meta: { kind: "weightedClose", overlay: true, label: "Weighted Close" },
    defaultParams: {},
    snapshotName: "wclose",
    compute: (c) => weightedClose(c),
    category: "Price",
    name: "Weighted Close",
    description: "(High + Low + 2 × Close) / 4, gives extra weight to the close.",
  },

  // ============================================
  // Additional Volatility utilities
  // ============================================
  atrPercent: {
    meta: { kind: "atrPercent", overlay: false, label: "ATR%" },
    defaultParams: { period: 14 },
    snapshotName: (p: Record<string, unknown>) => `atrpct${p.period}`,
    compute: typedCompute<{ period?: number }>((c, p) => atrPercentSeries(c, p.period ?? 14)),
    category: "Volatility",
    name: "ATR Percent",
    description: "ATR expressed as a percentage of price — normalized volatility metric.",
    paramSchema: [period(14, 2, 100)],
  },
};
