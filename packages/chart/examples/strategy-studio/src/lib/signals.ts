/**
 * Signal catalog for the Strategy Studio SignalsPanel. Each entry knows how to
 * compute its signal from candles and how to convert the result into the
 * chart's `SignalMarker` shape (`{ time, type: "buy" | "sell", label }`).
 *
 * Categorized to match the panel's grouping. Keep entries small and additive
 * — this is the canonical place to add a new detector to the UI.
 */

import type { SignalMarker } from "@trendcraft/chart";
import {
  type DivergenceSignal,
  deadCross,
  doubleBottom,
  doubleTop,
  goldenCross,
  headAndShoulders,
  inverseHeadAndShoulders,
  macdDivergence,
  type PatternSignal,
  rsiDivergence,
  type Series,
} from "trendcraft";
import type { CatalogEntry } from "../panels/ToggleCatalogPanel";
import type { StudioCandle } from "./sample-data";

export type SignalCategory = "cross" | "divergence" | "pattern";

export type SignalDef = CatalogEntry<SignalCategory> & {
  compute: (candles: StudioCandle[]) => SignalMarker[];
};

export const SIGNAL_CATALOG: readonly SignalDef[] = [
  {
    kind: "goldenCross",
    label: "Golden Cross",
    category: "cross",
    description: "SMA(5) crosses above SMA(25) — classic medium-term bullish trigger.",
    compute: (candles) => seriesToMarkers(goldenCross(candles), candles, "buy", "Golden Cross"),
  },
  {
    kind: "deadCross",
    label: "Dead Cross",
    category: "cross",
    description: "SMA(5) crosses below SMA(25) — bearish counterpart of Golden Cross.",
    compute: (candles) => seriesToMarkers(deadCross(candles), candles, "sell", "Dead Cross"),
  },
  {
    kind: "rsiDivergence",
    label: "RSI Divergence",
    category: "divergence",
    description: "Price makes a new extreme but RSI(14) doesn't — momentum is fading.",
    compute: (candles) => divergenceToMarkers(rsiDivergence(candles), "RSI Div"),
  },
  {
    kind: "macdDivergence",
    label: "MACD Divergence",
    category: "divergence",
    description: "Price extreme not confirmed by MACD histogram — early reversal hint.",
    compute: (candles) => divergenceToMarkers(macdDivergence(candles), "MACD Div"),
  },
  {
    kind: "doubleTop",
    label: "Double Top",
    category: "pattern",
    description: "Two failed attempts to break the same resistance — bearish reversal.",
    compute: (candles) => patternToMarkers(doubleTop(candles), "sell", "Double Top"),
  },
  {
    kind: "doubleBottom",
    label: "Double Bottom",
    category: "pattern",
    description: "Two failed attempts to break the same support — bullish reversal.",
    compute: (candles) => patternToMarkers(doubleBottom(candles), "buy", "Double Bottom"),
  },
  {
    kind: "headAndShoulders",
    label: "Head & Shoulders",
    category: "pattern",
    description: "Three peaks with the middle highest — well-known bearish reversal.",
    compute: (candles) => patternToMarkers(headAndShoulders(candles), "sell", "H&S"),
  },
  {
    kind: "inverseHeadAndShoulders",
    label: "Inverse Head & Shoulders",
    category: "pattern",
    description: "Three troughs with the middle lowest — bullish counterpart of H&S.",
    compute: (candles) => patternToMarkers(inverseHeadAndShoulders(candles), "buy", "Inv H&S"),
  },
];

export const SIGNAL_BY_KIND: Map<string, SignalDef> = new Map(
  SIGNAL_CATALOG.map((d) => [d.kind, d]),
);

function seriesToMarkers(
  series: Series<boolean>,
  candles: StudioCandle[],
  type: "buy" | "sell",
  label: string,
): SignalMarker[] {
  const out: SignalMarker[] = [];
  for (let i = 0; i < series.length; i++) {
    if (series[i]?.value === true) {
      const candle = candles[i];
      if (candle) out.push({ time: candle.time, type, label });
    }
  }
  return out;
}

function divergenceToMarkers(divergences: DivergenceSignal[], label: string): SignalMarker[] {
  return divergences.map((d) => ({
    time: d.time,
    type: d.type === "bullish" ? "buy" : "sell",
    label,
  }));
}

function patternToMarkers(
  patterns: PatternSignal[],
  type: "buy" | "sell",
  label: string,
): SignalMarker[] {
  return patterns.map((p) => ({ time: p.time, type, label }));
}
