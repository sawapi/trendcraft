/**
 * Market Context Analysis
 *
 * Provides a unified snapshot of the current market state at a given candle index.
 * Combines trend direction, strength, indicator zones, and cross signals into
 * a single structured object with a human-readable description.
 *
 * @example
 * ```ts
 * import { analyzeMarketContext } from "trendcraft";
 *
 * const ctx = analyzeMarketContext(candles, candles.length - 1);
 * // { trend: "uptrend", trendStrength: "strong", regime: "TREND_UP", ... }
 * ```
 */

import { isNormalized, normalizeCandles } from "../core/normalize";
import { dmi } from "../indicators/momentum/dmi";
import { macd } from "../indicators/momentum/macd";
import { rsi } from "../indicators/momentum/rsi";
import { sma } from "../indicators/moving-average/sma";
import { bollingerBands } from "../indicators/volatility/bollinger-bands";
import type { Candle, NormalizedCandle, Series } from "../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Structured market context at a given point in time.
 */
export type MarketContext = {
  /** Overall trend direction */
  trend: "uptrend" | "downtrend" | "range";
  /** Trend conviction */
  trendStrength: "strong" | "moderate" | "weak";
  /** Simplified regime label */
  regime: "TREND_UP" | "TREND_DOWN" | "RANGE";
  /** Confidence score 0-1 (ADX-based when available, slope-based otherwise) */
  confidence: number;
  /** Price position relative to short MA */
  priceVsSmaShort: "above" | "below" | "at";
  /** Price position relative to long MA */
  priceVsSmaLong: "above" | "below" | "at";
  /** Short MA vs long MA relationship */
  smaCross: "golden_cross" | "death_cross" | "above" | "below";
  /** RSI zone classification */
  rsiZone?: "overbought" | "oversold" | "neutral";
  /** MACD histogram momentum */
  macdSignal?: "bullish" | "bearish" | "neutral";
  /** Price position within Bollinger Bands */
  bbPosition?: "upper" | "middle" | "lower";
  /** Human-readable summary */
  description: string;
};

/**
 * Options for market context analysis.
 */
export type MarketContextOptions = {
  /** Short SMA period. Default: 25 */
  smaShort?: number;
  /** Long SMA period. Default: 75 */
  smaLong?: number;
  /** Number of recent bars to measure slope. Default: 5 */
  slopeLookback?: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  smaShort: 25,
  smaLong: 75,
  slopeLookback: 5,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyPriceVsMa(price: number, ma: number | null | undefined): "above" | "below" | "at" {
  if (ma == null) return "at";
  const diff = ((price - ma) / ma) * 100;
  if (diff > 0.5) return "above";
  if (diff < -0.5) return "below";
  return "at";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Analyze market context at a given candle index.
 *
 * Computes SMA, RSI, MACD, Bollinger Bands, and DMI/ADX internally,
 * then synthesizes them into a unified {@link MarketContext}.
 *
 * @param candles - Array of candles
 * @param index - The candle index to analyze (defaults to last candle)
 * @param options - Configuration overrides
 * @returns Structured market context
 *
 * @example
 * ```ts
 * const ctx = analyzeMarketContext(candles, 100);
 * if (ctx.regime === "TREND_UP" && ctx.confidence > 0.6) {
 *   // High-confidence uptrend
 * }
 * ```
 */
export function analyzeMarketContext(
  candles: Candle[] | NormalizedCandle[],
  index?: number,
  options?: MarketContextOptions,
): MarketContext {
  const normalized = isNormalized(candles) ? candles : normalizeCandles(candles);
  const idx = index ?? normalized.length - 1;

  if (normalized.length === 0 || idx < 0 || idx >= normalized.length) {
    return emptyContext();
  }

  const opts = {
    smaShort: options?.smaShort ?? DEFAULTS.smaShort,
    smaLong: options?.smaLong ?? DEFAULTS.smaLong,
    slopeLookback: options?.slopeLookback ?? DEFAULTS.slopeLookback,
  };

  const price = normalized[idx].close;

  // Compute indicators up to idx+1 (inclusive slice)
  const slice = normalized.slice(0, idx + 1);

  const smaShortSeries = sma(slice, { period: opts.smaShort });
  const smaLongSeries = sma(slice, { period: opts.smaLong });
  const rsiSeries = rsi(slice, { period: 14 });
  const macdSeries = macd(slice);
  const bbSeries = bollingerBands(slice);
  const dmiSeries = dmi(slice, { period: 14 });

  // Extract values at the end of the slice
  const smaShortVal = atEnd(smaShortSeries, 0)?.value;
  const smaLongVal = atEnd(smaLongSeries, 0)?.value;
  const prevSmaShort = atEnd(smaShortSeries, 1)?.value;
  const prevSmaLong = atEnd(smaLongSeries, 1)?.value;
  const rsiVal = atEnd(rsiSeries, 0)?.value;
  const macdVal = atEnd(macdSeries, 0)?.value;
  const prevMacdVal = atEnd(macdSeries, 1)?.value;
  const bbVal = atEnd(bbSeries, 0)?.value;
  const adxVal = atEnd(dmiSeries, 0)?.value?.adx;

  // Price vs MAs
  const priceVsSmaShort = classifyPriceVsMa(price, smaShortVal);
  const priceVsSmaLong = classifyPriceVsMa(price, smaLongVal);

  // MA Cross
  let smaCross: MarketContext["smaCross"] = "above";
  if (smaShortVal != null && smaLongVal != null) {
    if (prevSmaShort != null && prevSmaLong != null) {
      if (prevSmaShort < prevSmaLong && smaShortVal > smaLongVal) {
        smaCross = "golden_cross";
      } else if (prevSmaShort > prevSmaLong && smaShortVal < smaLongVal) {
        smaCross = "death_cross";
      } else {
        smaCross = smaShortVal > smaLongVal ? "above" : "below";
      }
    } else {
      smaCross = smaShortVal > smaLongVal ? "above" : "below";
    }
  }

  // Trend from SMA slope
  let trend: MarketContext["trend"] = "range";
  let trendStrength: MarketContext["trendStrength"] = "weak";

  const slopeLen = opts.slopeLookback;
  if (smaShortSeries.length >= slopeLen + 1) {
    const recent: number[] = [];
    for (let i = smaShortSeries.length - slopeLen - 1; i < smaShortSeries.length; i++) {
      const v = i >= 0 ? smaShortSeries[i]?.value : null;
      if (v != null) {
        recent.push(v);
      }
    }
    if (recent.length >= slopeLen) {
      const slope = ((recent[recent.length - 1] - recent[0]) / recent[0]) * 100;
      if (slope > 2) {
        trend = "uptrend";
        trendStrength = slope > 5 ? "strong" : "moderate";
      } else if (slope < -2) {
        trend = "downtrend";
        trendStrength = slope < -5 ? "strong" : "moderate";
      }
    }
  }

  // Regime
  const regimeMap = { uptrend: "TREND_UP", downtrend: "TREND_DOWN", range: "RANGE" } as const;
  const regime = regimeMap[trend];

  // Confidence (ADX-based or slope-based fallback)
  const strengthConfidence = { strong: 0.8, moderate: 0.5, weak: 0.3 } as const;
  const confidence = adxVal != null ? Math.min(adxVal / 50, 1) : strengthConfidence[trendStrength];

  // RSI zone
  let rsiZone: MarketContext["rsiZone"];
  if (rsiVal != null) {
    if (rsiVal >= 70) rsiZone = "overbought";
    else if (rsiVal <= 30) rsiZone = "oversold";
    else rsiZone = "neutral";
  }

  // MACD signal
  let macdSignal: MarketContext["macdSignal"];
  const macdHist = macdVal?.histogram;
  const prevMacdHist = prevMacdVal?.histogram;
  if (macdHist != null && prevMacdHist != null) {
    if (macdHist > 0 && macdHist > prevMacdHist) macdSignal = "bullish";
    else if (macdHist < 0 && macdHist < prevMacdHist) macdSignal = "bearish";
    else macdSignal = "neutral";
  }

  // BB position
  let bbPosition: MarketContext["bbPosition"];
  if (bbVal?.upper != null && bbVal?.lower != null) {
    const totalRange = bbVal.upper - bbVal.lower;
    if (totalRange > 0) {
      const position = (price - bbVal.lower) / totalRange;
      if (position >= 0.8) bbPosition = "upper";
      else if (position <= 0.2) bbPosition = "lower";
      else bbPosition = "middle";
    }
  }

  // Description
  const descParts: string[] = [];
  const strengthLabel = { strong: "Strong ", moderate: "Moderate ", weak: "" } as const;
  const trendLabel = { uptrend: "Uptrend", downtrend: "Downtrend", range: "Range" } as const;
  descParts.push(`${strengthLabel[trendStrength]}${trendLabel[trend]}`);

  if (smaCross === "golden_cross") {
    descParts.push("Golden cross");
  } else if (smaCross === "death_cross") {
    descParts.push("Death cross");
  } else if (smaShortVal != null && smaLongVal != null) {
    descParts.push(
      smaShortVal > smaLongVal
        ? `MA${opts.smaShort}>MA${opts.smaLong}`
        : `MA${opts.smaShort}<MA${opts.smaLong}`,
    );
  }

  if (priceVsSmaShort !== "at") {
    descParts.push(`Price ${priceVsSmaShort} MA${opts.smaShort}`);
  }

  if (rsiZone === "overbought") descParts.push("RSI overbought");
  else if (rsiZone === "oversold") descParts.push("RSI oversold");

  if (bbPosition === "upper") descParts.push("Near BB upper");
  else if (bbPosition === "lower") descParts.push("Near BB lower");

  return {
    trend,
    trendStrength,
    regime,
    confidence,
    priceVsSmaShort,
    priceVsSmaLong,
    smaCross,
    rsiZone,
    macdSignal,
    bbPosition,
    description: descParts.join(", "),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function emptyContext(): MarketContext {
  return {
    trend: "range",
    trendStrength: "weak",
    regime: "RANGE",
    confidence: 0,
    priceVsSmaShort: "at",
    priceVsSmaLong: "at",
    smaCross: "above",
    description: "Insufficient data",
  };
}

/** Return the element at `offset` positions from the end (0 = last, 1 = second-to-last). */
function atEnd<T>(series: Series<T>, offset: number): Series<T>[number] | undefined {
  const i = series.length - 1 - offset;
  return i >= 0 ? series[i] : undefined;
}
