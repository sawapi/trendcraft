/**
 * Cross, Divergence, and Squeeze signal markers for ECharts
 */

import type {
  CrossSignalQuality,
  DivergenceSignal,
  NormalizedCandle,
  SqueezeSignal,
} from "trendcraft";

import { type MarkPointItem, SIGNAL_COLORS } from "./signalColors";

/**
 * Create markPoint data for Golden/Dead Cross signals
 */
export function createCrossMarkPoints(
  crossSignals: CrossSignalQuality[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  crossSignals.forEach((signal) => {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) return;

    const isGolden = signal.type === "golden";
    const isFake = signal.isFake;
    const candle = candles[idx];
    const price = isGolden ? candle.low * 0.995 : candle.high * 1.005;

    markPoints.push({
      name: isGolden ? "Golden Cross" : "Dead Cross",
      coord: [dates[idx], price],
      symbol: "circle",
      symbolSize: isFake ? 10 : 14,
      itemStyle: {
        color: isFake
          ? SIGNAL_COLORS.crossFake
          : isGolden
            ? SIGNAL_COLORS.goldenCross
            : SIGNAL_COLORS.deadCross,
      },
      label: {
        show: true,
        formatter: isGolden ? "GC" : "DC",
        color: "#fff",
        fontSize: isFake ? 6 : 8,
        position: "inside",
      },
    });
  });

  return markPoints;
}

/**
 * Create markPoint data for Divergence signals
 */
export function createDivergenceMarkers(
  signals: DivergenceSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  signals.forEach((s) => {
    const idx = s.secondIdx;
    if (idx < 0 || idx >= candles.length) return;

    const isBullish = s.type === "bullish";
    const candle = candles[idx];
    const price = isBullish ? candle.low * 0.995 : candle.high * 1.005;

    markPoints.push({
      name: isBullish ? "Bullish Divergence" : "Bearish Divergence",
      coord: [dates[idx], price],
      symbol: "diamond",
      symbolSize: 16,
      itemStyle: {
        color: isBullish ? SIGNAL_COLORS.bullishDivergence : SIGNAL_COLORS.bearishDivergence,
      },
      label: {
        show: true,
        formatter: isBullish ? "Bull Div" : "Bear Div",
        position: isBullish ? "bottom" : "top",
        fontSize: 9,
        color: isBullish ? SIGNAL_COLORS.bullishDivergence : SIGNAL_COLORS.bearishDivergence,
      },
    });
  });

  return markPoints;
}

/**
 * Create markPoint data for Bollinger Squeeze signals
 */
export function createSqueezeMarkers(
  signals: SqueezeSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  signals.forEach((s, i) => {
    const idx = timeToIdx.get(s.time);
    if (idx === undefined) return;

    const candle = candles[idx];
    const price = candle.low * 0.99;

    // Only show label on first occurrence or if gap > 5 bars
    const prevSignal = signals[i - 1];
    const prevIdx = prevSignal ? timeToIdx.get(prevSignal.time) : -10;
    const showLabel = prevIdx === undefined || idx - prevIdx >= 5;

    markPoints.push({
      name: "Bollinger Squeeze",
      coord: [dates[idx], price],
      symbol: "rect",
      symbolSize: [8, 20],
      itemStyle: { color: `${SIGNAL_COLORS.squeeze}80` },
      label: {
        show: showLabel,
        formatter: "SQ",
        position: "bottom",
        fontSize: 8,
        color: SIGNAL_COLORS.squeeze,
      },
    });
  });

  return markPoints;
}
