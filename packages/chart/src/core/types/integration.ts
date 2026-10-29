/**
 * Integration / overlay types: multi-timeframe overlays, backtest results,
 * pattern signals, signal/trade markers, and internal rendering structs.
 */

import type { CandleData, DataPoint, TimeValue } from "./fundamental";
import type { PaneConfig } from "./pane";
import type { SeriesConfig, SeriesType } from "./series";

export type TimeframeOverlay = {
  /** Identifier for this timeframe overlay */
  id: string;
  /** Higher timeframe candle data */
  candles: CandleData[];
  /** Timeframe label (e.g., '1W', '1M') */
  timeframe: string;
  /** Candle body color (default: semi-transparent) */
  color?: string;
  /** Opacity (default: 0.15) */
  opacity?: number;
};

/**
 * The parts of a `trendcraft` `BacktestResult` that `addBacktest` reads. Pass
 * the `runBacktest` result as it is.
 */
export type BacktestResultData = {
  initialCapital: number;
  finalCapital: number;
  totalReturnPercent: number;
  tradeCount: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  /** `Infinity` (or `null` after a JSON round trip) when no trade lost; drawn as "∞" */
  profitFactor: number;
  trades: {
    entryTime: number;
    entryPrice: number;
    exitTime: number;
    exitPrice: number;
    returnPercent: number;
    direction?: string;
    exitReason?: string;
  }[];
  /**
   * Not read by the chart: drawdown shading follows the drawn equity curve.
   * Accepted so a `BacktestResult` can be passed as it is.
   */
  drawdownPeriods?: {
    startTime: number;
    troughTime: number;
    recoveryTime?: number;
    maxDepthPercent: number;
    peakEquity: number;
    troughEquity: number;
  }[];
  /**
   * Mark-to-market equity at each evaluated candle's close, as `runBacktest`
   * returns it. `equityCurve[0]` belongs to the candle at `firstBarTime`, and
   * each later value to the next candle. The chart draws it as it is; without
   * it, or without `firstBarTime`, no equity curve is drawn.
   *
   * The chart checks the curve against the loaded candles where it can: the
   * candle at `firstBarTime` (or, when the data starts later, at
   * `lastBarTime`) must exist, the loaded candles from there must not
   * outnumber the curve, and when `lastBarTime` is loaded it must fall on the
   * curve's last value. Candles in between are not checked, so the chart must
   * hold the candles the backtest ran on.
   */
  equityCurve?: readonly number[];
  /** Time of the candle `equityCurve[0]` belongs to; `0` means unknown */
  firstBarTime?: number;
  /** Time of the last candle the backtest evaluated; `0` means unknown */
  lastBarTime?: number;
};

export type ChartPatternSignal = {
  time: number;
  type: string;
  pattern: {
    startTime: number;
    endTime: number;
    keyPoints: { time: number; index: number; price: number; label: string }[];
    neckline?: { startPrice: number; endPrice: number; slope: number; currentPrice: number };
    target?: number;
    stopLoss?: number;
    height?: number;
  };
  confidence: number;
  confirmed: boolean;
};

export type SignalMarker = {
  time: TimeValue;
  type: "buy" | "sell";
  label?: string;
};

export type TradeMarker = {
  entryTime: TimeValue;
  entryPrice: number;
  exitTime: TimeValue;
  exitPrice: number;
  direction?: "long" | "short";
  returnPercent?: number;
  exitReason?: string;
};

/** Summary info for a series */
export type SeriesInfo = {
  id: string;
  paneId: string;
  type: SeriesType;
  label: string;
  visible: boolean;
};

/** Computed pane dimensions (from layout engine) */
export type PaneRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  config: PaneConfig;
};

/** Computed series rendering info */
export type ResolvedSeries = {
  id: string;
  paneId: string;
  type: SeriesType;
  config: SeriesConfig;
  data: DataPoint<unknown>[];
  /** Decomposed numeric channels for compound types */
  channels: Map<string, (number | null)[]>;
};
