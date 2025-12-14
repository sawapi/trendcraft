/**
 * TrendCraft Fluent API
 * Provides a chainable interface for technical analysis
 */

import type {
  BollingerBandsValue,
  Candle,
  MacdValue,
  NormalizedCandle,
  PriceSource,
  Series,
  Timeframe,
  TimeframeShorthand,
} from "../types";
import { sma } from "../indicators/moving-average/sma";
import { ema } from "../indicators/moving-average/ema";
import { rsi } from "../indicators/momentum/rsi";
import { macd } from "../indicators/momentum/macd";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import { atr } from "../indicators/volatility/atr";
import { volumeMa } from "../indicators/volume/volume-ma";
import { highest, lowest } from "../indicators/price/highest-lowest";
import { returns } from "../indicators/price/returns";
import { normalizeCandles } from "./normalize";
import { resample } from "./resample";

/**
 * Indicator specification for lazy evaluation
 */
type IndicatorSpec =
  | { type: "sma"; period: number; source: PriceSource; key: string }
  | { type: "ema"; period: number; source: PriceSource; key: string }
  | { type: "rsi"; period: number; key: string }
  | { type: "macd"; fast: number; slow: number; signal: number; key: string }
  | { type: "bollingerBands"; period: number; stdDev: number; source: PriceSource; key: string }
  | { type: "atr"; period: number; key: string }
  | { type: "volumeMa"; period: number; maType: "sma" | "ema"; key: string }
  | { type: "highest"; period: number; key: string }
  | { type: "lowest"; period: number; key: string }
  | { type: "returns"; period: number; returnType: "simple" | "log"; key: string };

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
 * @example
 * ```ts
 * const result = TrendCraft.from(candles)
 *   .resample('weekly')
 *   .sma(20)
 *   .sma(50)
 *   .ema(12)
 *   .rsi(14)
 *   .macd()
 *   .bollingerBands()
 *   .compute();
 *
 * console.log(result.indicators.sma20);
 * console.log(result.indicators.rsi14);
 * ```
 */
export class TrendCraft {
  private _candles: NormalizedCandle[];
  private _pipeline: IndicatorSpec[] = [];
  private _cache: Map<string, Series<unknown>> = new Map();

  private constructor(candles: NormalizedCandle[]) {
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
    const key = source === "close" ? `sma${period}` : `sma${period}_${source}`;
    this._pipeline.push({ type: "sma", period, source, key });
    return this;
  }

  /**
   * Add Exponential Moving Average to computation pipeline
   */
  ema(period: number, source: PriceSource = "close"): this {
    const key = source === "close" ? `ema${period}` : `ema${period}_${source}`;
    this._pipeline.push({ type: "ema", period, source, key });
    return this;
  }

  /**
   * Add Relative Strength Index to computation pipeline
   */
  rsi(period = 14): this {
    const key = `rsi${period}`;
    this._pipeline.push({ type: "rsi", period, key });
    return this;
  }

  /**
   * Add MACD to computation pipeline
   */
  macd(fast = 12, slow = 26, signal = 9): this {
    const key = `macd_${fast}_${slow}_${signal}`;
    this._pipeline.push({ type: "macd", fast, slow, signal, key });
    return this;
  }

  /**
   * Add Bollinger Bands to computation pipeline
   */
  bollingerBands(period = 20, stdDev = 2, source: PriceSource = "close"): this {
    const key = source === "close" ? `bb${period}` : `bb${period}_${source}`;
    this._pipeline.push({ type: "bollingerBands", period, stdDev, source, key });
    return this;
  }

  /**
   * Add Average True Range to computation pipeline
   */
  atr(period = 14): this {
    const key = `atr${period}`;
    this._pipeline.push({ type: "atr", period, key });
    return this;
  }

  /**
   * Add Volume Moving Average to computation pipeline
   */
  volumeMa(period: number, type: "sma" | "ema" = "sma"): this {
    const key = type === "sma" ? `vma${period}` : `vma${period}_ema`;
    this._pipeline.push({ type: "volumeMa", period, maType: type, key });
    return this;
  }

  /**
   * Add Highest High to computation pipeline
   */
  highest(period: number): this {
    const key = `highest${period}`;
    this._pipeline.push({ type: "highest", period, key });
    return this;
  }

  /**
   * Add Lowest Low to computation pipeline
   */
  lowest(period: number): this {
    const key = `lowest${period}`;
    this._pipeline.push({ type: "lowest", period, key });
    return this;
  }

  /**
   * Add Returns to computation pipeline
   */
  returns(period = 1, type: "simple" | "log" = "simple"): this {
    const key = type === "simple" ? `returns${period}` : `returns${period}_log`;
    this._pipeline.push({ type: "returns", period, returnType: type, key });
    return this;
  }

  /**
   * Execute all pending computations and return results
   */
  compute(): AnalysisResult {
    const indicators: Record<string, Series<unknown>> = {};

    for (const spec of this._pipeline) {
      if (!this._cache.has(spec.key)) {
        const computed = this._computeIndicator(spec);
        this._cache.set(spec.key, computed);
      }
      indicators[spec.key] = this._cache.get(spec.key)!;
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
      const spec = this._pipeline.find((s) => s.key === key);
      if (spec) {
        this._cache.set(key, this._computeIndicator(spec));
      }
    }
    return this._cache.get(key);
  }

  /**
   * Compute a single indicator
   */
  private _computeIndicator(spec: IndicatorSpec): Series<unknown> {
    switch (spec.type) {
      case "sma":
        return sma(this._candles, { period: spec.period, source: spec.source });
      case "ema":
        return ema(this._candles, { period: spec.period, source: spec.source });
      case "rsi":
        return rsi(this._candles, { period: spec.period });
      case "macd":
        return macd(this._candles, {
          fastPeriod: spec.fast,
          slowPeriod: spec.slow,
          signalPeriod: spec.signal,
        }) as Series<MacdValue>;
      case "bollingerBands":
        return bollingerBands(this._candles, {
          period: spec.period,
          stdDev: spec.stdDev,
          source: spec.source,
        }) as Series<BollingerBandsValue>;
      case "atr":
        return atr(this._candles, { period: spec.period });
      case "volumeMa":
        return volumeMa(this._candles, { period: spec.period, type: spec.maType });
      case "highest":
        return highest(this._candles, spec.period);
      case "lowest":
        return lowest(this._candles, spec.period);
      case "returns":
        return returns(this._candles, { period: spec.period, type: spec.returnType });
      default:
        throw new Error(`Unknown indicator type: ${(spec as IndicatorSpec).type}`);
    }
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
}

/**
 * Check if candles are already normalized
 */
function isNormalized(candles: Candle[] | NormalizedCandle[]): candles is NormalizedCandle[] {
  if (candles.length === 0) return true;
  return typeof candles[0].time === "number";
}
