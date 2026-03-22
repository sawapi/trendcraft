/**
 * TrendCraft Fluent API
 * Provides a chainable interface for technical analysis
 */

import {
  atr as atrPlugin,
  bollingerBands as bollingerBandsPlugin,
  cmf as cmfPlugin,
  ema as emaPlugin,
  highest as highestPlugin,
  keltnerChannel as keltnerChannelPlugin,
  lowest as lowestPlugin,
  macd as macdPlugin,
  parabolicSar as parabolicSarPlugin,
  returns as returnsPlugin,
  rsi as rsiPlugin,
  sma as smaPlugin,
  volumeAnomaly as volumeAnomalyPlugin,
  volumeMa as volumeMaPlugin,
  volumeProfileSeries as volumeProfileSeriesPlugin,
  volumeTrend as volumeTrendPlugin,
} from "../indicators/plugins";
import { volumeProfile } from "../indicators/volume/volume-profile";
import type {
  Candle,
  NormalizedCandle,
  PriceSource,
  Series,
  Timeframe,
  TimeframeShorthand,
  VolumeProfileValue,
} from "../types";
import type { IndicatorPlugin } from "../types/plugin";
import { isNormalized } from "./normalize";
import { normalizeCandles } from "./normalize";
import { resample } from "./resample";
import { MtfStrategyBuilder, StrategyBuilder } from "./strategy-builder";

/**
 * Internal pipeline entry referencing a plugin with resolved options
 */
interface PipelineEntry {
  plugin: IndicatorPlugin<string, Record<string, unknown>, unknown>;
  options: Record<string, unknown>;
  key: string;
}

/**
 * Analysis result containing computed indicators
 */
export interface AnalysisResult {
  /** Original candle data */
  candles: NormalizedCandle[];
  /** Computed indicator series, accessed by key (e.g., sma20, rsi14) */
  indicators: Record<string, Series<unknown>>;
}

/**
 * TrendCraft - Fluent API for technical analysis
 *
 * @typeParam TIndicators - Accumulated indicator type map (auto-inferred via `.use()`)
 *
 * @example
 * ```ts
 * // Built-in shorthand methods
 * const result = TrendCraft.from(candles)
 *   .sma(20)
 *   .rsi(14)
 *   .macd()
 *   .compute();
 *
 * // Custom plugin via .use()
 * import { defineIndicator } from "trendcraft";
 *
 * const myIndicator = defineIndicator({
 *   name: "myInd" as const,
 *   compute: (candles, opts) => sma(candles, opts),
 *   defaultOptions: { period: 20, source: "close" as const },
 * });
 *
 * const result = TrendCraft.from(candles)
 *   .use(myIndicator, { period: 50 })
 *   .compute();
 * ```
 */
// biome-ignore lint/complexity/noBannedTypes: empty object is intentional for generic default
export class TrendCraft<TIndicators extends Record<string, unknown> = {}> {
  protected _candles: NormalizedCandle[];
  protected _pipeline: PipelineEntry[] = [];
  protected _cache: Map<string, Series<unknown>> = new Map();

  protected constructor(candles: NormalizedCandle[]) {
    this._candles = candles;
  }

  /**
   * Create TrendCraft instance from candle data
   */
  static from(candles: Candle[] | NormalizedCandle[]): TrendCraft {
    const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
    return new TrendCraft(normalized);
  }

  /**
   * Add a custom indicator plugin to the computation pipeline
   *
   * @example
   * ```ts
   * import { defineIndicator, sma } from "trendcraft";
   *
   * const customSma = defineIndicator({
   *   name: "customSma" as const,
   *   compute: (candles, opts) => sma(candles, { period: opts.period }),
   *   defaultOptions: { period: 10 },
   * });
   *
   * const result = TrendCraft.from(candles)
   *   .use(customSma, { period: 30 })
   *   .compute();
   * ```
   */
  use<K extends string, O extends Record<string, unknown>, V>(
    plugin: IndicatorPlugin<K, O, V>,
    options?: Partial<O>,
  ): TrendCraft<TIndicators & Record<K, Series<V>>> {
    const resolved = { ...plugin.defaultOptions, ...options } as O;
    const key = plugin.buildKey
      ? plugin.buildKey(resolved)
      : `${plugin.name}_${JSON.stringify(resolved)}`;
    this._pipeline.push({
      plugin: plugin as IndicatorPlugin<string, Record<string, unknown>, unknown>,
      options: resolved,
      key,
    });
    return this as TrendCraft<TIndicators & Record<K, Series<V>>>;
  }

  /**
   * Enable multi-timeframe analysis
   * Returns a new instance with MTF support for backtesting
   *
   * @param timeframes - Higher timeframes to include (e.g., ["weekly", "monthly"])
   *
   * @example
   * ```ts
   * const result = TrendCraft.from(dailyCandles)
   *   .withMtf(["weekly"])
   *   .strategy()
   *   .entry(and(weeklyRsiAbove(50), goldenCross()))
   *   .exit(deadCross())
   *   .backtest({ capital: 1000000 });
   * ```
   */
  withMtf(timeframes: TimeframeShorthand[]): TrendCraftMtf {
    return new TrendCraftMtf(this._candles, timeframes, this._pipeline, this._cache);
  }

  /**
   * Get the current candles
   */
  get candles(): NormalizedCandle[] {
    return this._candles;
  }

  /**
   * Resample candles to a different timeframe
   * Returns a new TrendCraft instance with resampled data
   */
  resample(timeframe: TimeframeShorthand | Timeframe): TrendCraft {
    const resampled = resample(this._candles, timeframe);
    return new TrendCraft(resampled);
  }

  /**
   * Add Simple Moving Average to computation pipeline
   */
  sma(period: number, source: PriceSource = "close"): this {
    this.use(smaPlugin, { period, source });
    return this;
  }

  /**
   * Add Exponential Moving Average to computation pipeline
   */
  ema(period: number, source: PriceSource = "close"): this {
    this.use(emaPlugin, { period, source });
    return this;
  }

  /**
   * Add Relative Strength Index to computation pipeline
   */
  rsi(period = 14): this {
    this.use(rsiPlugin, { period });
    return this;
  }

  /**
   * Add MACD to computation pipeline
   */
  macd(fast = 12, slow = 26, signal = 9): this {
    this.use(macdPlugin, { fast, slow, signal });
    return this;
  }

  /**
   * Add Bollinger Bands to computation pipeline
   */
  bollingerBands(period = 20, stdDev = 2, source: PriceSource = "close"): this {
    this.use(bollingerBandsPlugin, { period, stdDev, source });
    return this;
  }

  /**
   * Add Average True Range to computation pipeline
   */
  atr(period = 14): this {
    this.use(atrPlugin, { period });
    return this;
  }

  /**
   * Add Volume Moving Average to computation pipeline
   */
  volumeMa(period: number, type: "sma" | "ema" = "sma"): this {
    this.use(volumeMaPlugin, { period, maType: type });
    return this;
  }

  /**
   * Add Highest High to computation pipeline
   */
  highest(period: number): this {
    this.use(highestPlugin, { period });
    return this;
  }

  /**
   * Add Lowest Low to computation pipeline
   */
  lowest(period: number): this {
    this.use(lowestPlugin, { period });
    return this;
  }

  /**
   * Add Returns to computation pipeline
   */
  returns(period = 1, type: "simple" | "log" = "simple"): this {
    this.use(returnsPlugin, { period, returnType: type });
    return this;
  }

  /**
   * Add Parabolic SAR to computation pipeline
   */
  parabolicSar(step = 0.02, max = 0.2): this {
    this.use(parabolicSarPlugin, { step, max });
    return this;
  }

  /**
   * Add Keltner Channel to computation pipeline
   */
  keltnerChannel(emaPeriod = 20, atrPeriod = 10, multiplier = 2): this {
    this.use(keltnerChannelPlugin, { emaPeriod, atrPeriod, multiplier });
    return this;
  }

  /**
   * Add Chaikin Money Flow to computation pipeline
   */
  cmf(period = 20): this {
    this.use(cmfPlugin, { period });
    return this;
  }

  /**
   * Add Volume Anomaly detection to computation pipeline
   *
   * @param period - Lookback period for average (default: 20)
   * @param highThreshold - Threshold for high volume detection (default: 2.0)
   */
  volumeAnomalyIndicator(period = 20, highThreshold = 2.0): this {
    this.use(volumeAnomalyPlugin, { period, highThreshold });
    return this;
  }

  /**
   * Add rolling Volume Profile to computation pipeline
   *
   * @param period - Number of candles for profile calculation (default: 20)
   */
  volumeProfileIndicator(period = 20): this {
    this.use(volumeProfileSeriesPlugin, { period });
    return this;
  }

  /**
   * Add Volume Trend confirmation to computation pipeline
   *
   * @param pricePeriod - Period for price trend detection (default: 10)
   * @param volumePeriod - Period for volume trend detection (default: 10)
   */
  volumeTrendIndicator(pricePeriod = 10, volumePeriod = 10): this {
    this.use(volumeTrendPlugin, { pricePeriod, volumePeriod });
    return this;
  }

  /**
   * Calculate Volume Profile for the entire dataset (not rolling)
   * Returns immediately without adding to pipeline
   *
   * @param period - Number of candles from the end (default: all)
   */
  getVolumeProfile(period?: number): VolumeProfileValue {
    return volumeProfile(this._candles, { period });
  }

  /**
   * Execute all pending computations and return results
   */
  compute(): AnalysisResult {
    const indicators: Record<string, Series<unknown>> = {};

    for (const entry of this._pipeline) {
      if (!this._cache.has(entry.key)) {
        const computed = entry.plugin.compute(this._candles, entry.options);
        this._cache.set(entry.key, computed);
      }
      indicators[entry.key] = this._cache.get(entry.key) as Series<unknown>;
    }

    return {
      candles: this._candles,
      indicators,
    };
  }

  /**
   * Get a single indicator result by key
   */
  get(key: string): Series<unknown> | undefined {
    if (!this._cache.has(key)) {
      const entry = this._pipeline.find((e) => e.key === key);
      if (entry) {
        this._cache.set(key, entry.plugin.compute(this._candles, entry.options));
      }
    }
    return this._cache.get(key);
  }

  /**
   * Clear the computation cache
   */
  clearCache(): this {
    this._cache.clear();
    return this;
  }

  /**
   * Get the number of candles
   */
  get length(): number {
    return this._candles.length;
  }

  /**
   * Create a strategy builder for backtesting
   *
   * @example
   * ```ts
   * // Simple preset conditions
   * const result = TrendCraft.from(candles)
   *   .strategy()
   *   .entry(goldenCross())
   *   .exit(deadCross())
   *   .backtest({ capital: 1000000 });
   *
   * // Combined conditions
   * const result = TrendCraft.from(candles)
   *   .strategy()
   *   .entry(and(goldenCross(), rsiBelow(30)))
   *   .exit(or(deadCross(), rsiAbove(70)))
   *   .backtest({ capital: 1000000 });
   *
   * // Custom function
   * const result = TrendCraft.from(candles)
   *   .strategy()
   *   .entry((indicators, candle, i) => {
   *     return indicators.goldenCross && indicators.rsi < 30;
   *   })
   *   .exit((indicators, candle, i) => {
   *     return indicators.deadCross || indicators.rsi > 70;
   *   })
   *   .backtest({ capital: 1000000 });
   * ```
   */
  strategy(): StrategyBuilder {
    return new StrategyBuilder(this._candles);
  }
}

// Re-export strategy builders for backward compatibility
export { StrategyBuilder, MtfStrategyBuilder } from "./strategy-builder";

/**
 * TrendCraft with MTF (Multi-Timeframe) support
 */
export class TrendCraftMtf<
  // biome-ignore lint/complexity/noBannedTypes: empty object is intentional for generic default
  TIndicators extends Record<string, unknown> = {},
> extends TrendCraft<TIndicators> {
  private _mtfTimeframes: TimeframeShorthand[];

  constructor(
    candles: NormalizedCandle[],
    mtfTimeframes: TimeframeShorthand[],
    pipeline: PipelineEntry[] = [],
    cache: Map<string, Series<unknown>> = new Map(),
  ) {
    super(candles);
    this._pipeline = pipeline;
    this._cache = cache;
    this._mtfTimeframes = mtfTimeframes;
  }

  /**
   * Add a custom indicator plugin (preserves MTF context)
   */
  use<K extends string, O extends Record<string, unknown>, V>(
    plugin: IndicatorPlugin<K, O, V>,
    options?: Partial<O>,
  ): TrendCraftMtf<TIndicators & Record<K, Series<V>>> {
    super.use(plugin, options);
    return this as TrendCraftMtf<TIndicators & Record<K, Series<V>>>;
  }

  /**
   * Create MTF-enabled strategy builder
   */
  strategy(): MtfStrategyBuilder {
    return new MtfStrategyBuilder(this.candles, this._mtfTimeframes);
  }
}
