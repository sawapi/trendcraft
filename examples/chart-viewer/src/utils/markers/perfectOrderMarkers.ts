/**
 * Perfect Order signal markers for ECharts
 */

import type {
  NormalizedCandle,
  PerfectOrderValueEnhanced,
  Series,
} from "trendcraft";

import { SIGNAL_COLORS, type MarkPointItem } from "./signalColors";

/**
 * Create markPoint data for enhanced perfect order signals
 */
export function createPerfectOrderMarkPoints(
  poData: Series<PerfectOrderValueEnhanced>,
  candles: NormalizedCandle[],
  dates: string[]
): MarkPointItem[] {
  const markPoints: MarkPointItem[] = [];

  let hasEverConfirmedBullish = false;
  let hasEverConfirmedBearish = false;

  poData.forEach((po, idx) => {
    const state = po.value.state;
    const isConfirmed = po.value.isConfirmed;

    if (state === "BULLISH_PO" && isConfirmed) hasEverConfirmedBullish = true;
    if (state === "BEARISH_PO" && isConfirmed) hasEverConfirmedBearish = true;

    // Confirmed BULLISH_PO
    if (po.value.confirmationFormed && state === "BULLISH_PO") {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "PO Bullish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: SIGNAL_COLORS.bullishConfirmed },
        label: { show: true, formatter: "PO+", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // Confirmed BEARISH_PO
    if (po.value.confirmationFormed && state === "BEARISH_PO") {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Bearish Confirmed",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 16,
        itemStyle: { color: SIGNAL_COLORS.bearishConfirmed },
        label: { show: true, formatter: "PO-", color: "#fff", fontSize: 8, position: "inside" },
      });
    }

    // PRE_BULLISH_PO
    if (
      state === "PRE_BULLISH_PO" &&
      !isConfirmed &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBullish
    ) {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "PO Pre-Bullish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.preBullish },
        label: { show: true, formatter: "PO?", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // PRE_BEARISH_PO
    if (
      state === "PRE_BEARISH_PO" &&
      !isConfirmed &&
      po.value.persistCount === 1 &&
      !hasEverConfirmedBearish
    ) {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Pre-Bearish",
        coord: [dates[idx], price],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.preBearish },
        label: { show: true, formatter: "PO?", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // COLLAPSED
    if (po.value.collapseDetected) {
      const price = candles[idx].low * 0.995;
      markPoints.push({
        name: "MA Collapsed",
        coord: [dates[idx], price],
        symbol: "rect",
        symbolSize: 12,
        itemStyle: { color: SIGNAL_COLORS.collapsed },
        label: { show: true, formatter: "SQ", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // PO_BREAKDOWN
    if (po.value.breakdownDetected) {
      const price = candles[idx].high * 1.005;
      markPoints.push({
        name: "PO Breakdown",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 12,
        symbolRotate: 180,
        itemStyle: { color: SIGNAL_COLORS.breakdown },
        label: { show: true, formatter: "BD", color: "#fff", fontSize: 7, position: "inside" },
      });
    }

    // Pullback Buy Signal
    if (po.value.pullbackBuySignal && po.value.type === "bullish") {
      const price = candles[idx].low * 0.99;
      markPoints.push({
        name: "Pullback Buy",
        coord: [dates[idx], price],
        symbol: "triangle",
        symbolSize: 14,
        itemStyle: { color: SIGNAL_COLORS.pullbackBuy },
        label: { show: true, formatter: "PB", color: "#fff", fontSize: 7, position: "inside" },
      });
    }
  });

  return markPoints;
}
