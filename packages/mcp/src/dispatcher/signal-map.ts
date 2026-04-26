/**
 * Maps signal `kind` to a candle-input signal function from `trendcraft`.
 *
 * Unlike indicator wrappers in `trendcraft/safe`, signal functions are still
 * throw-based — the dispatcher wraps each call in try/catch and converts
 * messages into a stable Result-like envelope for the MCP layer.
 *
 * Only signals that take `(candles, options?)` and produce a `Series` or an
 * event array are registered here. Two-series helpers (`crossOver`,
 * `crossUnder`) and discretionary tools (`detectDivergence` with custom
 * indicator inputs) are intentionally out of scope.
 */

import {
  bollingerSqueeze,
  deadCross,
  goldenCross,
  macdDivergence,
  obvDivergence,
  perfectOrder,
  rsiDivergence,
  volumeAboveAverage,
  volumeAccumulation,
  volumeBreakout,
  volumeMaCross,
} from "trendcraft";
import type { Candle } from "../schemas/candle";

export type SignalShape = "series" | "events";

export interface SignalDescriptor {
  /** Output shape — `series` for `Series<T>`, `events` for `T[]` arrays. */
  shape: SignalShape;
  /** One-line description for tool discoverability. */
  oneLiner: string;
  /** Default param hint string for callers. */
  paramsHint: string;
  fn: (candles: Candle[], options?: Record<string, unknown>) => unknown;
}

const REGISTRY: Record<string, SignalDescriptor> = {
  goldenCross: {
    shape: "series",
    oneLiner: "SMA short crosses ABOVE SMA long — Series<boolean>.",
    paramsHint: "{ short?: number = 5, long?: number = 25 }",
    fn: (c, o) => goldenCross(c, o as Parameters<typeof goldenCross>[1]),
  },
  deadCross: {
    shape: "series",
    oneLiner: "SMA short crosses BELOW SMA long — Series<boolean>.",
    paramsHint: "{ short?: number = 5, long?: number = 25 }",
    fn: (c, o) => deadCross(c, o as Parameters<typeof deadCross>[1]),
  },
  perfectOrder: {
    shape: "series",
    oneLiner: "Multi-MA alignment state per bar (bullish / bearish / neutral).",
    paramsHint: "{ periods?: number[] = [5,25,75], maType?: 'sma'|'ema'|'wma' = 'sma' }",
    fn: (c, o) => perfectOrder(c, o as Parameters<typeof perfectOrder>[1]),
  },
  bollingerSqueeze: {
    shape: "events",
    oneLiner: "Bandwidth at sub-N-percentile of recent lookback — squeeze events.",
    paramsHint:
      "{ period?: number = 20, stdDev?: number = 2, lookback?: number = 120, threshold?: number = 5 }",
    fn: (c, o) => bollingerSqueeze(c, o as Parameters<typeof bollingerSqueeze>[1]),
  },
  rsiDivergence: {
    shape: "events",
    oneLiner: "Bullish/bearish divergence between price and RSI swings.",
    paramsHint:
      "DivergenceOptions — see trendcraft signals docs (period, lookback, swingThreshold, ...)",
    fn: (c, o) => rsiDivergence(c, o as Parameters<typeof rsiDivergence>[1]),
  },
  macdDivergence: {
    shape: "events",
    oneLiner: "Divergence between price and MACD line/histogram swings.",
    paramsHint: "DivergenceOptions — see trendcraft signals docs.",
    fn: (c, o) => macdDivergence(c, o as Parameters<typeof macdDivergence>[1]),
  },
  obvDivergence: {
    shape: "events",
    oneLiner: "Divergence between price and OBV swings.",
    paramsHint: "DivergenceOptions — see trendcraft signals docs.",
    fn: (c, o) => obvDivergence(c, o as Parameters<typeof obvDivergence>[1]),
  },
  volumeBreakout: {
    shape: "events",
    oneLiner: "Volume exceeds N-period MA × ratio — breakout volume confirmation.",
    paramsHint: "{ period?: number = 20, minRatio?: number = 1.0 }",
    fn: (c, o) => volumeBreakout(c, o as Parameters<typeof volumeBreakout>[1]),
  },
  volumeAccumulation: {
    shape: "events",
    oneLiner: "Sustained positive volume slope (regression-confirmed accumulation).",
    paramsHint:
      "{ period?: number = 10, minSlope?: number = 0.05, minRSquared?: number = 0.3, minConsecutiveDays?: number = 3 }",
    fn: (c, o) => volumeAccumulation(c, o as Parameters<typeof volumeAccumulation>[1]),
  },
  volumeMaCross: {
    shape: "events",
    oneLiner: "Volume short-MA crosses volume long-MA — institutional interest signal.",
    paramsHint:
      "{ shortPeriod?: number = 5, longPeriod?: number = 20, minRatio?: number = 1.0, bullishOnly?: boolean = true }",
    fn: (c, o) => volumeMaCross(c, o as Parameters<typeof volumeMaCross>[1]),
  },
  volumeAboveAverage: {
    shape: "events",
    oneLiner: "Volume sustained above N-period MA × ratio for K consecutive days.",
    paramsHint:
      "{ period?: number = 20, minRatio?: number = 1.0, minConsecutiveDays?: number = 3 }",
    fn: (c, o) => volumeAboveAverage(c, o as Parameters<typeof volumeAboveAverage>[1]),
  },
};

export function getSignalDescriptor(kind: string): SignalDescriptor | undefined {
  return Object.hasOwn(REGISTRY, kind) ? REGISTRY[kind] : undefined;
}

export function listSupportedSignals(): { kind: string; shape: SignalShape; oneLiner: string }[] {
  return Object.entries(REGISTRY)
    .map(([kind, d]) => ({ kind, shape: d.shape, oneLiner: d.oneLiner }))
    .sort((a, b) => a.kind.localeCompare(b.kind));
}
