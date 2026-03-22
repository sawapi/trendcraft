/**
 * Volume signal markers for ECharts
 */

import type { NormalizedCandle, VolumeBreakoutSignal, VolumeMaCrossSignal } from "trendcraft";

import { type MarkPointItem, SIGNAL_COLORS } from "./signalColors";

/**
 * Create markPoint data for Volume Breakout signals
 */
export function createVolumeBreakoutMarkers(
  signals: VolumeBreakoutSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  if (!signals || signals.length === 0) return [];

  const markPoints: MarkPointItem[] = [];
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  for (const signal of signals) {
    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) continue;

    markPoints.push({
      name: "Volume Breakout",
      coord: [dates[idx], candles[idx].low * 0.99],
      symbol: "triangle",
      symbolSize: [12, 10],
      symbolRotate: 0,
      itemStyle: { color: SIGNAL_COLORS.volumeBreakout },
      label: {
        show: true,
        formatter: `VB\n${signal.ratio.toFixed(1)}x`,
        color: SIGNAL_COLORS.volumeBreakout,
        fontSize: 8,
        position: "bottom",
      },
    });
  }

  return markPoints;
}

/**
 * Create markPoint data for Volume MA Cross signals
 */
export function createVolumeMaCrossMarkers(
  signals: VolumeMaCrossSignal[],
  candles: NormalizedCandle[],
  dates: string[],
): MarkPointItem[] {
  if (!signals || signals.length === 0) return [];

  const markPoints: MarkPointItem[] = [];
  const timeToIdx = new Map<number, number>();
  candles.forEach((c, i) => timeToIdx.set(c.time, i));

  // Only show signals where daysSinceCross === 0 (first day of cross, actually 1)
  for (const signal of signals) {
    if (signal.daysSinceCross !== 1) continue;

    const idx = timeToIdx.get(signal.time);
    if (idx === undefined) continue;

    markPoints.push({
      name: "Volume MA Cross",
      coord: [dates[idx], candles[idx].low * 0.99],
      symbol: "diamond",
      symbolSize: 12,
      itemStyle: { color: SIGNAL_COLORS.volumeMaCross },
      label: {
        show: true,
        formatter: "VMC",
        color: SIGNAL_COLORS.volumeMaCross,
        fontSize: 8,
        position: "bottom",
      },
    });
  }

  return markPoints;
}
