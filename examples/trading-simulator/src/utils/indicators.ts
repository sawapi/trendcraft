import * as TrendCraft from "trendcraft";
import type { NormalizedCandle, Series } from "trendcraft";

export interface IndicatorData {
  sma5?: (number | null)[];
  sma25?: (number | null)[];
  sma75?: (number | null)[];
  ema12?: (number | null)[];
  ema26?: (number | null)[];
  bbUpper?: (number | null)[];
  bbMiddle?: (number | null)[];
  bbLower?: (number | null)[];
  rsi?: (number | null)[];
  macdLine?: (number | null)[];
  macdSignal?: (number | null)[];
  macdHist?: (number | null)[];
}

// Helper to extract values from Series
function extractValues<T>(series: Series<T>): T[] {
  return series.map((item) => item.value);
}

export function calculateIndicators(
  candles: NormalizedCandle[],
  enabledIndicators: string[]
): IndicatorData {
  const result: IndicatorData = {};

  if (enabledIndicators.includes("sma5")) {
    const series = TrendCraft.sma(candles, { period: 5 });
    result.sma5 = extractValues(series);
  }

  if (enabledIndicators.includes("sma25")) {
    const series = TrendCraft.sma(candles, { period: 25 });
    result.sma25 = extractValues(series);
  }

  if (enabledIndicators.includes("sma75")) {
    const series = TrendCraft.sma(candles, { period: 75 });
    result.sma75 = extractValues(series);
  }

  if (enabledIndicators.includes("ema12")) {
    const series = TrendCraft.ema(candles, { period: 12 });
    result.ema12 = extractValues(series);
  }

  if (enabledIndicators.includes("ema26")) {
    const series = TrendCraft.ema(candles, { period: 26 });
    result.ema26 = extractValues(series);
  }

  if (enabledIndicators.includes("bb")) {
    const series = TrendCraft.bollingerBands(candles, { period: 20, stdDev: 2 });
    result.bbUpper = series.map((item) => item.value?.upper ?? null);
    result.bbMiddle = series.map((item) => item.value?.middle ?? null);
    result.bbLower = series.map((item) => item.value?.lower ?? null);
  }

  if (enabledIndicators.includes("rsi")) {
    const series = TrendCraft.rsi(candles, { period: 14 });
    result.rsi = extractValues(series);
  }

  if (enabledIndicators.includes("macd")) {
    const series = TrendCraft.macd(candles, {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
    });
    result.macdLine = series.map((item) => item.value?.macd ?? null);
    result.macdSignal = series.map((item) => item.value?.signal ?? null);
    result.macdHist = series.map((item) => item.value?.histogram ?? null);
  }

  return result;
}
